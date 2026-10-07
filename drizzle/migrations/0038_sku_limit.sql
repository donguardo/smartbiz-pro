-- Patch 4a-3: SKU cap PER SHOP (Basic 500, Standard 999, Pro unlimited). Blocks only NEW active products
-- (insert, or un-archive). Existing products over the cap keep selling and can be edited. Nothing is deleted.
CREATE OR REPLACE FUNCTION public.products_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_plan text; v_cap int; v_label text; v_count int;
BEGIN
  -- Service role, SQL editor and cron (no signed-in user) are not limited. Every browser call is.
  IF auth.uid() IS NULL OR NEW.shop_id IS NULL OR NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (OLD.archived_at IS NULL OR NEW.shop_id IS DISTINCT FROM OLD.shop_id) THEN RETURN NEW; END IF;
  v_plan := public.shop_plan_unchecked(NEW.shop_id);
  SELECT pl.max_skus, pl.label INTO v_cap, v_label FROM public.plan_limits pl WHERE pl.plan = v_plan;
  IF v_cap IS NULL THEN RETURN NEW; END IF;
  -- Two phones adding the 500th product at the same moment: only one wins.
  PERFORM pg_advisory_xact_lock(hashtextextended('products:' || NEW.shop_id::text, 0));
  SELECT count(*) INTO v_count FROM public.products p
   WHERE p.shop_id = NEW.shop_id AND p.archived_at IS NULL AND p.id IS DISTINCT FROM NEW.id;
  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'Your % plan allows % products per shop. Archive a product or upgrade to add more.', v_label, v_cap
      USING HINT = 'upgrade', ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.products_plan_limit() FROM PUBLIC, anon, authenticated;
-- Name sorts after products_zz_before_write (0017:58), so it sees the final archived_at
-- (cashiers can't un-archive; that trigger puts archived_at back first).
DROP TRIGGER IF EXISTS products_zzz_plan_limit ON public.products;
CREATE TRIGGER products_zzz_plan_limit BEFORE INSERT OR UPDATE OF archived_at, shop_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_plan_limit();