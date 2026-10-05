ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS owner_name text, ADD COLUMN IF NOT EXISTS mobile text, ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE public.products ALTER COLUMN cost DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN cost DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.ensure_my_shop(_business_name text DEFAULT 'My Store'::text)
 RETURNS TABLE(shop_id uuid, role shop_role) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_shop uuid; v_meta jsonb := COALESCE(auth.jwt()->'user_metadata', '{}'::jsonb); v_mobile text; v_type text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT public.current_shop_id() INTO v_shop;
  IF v_shop IS NULL THEN
    -- Only ever creates a brand-new shop owned by the caller; never joins an existing one.
    v_shop := v_user;
    v_mobile := CASE WHEN (v_meta->>'mobile') ~ '^09[0-9]{9}$' THEN v_meta->>'mobile' END;
    v_type := CASE WHEN (v_meta->>'business_type') IN ('Sari-sari','Food','Retail','Services','Laundry','Hardware','Bakery','Other') THEN v_meta->>'business_type' END;
    INSERT INTO public.shops(id, name, owner_name, mobile, business_type)
    VALUES (v_shop, COALESCE(NULLIF(trim(_business_name), ''), NULLIF(trim(v_meta->>'business_name'), ''), 'My Store'), left(NULLIF(trim(v_meta->>'owner_name'), ''), 80), v_mobile, v_type)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.shop_members(shop_id, user_id, role) VALUES (v_shop, v_user, 'owner') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET full_name = COALESCE(full_name, left(NULLIF(trim(v_meta->>'owner_name'), ''), 80)) WHERE id = v_user;
  END IF;
  UPDATE public.profiles SET shop_id = v_shop WHERE id = v_user;
  RETURN QUERY SELECT v_shop, sm.role FROM public.shop_members sm WHERE sm.shop_id = v_shop AND sm.user_id = v_user;
END $function$;

CREATE OR REPLACE FUNCTION public.products_before_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner boolean;
BEGIN
  NEW.name := trim(NEW.name); NEW.sku := COALESCE(trim(NEW.sku), ''); NEW.category := COALESCE(NULLIF(trim(NEW.category), ''), 'General');
  IF NEW.unit NOT IN ('pc','pack','kg','g','L','service') THEN RAISE EXCEPTION 'Invalid unit'; END IF;
  IF NEW.price < 0 OR NEW.cost < 0 THEN RAISE EXCEPTION 'Price and cost cannot be negative'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock_qty = 0 AND NEW.stock <> 0 THEN NEW.stock_qty := NEW.stock; END IF;
  ELSIF NEW.stock_qty IS NOT DISTINCT FROM OLD.stock_qty AND NEW.stock IS DISTINCT FROM OLD.stock THEN
    NEW.stock_qty := NEW.stock;
  END IF;
  IF NOT NEW.track_stock THEN NEW.stock_qty := 0; END IF;
  IF NEW.stock_qty < 0 THEN RAISE EXCEPTION 'Stock cannot go below 0'; END IF;
  IF NEW.unit NOT IN ('kg','g','L') AND NEW.stock_qty <> trunc(NEW.stock_qty) THEN RAISE EXCEPTION 'Decimals are only allowed for kg, g or L'; END IF;
  NEW.stock := floor(NEW.stock_qty)::int;
  IF auth.uid() IS NOT NULL THEN
    v_owner := public.is_shop_owner(NEW.shop_id);
    IF NOT v_owner THEN
      IF TG_OP = 'INSERT' THEN NEW.archived_at := NULL; NEW.cost := NULL;
      ELSE NEW.archived_at := OLD.archived_at; NEW.cost := OLD.cost; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.update_product(_id uuid, _data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.products WHERE id = _id;
  IF v_shop IS NULL OR v_shop <> public.current_shop_id() OR NOT public.can_edit_products(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.products SET
    name = COALESCE(_data->>'name', name), category = COALESCE(_data->>'category', category),
    sku = COALESCE(_data->>'sku', sku), price = COALESCE((_data->>'price')::numeric, price),
    cost = CASE WHEN _data ? 'cost' THEN (_data->>'cost')::numeric ELSE cost END, unit = COALESCE(_data->>'unit', unit),
    track_stock = COALESCE((_data->>'track_stock')::boolean, track_stock),
    stock_qty = COALESCE((_data->>'stock_qty')::numeric, stock_qty),
    reorder_level = COALESCE((_data->>'reorder_level')::numeric::int, reorder_level),
    photo_path = CASE WHEN _data ? 'photo_path' THEN NULLIF(_data->>'photo_path', '') ELSE photo_path END
  WHERE id = _id;
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
    IF v_product.track_stock AND v_product.stock_qty < v_qty THEN RAISE EXCEPTION 'Not enough stock: % (% left)', v_product.name, trim_scale(v_product.stock_qty); END IF;
    v_total := v_total + round(v_product.price * v_qty, 2); v_cost := v_cost + round(COALESCE(v_product.cost, 0) * v_qty, 2);
  END LOOP;
  IF _payment_method = 'cash' AND COALESCE(_amount_tendered, 0) < v_total THEN RAISE EXCEPTION 'Amount received is too low'; END IF;
  INSERT INTO public.sales(id, user_id, shop_id, cashier_id, receipt_no, total, cost_total, payment_method, amount_tendered, customer_id)
  VALUES(v_sale, auth.uid(), v_shop, auth.uid(), v_receipt, v_total, v_cost, _payment_method, _amount_tendered, _customer_id);
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := round((v_item->>'qty')::numeric, 3);
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop;
    INSERT INTO public.sale_items(sale_id, user_id, shop_id, product_id, name, category, qty, quantity, price, cost)
    VALUES(v_sale, auth.uid(), v_shop, v_product.id, v_product.name, v_product.category, GREATEST(1, ceil(v_qty))::int, v_qty, v_product.price, COALESCE(v_product.cost, 0));
    IF v_product.track_stock THEN UPDATE public.products SET stock_qty = stock_qty - v_qty WHERE id = v_product.id; END IF;
  END LOOP;
  RETURN QUERY SELECT v_sale, v_receipt;
END $function$;