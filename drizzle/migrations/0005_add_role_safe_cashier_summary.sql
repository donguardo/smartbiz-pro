CREATE OR REPLACE FUNCTION public.get_cashier_today_summary()
RETURNS TABLE(today_total numeric, sale_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(s.total), 0)::numeric, COUNT(*)::bigint
  FROM public.sales s
  WHERE s.shop_id = public.current_shop_id()
    AND public.is_shop_member(s.shop_id)
    AND s.status = 'completed'
    AND (s.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date;
$$;
GRANT EXECUTE ON FUNCTION public.get_cashier_today_summary() TO authenticated;
REVOKE ALL ON FUNCTION public.get_cashier_today_summary() FROM anon;