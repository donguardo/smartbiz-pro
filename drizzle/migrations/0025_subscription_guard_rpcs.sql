CREATE OR REPLACE FUNCTION public.update_product(_id uuid, _data jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.products WHERE id = _id;
  IF v_shop IS NULL OR v_shop IS DISTINCT FROM public.current_shop_id() OR NOT public.can_edit_products(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.products SET
    name = COALESCE(_data->>'name', name), category = COALESCE(_data->>'category', category),
    sku = COALESCE(_data->>'sku', sku), price = COALESCE((_data->>'price')::numeric, price),
    cost = CASE WHEN _data ? 'cost' THEN (_data->>'cost')::numeric ELSE cost END, unit = COALESCE(_data->>'unit', unit),
    track_stock = COALESCE((_data->>'track_stock')::boolean, track_stock),
    stock_qty = COALESCE((_data->>'stock_qty')::numeric, stock_qty),
    reorder_level = COALESCE((_data->>'reorder_level')::numeric::int, reorder_level),
    photo_path = CASE WHEN _data ? 'photo_path' THEN NULLIF(_data->>'photo_path', '') ELSE photo_path END
  WHERE id = _id;
END $function$;

CREATE OR REPLACE FUNCTION public.remove_product(_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.products WHERE id = _id;
  IF v_shop IS NULL OR NOT public.is_shop_owner(v_shop) OR NOT public.shop_has_access(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.sale_items WHERE product_id = _id) OR EXISTS (SELECT 1 FROM public.supplier_products WHERE product_id = _id) OR EXISTS (SELECT 1 FROM public.stock_movements WHERE product_id = _id) THEN
    UPDATE public.products SET archived_at = now() WHERE id = _id; RETURN 'archived';
  END IF;
  DELETE FROM public.products WHERE id = _id; RETURN 'deleted';
END $function$;

CREATE OR REPLACE FUNCTION public.adjust_stock(_product_id uuid, _kind text, _qty numeric, _reason text)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_p public.products%ROWTYPE; v_after numeric; v_name text;
BEGIN
  SELECT * INTO v_p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF v_p.id IS NULL OR v_p.shop_id IS DISTINCT FROM public.current_shop_id() OR NOT public.is_shop_owner(v_p.shop_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT v_p.track_stock THEN RAISE EXCEPTION 'This product does not track stock'; END IF;
  IF _kind NOT IN ('restock','loss','correction') THEN RAISE EXCEPTION 'Invalid adjustment type'; END IF;
  IF char_length(trim(COALESCE(_reason, ''))) < 3 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  _qty := round(_qty, 3);
  IF _qty IS NULL OR _qty < 0 OR (_kind <> 'correction' AND _qty = 0) THEN RAISE EXCEPTION 'Enter a quantity above 0'; END IF;
  IF v_p.unit NOT IN ('kg','g','L') AND _qty <> trunc(_qty) THEN RAISE EXCEPTION 'Decimals are only allowed for kg, g or L'; END IF;
  v_after := CASE _kind WHEN 'restock' THEN v_p.stock_qty + _qty WHEN 'loss' THEN v_p.stock_qty - _qty ELSE _qty END;
  IF v_after < 0 THEN RAISE EXCEPTION 'Stock cannot go below 0'; END IF;
  UPDATE public.products SET stock_qty = v_after WHERE id = _product_id;
  SELECT COALESCE(NULLIF(trim(full_name), ''), auth.jwt()->>'email', 'Owner') INTO v_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.stock_movements(shop_id, product_id, product_name, kind, qty_change, stock_before, stock_after, reason, created_by, actor_name)
  VALUES (v_p.shop_id, v_p.id, v_p.name, _kind, v_after - v_p.stock_qty, v_p.stock_qty, v_after, trim(_reason), auth.uid(), COALESCE(v_name, auth.jwt()->>'email', 'Owner'));
  RETURN v_after;
END $function$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(_order_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_o public.purchase_orders%ROWTYPE; v_i public.purchase_order_items%ROWTYPE;
BEGIN
  SELECT * INTO v_o FROM public.purchase_orders WHERE id = _order_id FOR UPDATE;
  IF v_o.id IS NULL OR v_o.shop_id IS DISTINCT FROM public.current_shop_id() OR NOT public.is_shop_owner(v_o.shop_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_o.status NOT IN ('draft','sent') THEN RAISE EXCEPTION 'This order is already %', v_o.status; END IF;
  FOR v_i IN SELECT * FROM public.purchase_order_items WHERE order_id = _order_id LOOP
    PERFORM public.adjust_stock(v_i.product_id, 'restock', v_i.qty, 'Received supplier order ' || left(_order_id::text, 8));
  END LOOP;
  UPDATE public.purchase_orders SET status = 'received', received_at = now(), updated_at = now() WHERE id = _order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.void_sale(_sale_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_sale public.sales%ROWTYPE; v_item public.sale_items%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR NOT public.is_shop_owner(v_sale.shop_id) OR NOT public.shop_has_access(v_sale.shop_id) OR v_sale.status <> 'completed' THEN RAISE EXCEPTION 'Sale cannot be voided'; END IF;
  UPDATE public.sales SET status = 'voided', voided_at = now(), voided_by = auth.uid() WHERE id = _sale_id;
  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    UPDATE public.products SET stock_qty = stock_qty + COALESCE(v_item.quantity, v_item.qty) WHERE id = v_item.product_id AND track_stock;
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.anonymize_customer(_customer_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.customers SET name = 'Deleted customer', mobile = NULL, consent_at = NULL, anonymized_at = now(), updated_at = now()
  WHERE id = _customer_id AND public.is_shop_owner(shop_id) AND public.shop_has_access(shop_id);
END $function$;