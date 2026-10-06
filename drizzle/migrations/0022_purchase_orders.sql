CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','received','cancelled')),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz
);
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  unit text NOT NULL,
  qty numeric NOT NULL CHECK (qty > 0),
  unit_cost numeric CHECK (unit_cost IS NULL OR unit_cost >= 0),
  UNIQUE (order_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage purchase orders" ON public.purchase_orders FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id) AND (supplier_id IS NULL OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.shop_id = purchase_orders.shop_id)));
CREATE POLICY "owners manage purchase order items" ON public.purchase_order_items FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id)
  AND EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND o.shop_id = purchase_order_items.shop_id AND o.status = 'draft')
  AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.shop_id = purchase_order_items.shop_id));
CREATE TRIGGER purchase_orders_force_shop BEFORE INSERT OR UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.force_current_shop_id();
CREATE TRIGGER purchase_order_items_force_shop BEFORE INSERT OR UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.force_current_shop_id();

CREATE OR REPLACE FUNCTION public.create_reorder_from_alerts(_alert_ids uuid[], _supplier_id uuid DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid := public.current_shop_id(); v_order uuid; v_p public.products%ROWTYPE; v_qty numeric; v_cost numeric;
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_owner(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = _supplier_id AND shop_id = v_shop) THEN RAISE EXCEPTION 'Invalid supplier'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stock_alerts WHERE id = ANY(_alert_ids) AND shop_id = v_shop) THEN RAISE EXCEPTION 'No alerts selected'; END IF;
  INSERT INTO public.purchase_orders(shop_id, supplier_id, created_by) VALUES (v_shop, _supplier_id, auth.uid()) RETURNING id INTO v_order;
  FOR v_p IN SELECT p.* FROM public.products p WHERE p.shop_id = v_shop AND p.archived_at IS NULL AND p.track_stock
      AND p.id IN (SELECT product_id FROM public.stock_alerts WHERE id = ANY(_alert_ids) AND shop_id = v_shop) ORDER BY lower(p.name) LOOP
    v_qty := GREATEST(v_p.reorder_level * 2 - v_p.stock_qty, 1);
    IF v_p.unit NOT IN ('kg','g','L') THEN v_qty := ceil(v_qty); END IF;
    SELECT sp.cost_price INTO v_cost FROM public.supplier_products sp WHERE sp.supplier_id = _supplier_id AND sp.product_id = v_p.id AND sp.shop_id = v_shop;
    INSERT INTO public.purchase_order_items(order_id, shop_id, product_id, product_name, unit, qty, unit_cost)
    VALUES (v_order, v_shop, v_p.id, v_p.name, v_p.unit, v_qty, COALESCE(v_cost, v_p.cost));
    v_cost := NULL;
  END LOOP;
  UPDATE public.stock_alerts SET read_at = now() WHERE id = ANY(_alert_ids) AND shop_id = v_shop AND read_at IS NULL;
  RETURN v_order;
END $$;
REVOKE ALL ON FUNCTION public.create_reorder_from_alerts(uuid[], uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_reorder_from_alerts(uuid[], uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(_order_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_o public.purchase_orders%ROWTYPE; v_i public.purchase_order_items%ROWTYPE;
BEGIN
  SELECT * INTO v_o FROM public.purchase_orders WHERE id = _order_id FOR UPDATE;
  IF v_o.id IS NULL OR v_o.shop_id <> public.current_shop_id() OR NOT public.is_shop_owner(v_o.shop_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_o.status NOT IN ('draft','sent') THEN RAISE EXCEPTION 'This order is already %', v_o.status; END IF;
  FOR v_i IN SELECT * FROM public.purchase_order_items WHERE order_id = _order_id LOOP
    PERFORM public.adjust_stock(v_i.product_id, 'restock', v_i.qty, 'Received supplier order ' || left(_order_id::text, 8));
  END LOOP;
  UPDATE public.purchase_orders SET status = 'received', received_at = now(), updated_at = now() WHERE id = _order_id;
END $$;
REVOKE ALL ON FUNCTION public.receive_purchase_order(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid) TO authenticated;