ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_sale_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS synced_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_client_sale_uidx ON public.sales (shop_id, client_sale_id);
DROP FUNCTION IF EXISTS public.record_sale(text, numeric, uuid, jsonb);
CREATE FUNCTION public.record_sale(_payment_method text, _amount_tendered numeric, _customer_id uuid, _items jsonb, _client_sale_id uuid DEFAULT NULL, _client_created_at timestamptz DEFAULT NULL, _expected_total numeric DEFAULT NULL, _accept_price_change boolean DEFAULT false)
 RETURNS TABLE(sale_id uuid, receipt_no text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_shop uuid := public.current_shop_id(); v_sale uuid := gen_random_uuid(); v_receipt text := 'R-' || upper(substr(replace(v_sale::text, '-', ''), 1, 12)); v_total numeric := 0; v_cost numeric := 0; v_item jsonb; v_product public.products%ROWTYPE; v_qty numeric; v_at timestamptz := now(); v_existing public.sales%ROWTYPE;
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_member(v_shop) OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Invalid sale'; END IF;
  IF _payment_method NOT IN ('cash', 'ewallet', 'card') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF _client_sale_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_shop::text || ':' || _client_sale_id::text, 0));
    SELECT * INTO v_existing FROM public.sales s WHERE s.shop_id = v_shop AND s.client_sale_id = _client_sale_id;
    IF v_existing.id IS NOT NULL THEN RETURN QUERY SELECT v_existing.id, v_existing.receipt_no; RETURN; END IF;
  END IF;
  IF _client_created_at IS NOT NULL AND _client_created_at BETWEEN now() - interval '72 hours' AND now() + interval '5 minutes' THEN v_at := LEAST(_client_created_at, now()); END IF;
  IF _customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.shop_id = v_shop AND c.anonymized_at IS NULL) THEN RAISE EXCEPTION 'Invalid customer'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := round((v_item->>'qty')::numeric, 3);
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop FOR UPDATE;
    IF v_product.id IS NULL OR v_product.archived_at IS NOT NULL OR v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid item'; END IF;
    IF v_product.unit NOT IN ('kg','g','L') AND v_qty <> trunc(v_qty) THEN RAISE EXCEPTION 'Whole quantities only for %', v_product.name; END IF;
    IF v_product.track_stock AND v_product.stock_qty < v_qty THEN RAISE EXCEPTION 'Not enough stock: % (% left)', v_product.name, trim_scale(v_product.stock_qty); END IF;
    v_total := v_total + round(v_product.price * v_qty, 2); v_cost := v_cost + round(COALESCE(v_product.cost, 0) * v_qty, 2);
  END LOOP;
  IF _expected_total IS NOT NULL AND abs(v_total - _expected_total) >= 0.01 AND NOT COALESCE(_accept_price_change, false) THEN RAISE EXCEPTION 'PRICE_CHANGED:%:%', _expected_total, v_total; END IF;
  IF _payment_method = 'cash' AND COALESCE(_amount_tendered, 0) < (CASE WHEN COALESCE(_accept_price_change, false) AND _expected_total IS NOT NULL THEN LEAST(v_total, _expected_total) ELSE v_total END) THEN RAISE EXCEPTION 'Amount received is too low'; END IF;
  INSERT INTO public.sales(id, user_id, shop_id, cashier_id, receipt_no, total, cost_total, payment_method, amount_tendered, customer_id, client_sale_id, created_at, synced_at)
  VALUES(v_sale, auth.uid(), v_shop, auth.uid(), v_receipt, v_total, v_cost, _payment_method, _amount_tendered, _customer_id, _client_sale_id, v_at, CASE WHEN _client_created_at IS NOT NULL THEN now() END);
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := round((v_item->>'qty')::numeric, 3);
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop;
    INSERT INTO public.sale_items(sale_id, user_id, shop_id, product_id, name, category, qty, quantity, price, cost, created_at)
    VALUES(v_sale, auth.uid(), v_shop, v_product.id, v_product.name, v_product.category, GREATEST(1, ceil(v_qty))::int, v_qty, v_product.price, COALESCE(v_product.cost, 0), v_at);
    IF v_product.track_stock THEN UPDATE public.products SET stock_qty = stock_qty - v_qty WHERE id = v_product.id; END IF;
  END LOOP;
  RETURN QUERY SELECT v_sale, v_receipt;
END $function$;
REVOKE ALL ON FUNCTION public.record_sale(text, numeric, uuid, jsonb, uuid, timestamptz, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale(text, numeric, uuid, jsonb, uuid, timestamptz, numeric, boolean) TO authenticated, service_role;