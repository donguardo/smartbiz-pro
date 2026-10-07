-- Patch 4a-3: plan feature gates the server checks, plus usage numbers for the Billing page.
-- ML smart reorder ("Best orders list"): Standard/Pro only. The simple low-stock alerts and Reorders page stay on every plan.
-- Members only from the browser (a signed-in user can't probe another shop's plan); server code without a user sees all.
CREATE OR REPLACE FUNCTION public.shop_has_smart_reorder(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR public.is_shop_member(_shop_id))
     AND public.shop_has_access_unchecked(_shop_id)
     AND COALESCE((SELECT pl.ml_smart_reorder FROM public.plan_limits pl WHERE pl.plan = public.shop_plan_unchecked(_shop_id)), false)
$$;
-- Brand ad slot: a flag only (no ads table, no content until the brand ads spec is approved).
CREATE OR REPLACE FUNCTION public.shop_shows_brand_ads(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN auth.uid() IS NULL OR public.is_shop_member(_shop_id)
    THEN COALESCE((SELECT pl.brand_ads FROM public.plan_limits pl WHERE pl.plan = public.shop_plan_unchecked(_shop_id)), true) END
$$;
REVOKE ALL ON FUNCTION public.shop_has_smart_reorder(uuid), public.shop_shows_brand_ads(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_has_smart_reorder(uuid), public.shop_shows_brand_ads(uuid) TO authenticated, service_role;

-- "312 of 500 products" for the caller's own shop. Any member can read it; works while locked.
CREATE OR REPLACE FUNCTION public.get_my_usage()
RETURNS TABLE(plan text, active_products int, max_skus int, at_limit boolean, near_limit boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT public.current_shop_id_raw() AS shop),
  c AS (SELECT count(*)::int AS n FROM public.products p, me WHERE p.shop_id = me.shop AND p.archived_at IS NULL)
  SELECT pl.plan, c.n, pl.max_skus,
         pl.max_skus IS NOT NULL AND c.n >= pl.max_skus,
         pl.max_skus IS NOT NULL AND c.n >= ceil(pl.max_skus * 0.9)
  FROM me, c JOIN public.plan_limits pl ON pl.plan = public.shop_plan_unchecked((SELECT shop FROM me))
  WHERE me.shop IS NOT NULL AND public.is_shop_member(me.shop)
$$;
REVOKE ALL ON FUNCTION public.get_my_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_usage() TO authenticated;