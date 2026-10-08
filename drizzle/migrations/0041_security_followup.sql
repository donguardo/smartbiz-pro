-- Patch 4c (migration 0041): Data Security follow-up to Patch 4a (A1, A2, A3), the BIZBOT rate limit (F7),
-- and the DS re-review addendum (N1 admins by user id only, N2 stop-switch grants).
-- No signature changes, no data rewritten. Safe to run twice. Works with the published app code as it is today.

-- A1: shop_has_access answers only for the caller's own shops. Server code with no signed-in user
-- (service role, SQL editor, cron, webhook) still sees every shop. Same name, signature and grants,
-- because every RLS policy calls it as the signed-in user (a private copy + REVOKE would break them).
CREATE OR REPLACE FUNCTION public.shop_has_access(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR public.is_shop_member(_shop_id)) AND public.shop_has_access_unchecked(_shop_id)
$$;
REVOKE ALL ON FUNCTION public.shop_has_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_has_access(uuid) TO authenticated, service_role;

-- A2: browsers never write billing rows. RLS already refused the writes; this also removes the
-- Supabase default grants (table and column level) that 0023 and 0028 never revoked.
REVOKE ALL ON public.subscriptions, public.billing_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.subscriptions, public.billing_events FROM authenticated;
GRANT SELECT ON public.subscriptions, public.billing_events TO authenticated;
GRANT ALL ON public.subscriptions, public.billing_events TO service_role;
REVOKE ALL ON public.business_accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.business_accounts FROM authenticated;
-- Defense in depth on the paying account (F1 style): only the server may write it, even if a policy is added later.
-- SECURITY INVOKER on purpose: inside SECURITY DEFINER code (ensure_my_shop, the shops trigger) current_user is the owner, so sign-up still works.
CREATE OR REPLACE FUNCTION public.business_accounts_protect()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'This account field can only be changed by the server';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.business_accounts_protect() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS business_accounts_protect ON public.business_accounts;
CREATE TRIGGER business_accounts_protect BEFORE INSERT OR UPDATE OR DELETE ON public.business_accounts
  FOR EACH ROW EXECUTE FUNCTION public.business_accounts_protect();

-- A3: a browser insert always starts un-archived, so archived inserts can't skip the SKU cap.
-- The app archives only by UPDATE; the CSV import, the product form and the sample store never send archived_at.
CREATE OR REPLACE FUNCTION public.products_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_plan text; v_cap int; v_label text; v_count int;
BEGIN
  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN NEW.archived_at := NULL; END IF;
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

-- F7: BIZBOT per-user rate limit, daily quotas and a stop switch. Called by /api/public/bizbot as the signed-in user,
-- BEFORE the AI call, so failed or aborted replies still count. Limits live in app_config (Jorjan can change them).
CREATE TABLE IF NOT EXISTS public.bizbot_runs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bizbot_runs_user_idx ON public.bizbot_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bizbot_runs_created_idx ON public.bizbot_runs(created_at);
ALTER TABLE public.bizbot_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bizbot_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.bizbot_runs_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bizbot_runs TO service_role;
INSERT INTO public.app_config(key, value) VALUES
  ('bizbot_runs_per_user_minute', '6'), ('bizbot_runs_per_user_day', '60'), ('bizbot_runs_global_day', '1000')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bizbot_begin_run()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to chat with BIZBOT.'; END IF;
  -- Stop switch: the server sets this after a 402/403 from the AI gateway (same table and pattern as the logo generator).
  IF EXISTS (SELECT 1 FROM public.image_generation_access_state g WHERE g.id = 'bizbot' AND g.blocked) THEN
    RAISE EXCEPTION 'BIZBOT is not available right now. Please try again later.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('bizbot:' || v_user::text, 0));
  DELETE FROM public.bizbot_runs WHERE user_id = v_user AND created_at < now() - interval '2 days';
  IF (SELECT count(*) FROM public.bizbot_runs WHERE user_id = v_user AND created_at > now() - interval '1 minute')
     >= COALESCE((SELECT c.value::int FROM public.app_config c WHERE c.key = 'bizbot_runs_per_user_minute'), 6) THEN
    RAISE EXCEPTION 'Please wait a minute before asking BIZBOT again.';
  END IF;
  IF (SELECT count(*) FROM public.bizbot_runs WHERE user_id = v_user AND created_at > now() - interval '1 day')
     >= COALESCE((SELECT c.value::int FROM public.app_config c WHERE c.key = 'bizbot_runs_per_user_day'), 60) THEN
    RAISE EXCEPTION 'You have reached today''s BIZBOT limit. Please try again tomorrow.';
  END IF;
  IF (SELECT count(*) FROM public.bizbot_runs WHERE created_at > now() - interval '1 day')
     >= COALESCE((SELECT c.value::int FROM public.app_config c WHERE c.key = 'bizbot_runs_global_day'), 1000) THEN
    RAISE EXCEPTION 'BIZBOT is busy today. Please try again tomorrow.';
  END IF;
  INSERT INTO public.bizbot_runs(user_id) VALUES (v_user);
END $$;
REVOKE ALL ON FUNCTION public.bizbot_begin_run() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bizbot_begin_run() TO authenticated;

-- DS re-review addendum (Oct 8, 10:40 AM), appended as given (ds-review-4c-menu4/fix_4c_addendum.sql), plus the table comment below.
-- N1: admin = platform_admins.user_id only (DS M6-B1), now instead of waiting for M6 (0045), because the
--     existing view-only admin functions (0010: admin_shop_list shows every owner's e-mail) still accept the JWT e-mail.
CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
DROP POLICY IF EXISTS "Admins read own allowlist row" ON public.platform_admins;
CREATE POLICY "Admins read own allowlist row" ON public.platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());
-- N2: the stop-switch table now gates BIZBOT and the menu AI. Remove the Supabase default browser grants (RLS already refuses).
REVOKE ALL ON public.image_generation_access_state FROM PUBLIC, anon, authenticated;
-- N1 (doc): 0010's header comment says to seed admins by e-mail. That file is already applied, so it is not edited;
-- the corrected instruction lives on the table itself, where the Supabase dashboard shows it.
COMMENT ON TABLE public.platform_admins IS 'Platform admin allowlist. Seed by USER ID only, never by e-mail alone: INSERT INTO public.platform_admins (user_id, email, created_by) SELECT id, lower(email), ''sql_seed'' FROM auth.users WHERE lower(email) = lower(''ADMIN_EMAIL'') AND email_confirmed_at IS NOT NULL; (0041 N1 supersedes the 0010 header comment).';
