ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS allow_cashier_products boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'pc',
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_qty numeric NOT NULL DEFAULT 0;
ALTER TABLE public.products ALTER COLUMN sku SET DEFAULT '';
ALTER TABLE public.products ALTER COLUMN cost SET DEFAULT 0;
UPDATE public.products SET stock_qty = stock;
COMMENT ON COLUMN public.products.stock IS 'DEPRECATED: whole-number mirror of stock_qty, kept in sync by trigger';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS quantity numeric;
UPDATE public.sale_items SET quantity = qty WHERE quantity IS NULL;
COMMENT ON COLUMN public.sale_items.qty IS 'DEPRECATED: rounded-up mirror of quantity';
CREATE UNIQUE INDEX IF NOT EXISTS products_shop_sku_unique ON public.products (shop_id, lower(sku)) WHERE sku <> '';

CREATE OR REPLACE FUNCTION public.can_edit_products(_shop_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_shop_owner(_shop_id) OR (public.is_shop_member(_shop_id) AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.allow_cashier_products))
$$;

CREATE OR REPLACE FUNCTION public.force_current_shop_id() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW.shop_id := public.current_shop_id(); END IF;
  ELSE
    NEW.shop_id := OLD.shop_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.products_before_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner boolean;
BEGIN
  NEW.name := trim(NEW.name); NEW.sku := COALESCE(trim(NEW.sku), ''); NEW.category := COALESCE(NULLIF(trim(NEW.category), ''), 'General');
  NEW.cost := COALESCE(NEW.cost, 0);
  IF NEW.unit NOT IN ('pc','pack','kg','g','L','service') THEN RAISE EXCEPTION 'Invalid unit'; END IF;
  IF NEW.price < 0 OR NEW.cost < 0 THEN RAISE EXCEPTION 'Price and cost cannot be negative'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock_qty = 0 AND NEW.stock <> 0 THEN NEW.stock_qty := NEW.stock; END IF;
  ELSIF NEW.stock_qty IS NOT DISTINCT FROM OLD.stock_qty AND NEW.stock IS DISTINCT FROM OLD.stock THEN
    NEW.stock_qty := NEW.stock;
  END IF;
  IF NOT NEW.track_stock THEN NEW.stock_qty := 0; END IF;
  IF NEW.unit NOT IN ('kg','g','L') AND NEW.stock_qty <> trunc(NEW.stock_qty) THEN RAISE EXCEPTION 'Decimals are only allowed for kg, g or L'; END IF;
  NEW.stock := floor(NEW.stock_qty)::int;
  IF auth.uid() IS NOT NULL THEN
    v_owner := public.is_shop_owner(NEW.shop_id);
    IF NOT v_owner THEN
      IF TG_OP = 'INSERT' THEN NEW.archived_at := NULL;
      ELSE NEW.archived_at := OLD.archived_at; NEW.cost := OLD.cost; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS products_force_shop ON public.products;
CREATE TRIGGER products_force_shop BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.force_current_shop_id();
DROP TRIGGER IF EXISTS products_zz_before_write ON public.products;
CREATE TRIGGER products_zz_before_write BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.products_before_write();
DROP TRIGGER IF EXISTS customers_force_shop ON public.customers;
CREATE TRIGGER customers_force_shop BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.force_current_shop_id();
DROP TRIGGER IF EXISTS suppliers_force_shop ON public.suppliers;
CREATE TRIGGER suppliers_force_shop BEFORE INSERT OR UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.force_current_shop_id();
DROP TRIGGER IF EXISTS expenses_force_shop ON public.expenses;
CREATE TRIGGER expenses_force_shop BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.force_current_shop_id();

DROP POLICY IF EXISTS "allowed cashiers add products" ON public.products;
CREATE POLICY "allowed cashiers add products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.can_edit_products(shop_id));

