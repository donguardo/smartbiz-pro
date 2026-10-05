-- Platform admin allowlist. Operators seed rows via SQL only:
--   insert into public.platform_admins (email, created_by) values (lower('YOUR_ADMIN_EMAIL'), 'sql_seed');
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL
);
CREATE INDEX platform_admins_email_idx ON public.platform_admins(email);
CREATE INDEX platform_admins_user_idx ON public.platform_admins(user_id);
REVOKE ALL ON public.platform_admins FROM anon, authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read own allowlist row" ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR email = lower(COALESCE(auth.jwt()->>'email', '')));

CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid() OR pa.email = lower(COALESCE(auth.jwt()->>'email', '')))
$$;

CREATE OR REPLACE FUNCTION public.assert_platform_admin_mfa() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF COALESCE(auth.jwt()->>'aal', '') <> 'aal2' THEN RAISE EXCEPTION 'MFA required'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_platform_totals()
RETURNS TABLE(shops bigint, users bigint, sales_count bigint, sales_total numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_platform_admin_mfa();
  RETURN QUERY SELECT (SELECT count(*) FROM public.shops), (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.sales WHERE status = 'completed'),
    (SELECT COALESCE(sum(total),0)::numeric FROM public.sales WHERE status = 'completed');
END $$;

CREATE OR REPLACE FUNCTION public.admin_signups_by_day()
RETURNS TABLE(day date, signups bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_platform_admin_mfa();
  RETURN QUERY SELECT d::date, (SELECT count(*) FROM public.profiles p WHERE (p.created_at AT TIME ZONE 'Asia/Manila')::date = d::date)
  FROM generate_series((now() AT TIME ZONE 'Asia/Manila')::date - 29, (now() AT TIME ZONE 'Asia/Manila')::date, '1 day') d ORDER BY 1;
END $$;

CREATE OR REPLACE FUNCTION public.admin_shop_list()
RETURNS TABLE(shop_id uuid, shop_name text, created_at timestamptz, owner_email text, staff_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_platform_admin_mfa();
  RETURN QUERY SELECT s.id, s.name, s.created_at,
    (SELECT u.email::text FROM public.shop_members sm JOIN auth.users u ON u.id = sm.user_id WHERE sm.shop_id = s.id AND sm.role = 'owner' ORDER BY sm.created_at LIMIT 1),
    (SELECT count(*) FROM public.shop_members sm WHERE sm.shop_id = s.id)
  FROM public.shops s ORDER BY s.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_refresh_runs()
RETURNS TABLE(id uuid, job text, status text, started_at timestamptz, finished_at timestamptz, shops_processed integer, error text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_platform_admin_mfa();
  RETURN QUERY SELECT r.id, r.job, r.status, r.started_at, r.finished_at, r.shops_processed, r.error FROM public.refresh_runs r ORDER BY r.started_at DESC LIMIT 20;
END $$;

CREATE OR REPLACE FUNCTION public.admin_account_deletions()
RETURNS TABLE(deleted_on date, deletions bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_platform_admin_mfa();
  RETURN QUERY SELECT a.deleted_on, count(*) FROM public.account_deletions a GROUP BY 1 ORDER BY 1 DESC LIMIT 60;
END $$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin(), public.assert_platform_admin_mfa(), public.admin_platform_totals(), public.admin_signups_by_day(), public.admin_shop_list(), public.admin_refresh_runs(), public.admin_account_deletions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(), public.admin_platform_totals(), public.admin_signups_by_day(), public.admin_shop_list(), public.admin_refresh_runs(), public.admin_account_deletions() TO authenticated;