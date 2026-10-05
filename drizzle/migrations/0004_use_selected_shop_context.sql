CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.shop_id FROM public.profiles p JOIN public.shop_members sm ON sm.shop_id = p.shop_id AND sm.user_id = auth.uid() WHERE p.id = auth.uid()),
    (SELECT sm.shop_id FROM public.shop_members sm WHERE sm.user_id = auth.uid() ORDER BY sm.created_at LIMIT 1)
  )
$$;
GRANT EXECUTE ON FUNCTION public.current_shop_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_my_shop(_business_name text DEFAULT 'My Store')
RETURNS TABLE(shop_id uuid, role public.shop_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_shop uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT public.current_shop_id() INTO v_shop;
  IF v_shop IS NULL THEN
    v_shop := v_user;
    INSERT INTO public.shops(id, name) VALUES (v_shop, COALESCE(NULLIF(trim(_business_name), ''), 'My Store')) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.shop_members(shop_id, user_id, role) VALUES (v_shop, v_user, 'owner') ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.profiles SET shop_id = v_shop WHERE id = v_user;
  RETURN QUERY SELECT v_shop, sm.role FROM public.shop_members sm WHERE sm.shop_id = v_shop AND sm.user_id = v_user;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_shop_context()
RETURNS TABLE(shop_id uuid, shop_name text, member_role public.shop_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT s.id, s.name, sm.role FROM public.shop_members sm JOIN public.shops s ON s.id = sm.shop_id WHERE sm.user_id = auth.uid() AND sm.shop_id = public.current_shop_id() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.get_shop_products()
RETURNS TABLE(id uuid, shop_id uuid, name text, sku text, category text, price numeric, cost numeric, stock integer, reorder_level integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.shop_id, p.name, p.sku, p.category, p.price,
    CASE WHEN public.is_shop_owner(p.shop_id) THEN p.cost ELSE NULL END,
    p.stock, p.reorder_level, p.created_at
  FROM public.products p WHERE p.shop_id = public.current_shop_id() AND public.is_shop_member(p.shop_id) ORDER BY p.name
$$;

CREATE OR REPLACE FUNCTION public.get_masked_customers()
RETURNS TABLE(id uuid, name text, mobile text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name,
    CASE WHEN public.is_shop_owner(c.shop_id) THEN c.mobile
      WHEN c.mobile IS NULL THEN NULL
      ELSE left(c.mobile, 5) || '•• ••• ' || right(regexp_replace(c.mobile, '\D', '', 'g'), 4) END
  FROM public.customers c WHERE c.shop_id = public.current_shop_id() AND public.is_shop_member(c.shop_id) AND c.anonymized_at IS NULL ORDER BY c.name
$$;

CREATE OR REPLACE FUNCTION public.create_shop_customer(_name text, _mobile text, _consented boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid := public.current_shop_id(); v_id uuid;
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_member(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT _consented THEN RAISE EXCEPTION 'Customer consent is required'; END IF;
  IF char_length(trim(_name)) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF NULLIF(trim(_mobile), '') IS NOT NULL AND trim(_mobile) !~ '^\+63 9[0-9]{2} [0-9]{3} [0-9]{4}$' THEN RAISE EXCEPTION 'Use +63 9XX XXX XXXX format'; END IF;
  INSERT INTO public.customers(shop_id, name, mobile, consent_at, created_by) VALUES (v_shop, trim(_name), NULLIF(trim(_mobile), ''), now(), auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_shop_invite(_email text)
RETURNS TABLE(invite_id uuid, code text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid := public.current_shop_id(); v_invite public.shop_invites%ROWTYPE;
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_owner(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.shop_invites(shop_id, email, created_by) VALUES (v_shop, lower(trim(_email)), auth.uid()) RETURNING * INTO v_invite;
  RETURN QUERY SELECT v_invite.id, v_invite.code, v_invite.expires_at;
END $$;

CREATE OR REPLACE FUNCTION public.record_sale(_payment_method text, _amount_tendered numeric, _customer_id uuid, _items jsonb)
RETURNS TABLE(sale_id uuid, receipt_no text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid := public.current_shop_id(); v_sale uuid := gen_random_uuid(); v_receipt text := 'R-' || upper(substr(replace(v_sale::text, '-', ''), 1, 12)); v_total numeric := 0; v_cost numeric := 0; v_item jsonb; v_product public.products%ROWTYPE; v_qty integer;
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_member(v_shop) OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Invalid sale'; END IF;
  IF _payment_method NOT IN ('cash', 'ewallet', 'card') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF _customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.shop_id = v_shop AND c.anonymized_at IS NULL) THEN RAISE EXCEPTION 'Invalid customer'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'qty')::integer;
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop FOR UPDATE;
    IF v_product.id IS NULL OR v_qty <= 0 OR v_product.stock < v_qty THEN RAISE EXCEPTION 'Not enough stock'; END IF;
    v_total := v_total + v_product.price * v_qty; v_cost := v_cost + v_product.cost * v_qty;
  END LOOP;
  IF _payment_method = 'cash' AND COALESCE(_amount_tendered, 0) < v_total THEN RAISE EXCEPTION 'Amount received is too low'; END IF;
  INSERT INTO public.sales(id, user_id, shop_id, cashier_id, receipt_no, total, cost_total, payment_method, amount_tendered, customer_id)
  VALUES(v_sale, auth.uid(), v_shop, auth.uid(), v_receipt, v_total, v_cost, _payment_method, _amount_tendered, _customer_id);
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'qty')::integer;
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop;
    INSERT INTO public.sale_items(sale_id, user_id, shop_id, product_id, name, category, qty, price, cost)
    VALUES(v_sale, auth.uid(), v_shop, v_product.id, v_product.name, v_product.category, v_qty, v_product.price, v_product.cost);
    UPDATE public.products SET stock = stock - v_qty WHERE id = v_product.id;
  END LOOP;
  RETURN QUERY SELECT v_sale, v_receipt;
END $$;

REVOKE EXECUTE ON FUNCTION public.current_shop_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_my_shop(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_shop_context() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_shop_products() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_masked_customers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_shop_customer(text, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_shop_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_sale(text, numeric, uuid, jsonb) FROM anon;