CREATE OR REPLACE FUNCTION public.get_shop_products_v2()
 RETURNS TABLE(id uuid, shop_id uuid, name text, sku text, category text, price numeric, cost numeric, stock numeric, reorder_level integer, unit text, track_stock boolean, photo_path text, archived_at timestamptz, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.shop_id, p.name, p.sku, p.category, p.price,
    CASE WHEN public.is_shop_owner(p.shop_id) THEN p.cost ELSE NULL END,
    p.stock_qty, p.reorder_level, p.unit, p.track_stock, p.photo_path, p.archived_at, p.created_at
  FROM public.products p WHERE p.shop_id = public.current_shop_id() AND public.is_shop_member(p.shop_id) ORDER BY lower(p.name)
$$;

CREATE OR REPLACE FUNCTION public.get_product_settings() RETURNS TABLE(allow_cashier_products boolean, can_edit boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.allow_cashier_products, public.can_edit_products(s.id) FROM public.shops s WHERE s.id = public.current_shop_id() AND public.is_shop_member(s.id)
$$;

CREATE OR REPLACE FUNCTION public.update_product(_id uuid, _data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.products WHERE id = _id;
  IF v_shop IS NULL OR v_shop <> public.current_shop_id() OR NOT public.can_edit_products(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.products SET
    name = COALESCE(_data->>'name', name), category = COALESCE(_data->>'category', category),
    sku = COALESCE(_data->>'sku', sku), price = COALESCE((_data->>'price')::numeric, price),
    cost = COALESCE((_data->>'cost')::numeric, cost), unit = COALESCE(_data->>'unit', unit),
    track_stock = COALESCE((_data->>'track_stock')::boolean, track_stock),
    stock_qty = COALESCE((_data->>'stock_qty')::numeric, stock_qty),
    reorder_level = COALESCE((_data->>'reorder_level')::numeric::int, reorder_level),
    photo_path = CASE WHEN _data ? 'photo_path' THEN NULLIF(_data->>'photo_path', '') ELSE photo_path END
  WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.remove_product(_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.products WHERE id = _id;
  IF v_shop IS NULL OR NOT public.is_shop_owner(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.sale_items WHERE product_id = _id) OR EXISTS (SELECT 1 FROM public.supplier_products WHERE product_id = _id) THEN
    UPDATE public.products SET archived_at = now() WHERE id = _id; RETURN 'archived';
  END IF;
  DELETE FROM public.products WHERE id = _id; RETURN 'deleted';
END $$;

CREATE OR REPLACE FUNCTION public.record_sale(_payment_method text, _amount_tendered numeric, _customer_id uuid, _items jsonb)
 RETURNS TABLE(sale_id uuid, receipt_no text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_shop uuid := public.current_shop_id(); v_sale uuid := gen_random_uuid(); v_receipt text := 'R-' || upper(substr(replace(v_sale::text, '-', ''), 1, 12)); v_total numeric := 0; v_cost numeric := 0; v_item jsonb; v_product public.products%ROWTYPE; v_qty numeric;
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_member(v_shop) OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Invalid sale'; END IF;
  IF _payment_method NOT IN ('cash', 'ewallet', 'card') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF _customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.shop_id = v_shop AND c.anonymized_at IS NULL) THEN RAISE EXCEPTION 'Invalid customer'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := round((v_item->>'qty')::numeric, 3);
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop FOR UPDATE;
    IF v_product.id IS NULL OR v_product.archived_at IS NOT NULL OR v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid item'; END IF;
    IF v_product.unit NOT IN ('kg','g','L') AND v_qty <> trunc(v_qty) THEN RAISE EXCEPTION 'Whole quantities only for %', v_product.name; END IF;
    IF v_product.track_stock AND v_product.stock_qty < v_qty THEN RAISE EXCEPTION 'Not enough stock for %', v_product.name; END IF;
    v_total := v_total + round(v_product.price * v_qty, 2); v_cost := v_cost + round(v_product.cost * v_qty, 2);
  END LOOP;
  IF _payment_method = 'cash' AND COALESCE(_amount_tendered, 0) < v_total THEN RAISE EXCEPTION 'Amount received is too low'; END IF;
  INSERT INTO public.sales(id, user_id, shop_id, cashier_id, receipt_no, total, cost_total, payment_method, amount_tendered, customer_id)
  VALUES(v_sale, auth.uid(), v_shop, auth.uid(), v_receipt, v_total, v_cost, _payment_method, _amount_tendered, _customer_id);
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := round((v_item->>'qty')::numeric, 3);
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop;
    INSERT INTO public.sale_items(sale_id, user_id, shop_id, product_id, name, category, qty, quantity, price, cost)
    VALUES(v_sale, auth.uid(), v_shop, v_product.id, v_product.name, v_product.category, GREATEST(1, ceil(v_qty))::int, v_qty, v_product.price, v_product.cost);
    IF v_product.track_stock THEN UPDATE public.products SET stock_qty = stock_qty - v_qty WHERE id = v_product.id; END IF;
  END LOOP;
  RETURN QUERY SELECT v_sale, v_receipt;
END $function$;

CREATE OR REPLACE FUNCTION public.void_sale(_sale_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_sale public.sales%ROWTYPE; v_item public.sale_items%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR NOT public.is_shop_owner(v_sale.shop_id) OR v_sale.status <> 'completed' THEN RAISE EXCEPTION 'Sale cannot be voided'; END IF;
  UPDATE public.sales SET status = 'voided', voided_at = now(), voided_by = auth.uid() WHERE id = _sale_id;
  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    UPDATE public.products SET stock_qty = stock_qty + COALESCE(v_item.quantity, v_item.qty) WHERE id = v_item.product_id AND track_stock;
  END LOOP;
END $function$;

CREATE POLICY "members read product photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-photos' AND public.is_shop_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "editors upload product photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-photos' AND public.can_edit_products(((storage.foldername(name))[1])::uuid));
CREATE POLICY "owners delete product photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-photos' AND public.is_shop_owner(((storage.foldername(name))[1])::uuid));