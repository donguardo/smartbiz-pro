ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_product_id_fkey, ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_shop_id_fkey, ADD CONSTRAINT stock_movements_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.remove_product(_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.products WHERE id = _id;
  IF v_shop IS NULL OR NOT public.is_shop_owner(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.sale_items WHERE product_id = _id) OR EXISTS (SELECT 1 FROM public.supplier_products WHERE product_id = _id) OR EXISTS (SELECT 1 FROM public.stock_movements WHERE product_id = _id) THEN
    UPDATE public.products SET archived_at = now() WHERE id = _id; RETURN 'archived';
  END IF;
  DELETE FROM public.products WHERE id = _id; RETURN 'deleted';
END $$;