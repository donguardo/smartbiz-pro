ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS storefront_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.shops ADD CONSTRAINT shops_slug_format CHECK (slug IS NULL OR slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$');

CREATE OR REPLACE FUNCTION public.storefront_unique_slug(_name text, _shop uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  base := trim(both '-' from regexp_replace(lower(coalesce(_name,'')), '[^a-z0-9]+', '-', 'g'));
  base := trim(both '-' from left(base, 34));
  IF length(base) < 3 THEN base := 'store-' || left(replace(_shop::text,'-',''), 6); END IF;
  cand := base;
  WHILE EXISTS (SELECT 1 FROM shops WHERE slug = cand AND id <> _shop) LOOP
    n := n + 1; cand := base || '-' || n;
  END LOOP;
  RETURN cand;
END $$;
REVOKE ALL ON FUNCTION public.storefront_unique_slug(text, uuid) FROM PUBLIC, anon, authenticated;

UPDATE public.shops s SET slug = public.storefront_unique_slug(s.name, s.id) WHERE s.slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_key ON public.shops (slug);

CREATE OR REPLACE FUNCTION public.shops_set_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.slug IS NULL THEN NEW.slug := storefront_unique_slug(NEW.name, NEW.id); END IF;
  ELSIF NEW.slug IS DISTINCT FROM OLD.slug OR NEW.storefront_enabled IS DISTINCT FROM OLD.storefront_enabled THEN
    IF current_setting('app.storefront_rpc', true) IS DISTINCT FROM 'on' AND current_user NOT IN ('postgres','service_role','supabase_admin') THEN
      RAISE EXCEPTION 'Use set_my_storefront';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shops_set_slug ON public.shops;
CREATE TRIGGER shops_set_slug BEFORE INSERT OR UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.shops_set_slug();

CREATE OR REPLACE FUNCTION public.set_my_storefront(_slug text, _enabled boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid := current_shop_id(); s text := lower(trim(_slug));
BEGIN
  IF sid IS NULL OR NOT is_shop_owner(sid) THEN RAISE EXCEPTION 'Only the owner can change the storefront'; END IF;
  IF s !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$' THEN RAISE EXCEPTION 'SLUG_INVALID'; END IF;
  IF EXISTS (SELECT 1 FROM shops WHERE slug = s AND id <> sid) THEN RAISE EXCEPTION 'SLUG_TAKEN'; END IF;
  PERFORM set_config('app.storefront_rpc', 'on', true);
  UPDATE shops SET slug = s, storefront_enabled = coalesce(_enabled, true) WHERE id = sid;
  PERFORM set_config('app.storefront_rpc', 'off', true);
  RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.set_my_storefront(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_storefront(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_storefront()
RETURNS TABLE(slug text, storefront_enabled boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.slug, s.storefront_enabled FROM shops s WHERE s.id = current_shop_id() AND is_shop_member(s.id);
$$;
REVOKE ALL ON FUNCTION public.get_my_storefront() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_storefront() TO authenticated;

-- Public reads: only name/categories and sellable products; never cost, exact stock, or contact details.
CREATE OR REPLACE FUNCTION public.public_storefront(_slug text)
RETURNS TABLE(shop_name text, categories text[], slug text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.name, s.business_categories, s.slug FROM shops s
  WHERE s.slug = lower(_slug) AND s.storefront_enabled AND shop_has_access_unchecked(s.id);
$$;
CREATE OR REPLACE FUNCTION public.public_storefront_products(_slug text)
RETURNS TABLE(id uuid, name text, category text, price numeric, unit text, in_stock boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.category, p.price, p.unit, (NOT p.track_stock OR p.stock_qty > 0)
  FROM products p JOIN shops s ON s.id = p.shop_id
  WHERE s.slug = lower(_slug) AND s.storefront_enabled AND shop_has_access_unchecked(s.id) AND p.archived_at IS NULL
  ORDER BY p.category, p.name LIMIT 2000;
$$;
REVOKE ALL ON FUNCTION public.public_storefront(text), public.public_storefront_products(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_storefront(text), public.public_storefront_products(text) TO anon, authenticated;

CREATE TABLE public.storefront_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_no text NOT NULL,
  customer_name text NOT NULL,
  customer_mobile text NOT NULL,
  note text,
  total numeric NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','confirmed','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX storefront_orders_shop_idx ON public.storefront_orders (shop_id, created_at DESC);
CREATE TABLE public.storefront_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.storefront_orders(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit text NOT NULL,
  qty numeric NOT NULL,
  price numeric NOT NULL
);
CREATE INDEX storefront_order_items_order_idx ON public.storefront_order_items (order_id);
GRANT SELECT ON public.storefront_orders, public.storefront_order_items TO authenticated;
GRANT ALL ON public.storefront_orders, public.storefront_order_items TO service_role;
ALTER TABLE public.storefront_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members read storefront orders" ON public.storefront_orders FOR SELECT TO authenticated USING (shop_id = current_shop_id() AND is_shop_member(shop_id));
CREATE POLICY "Shop members read storefront order items" ON public.storefront_order_items FOR SELECT TO authenticated USING (shop_id = current_shop_id() AND is_shop_member(shop_id));

CREATE OR REPLACE FUNCTION public.place_storefront_order(_slug text, _name text, _mobile text, _note text, _items jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; oid uuid; ono text; it jsonb; p record; q numeric; tot numeric := 0; nm text := trim(coalesce(_name,'')); mb text := regexp_replace(coalesce(_mobile,''), '\D', '', 'g');
BEGIN
  SELECT s.id INTO sid FROM shops s WHERE s.slug = lower(_slug) AND s.storefront_enabled AND shop_has_access_unchecked(s.id);
  IF sid IS NULL THEN RAISE EXCEPTION 'STORE_UNAVAILABLE'; END IF;
  IF length(nm) < 1 OR length(nm) > 80 THEN RAISE EXCEPTION 'NAME_INVALID'; END IF;
  IF mb !~ '^09[0-9]{9}$' THEN RAISE EXCEPTION 'MOBILE_INVALID'; END IF;
  IF length(coalesce(_note,'')) > 300 THEN RAISE EXCEPTION 'NOTE_TOO_LONG'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) < 1 OR jsonb_array_length(_items) > 30 THEN RAISE EXCEPTION 'ITEMS_INVALID'; END IF;
  IF (SELECT count(*) FROM storefront_orders WHERE shop_id = sid AND created_at > now() - interval '1 hour') >= 60
     OR (SELECT count(*) FROM storefront_orders WHERE shop_id = sid AND customer_mobile = mb AND created_at > now() - interval '15 minutes') >= 3 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  ono := 'W' || to_char(now() AT TIME ZONE 'Asia/Manila', 'MMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
  INSERT INTO storefront_orders (shop_id, order_no, customer_name, customer_mobile, note, total)
    VALUES (sid, ono, nm, mb, nullif(trim(coalesce(_note,'')), ''), 0) RETURNING id INTO oid;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    q := (it->>'qty')::numeric;
    IF q IS NULL OR q <= 0 OR q > 999 THEN RAISE EXCEPTION 'ITEMS_INVALID'; END IF;
    SELECT pr.id, pr.name, pr.unit, pr.price, pr.track_stock, pr.stock_qty INTO p FROM products pr
      WHERE pr.id = (it->>'product_id')::uuid AND pr.shop_id = sid AND pr.archived_at IS NULL;
    IF p.id IS NULL THEN RAISE EXCEPTION 'ITEMS_INVALID'; END IF;
    IF p.track_stock AND p.stock_qty <= 0 THEN RAISE EXCEPTION 'SOLD_OUT'; END IF;
    INSERT INTO storefront_order_items (order_id, shop_id, product_id, name, unit, qty, price) VALUES (oid, sid, p.id, p.name, p.unit, q, p.price);
    tot := tot + q * p.price;
  END LOOP;
  UPDATE storefront_orders SET total = round(tot, 2) WHERE id = oid;
  RETURN ono;
END $$;
REVOKE ALL ON FUNCTION public.place_storefront_order(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_storefront_order(text, text, text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_storefront_order_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('new','confirmed','completed','cancelled') THEN RAISE EXCEPTION 'Bad status'; END IF;
  UPDATE storefront_orders SET status = _status, updated_at = now()
    WHERE id = _id AND shop_id = current_shop_id() AND is_shop_member(shop_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_storefront_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_storefront_order_status(uuid, text) TO authenticated;