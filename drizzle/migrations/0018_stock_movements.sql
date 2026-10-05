CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('restock','loss','correction')),
  qty_change numeric NOT NULL,
  stock_before numeric NOT NULL,
  stock_after numeric NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 300),
  created_by uuid NOT NULL,
  actor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_shop_created ON public.stock_movements (shop_id, created_at DESC);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));

CREATE OR REPLACE FUNCTION public.adjust_stock(_product_id uuid, _kind text, _qty numeric, _reason text)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_p public.products%ROWTYPE; v_after numeric; v_name text;
BEGIN
  SELECT * INTO v_p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF v_p.id IS NULL OR v_p.shop_id <> public.current_shop_id() OR NOT public.is_shop_owner(v_p.shop_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.adjust_stock(uuid, text, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, text, numeric, text) TO authenticated;