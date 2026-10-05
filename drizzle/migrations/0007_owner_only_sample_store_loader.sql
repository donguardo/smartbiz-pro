CREATE OR REPLACE FUNCTION public.seed_sample_store()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop uuid := public.current_shop_id();
  v_user uuid := auth.uid();
  v_product_ids uuid[];
  v_product public.products%ROWTYPE;
  v_sale uuid;
  v_day integer;
  v_sale_no integer;
  v_qty integer;
  v_at timestamptz;
  v_method text;
BEGIN
  IF v_user IS NULL OR v_shop IS NULL OR NOT public.is_shop_owner(v_shop) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE shop_id = v_shop) THEN
    RAISE EXCEPTION 'Sample store can only be loaded into an empty shop';
  END IF;

  INSERT INTO public.products (user_id, shop_id, name, sku, category, price, cost, stock, reorder_level)
  VALUES
    (v_user, v_shop, 'Coca-Cola 1.5L', '4801981116072', 'Beverages', 75, 58, 500, 12),
    (v_user, v_shop, 'Nescafé 3-in-1 (10s)', '4800361386553', 'Beverages', 85, 66, 500, 10),
    (v_user, v_shop, 'Bottled Water 500ml', '4800016644201', 'Beverages', 20, 11, 500, 24),
    (v_user, v_shop, 'Piattos Cheese 85g', '4800016555101', 'Snacks', 35, 24, 500, 15),
    (v_user, v_shop, 'SkyFlakes Crackers', '4800092110010', 'Snacks', 48, 34, 500, 10),
    (v_user, v_shop, 'Lucky Me Pancit Canton', '4807770270017', 'Snacks', 18, 12, 500, 30),
    (v_user, v_shop, 'Safeguard Bar 135g', '4800888141125', 'Personal care', 48, 36, 500, 8),
    (v_user, v_shop, 'Colgate 150ml', '8850006330418', 'Personal care', 115, 88, 500, 6),
    (v_user, v_shop, 'Joy Dishwashing 250ml', '4800888170019', 'Household', 62, 45, 500, 6),
    (v_user, v_shop, 'Tide Powder 1kg', '4800888200011', 'Household', 165, 128, 500, 5),
    (v_user, v_shop, 'Scented Candles Set', 'SKU-CANDLE-01', 'Household', 250, 140, 15, 3);

  SELECT array_agg(id ORDER BY sku) INTO v_product_ids
  FROM public.products
  WHERE shop_id = v_shop AND sku <> 'SKU-CANDLE-01';

  FOR v_day IN REVERSE 20..0 LOOP
    FOR v_sale_no IN 1..4 LOOP
      SELECT * INTO v_product
      FROM public.products
      WHERE id = v_product_ids[((v_day * 4 + v_sale_no - 1) % array_length(v_product_ids, 1)) + 1];
      v_qty := ((v_day + v_sale_no) % 3) + 1;
      v_at := now() - make_interval(days => v_day) - make_interval(hours => (v_sale_no * 2));
      v_method := (ARRAY['cash', 'ewallet', 'card'])[((v_day + v_sale_no) % 3) + 1];
      v_sale := gen_random_uuid();

      INSERT INTO public.sales (id, user_id, shop_id, cashier_id, receipt_no, total, cost_total, payment_method, amount_tendered, created_at)
      VALUES (v_sale, v_user, v_shop, v_user, 'S-' || upper(substr(replace(v_sale::text, '-', ''), 1, 12)), v_product.price * v_qty, v_product.cost * v_qty, v_method, CASE WHEN v_method = 'cash' THEN v_product.price * v_qty ELSE NULL END, v_at);

      INSERT INTO public.sale_items (sale_id, user_id, shop_id, product_id, name, category, qty, price, cost, created_at)
      VALUES (v_sale, v_user, v_shop, v_product.id, v_product.name, v_product.category, v_qty, v_product.price, v_product.cost, v_at);
    END LOOP;
  END LOOP;

  UPDATE public.products SET stock = CASE sku
    WHEN '4801981116072' THEN 6 WHEN '4800361386553' THEN 30 WHEN '4800016644201' THEN 80
    WHEN '4800016555101' THEN 40 WHEN '4800092110010' THEN 3 WHEN '4807770270017' THEN 120
    WHEN '4800888141125' THEN 22 WHEN '8850006330418' THEN 14 WHEN '4800888170019' THEN 18
    WHEN '4800888200011' THEN 25 WHEN 'SKU-CANDLE-01' THEN 15 ELSE stock END
  WHERE shop_id = v_shop;
END
$$;

REVOKE ALL ON FUNCTION public.seed_sample_store() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_sample_store() FROM anon;
GRANT EXECUTE ON FUNCTION public.seed_sample_store() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_sample_store() TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.sales FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sale_items FROM anon, authenticated;