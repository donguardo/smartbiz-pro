-- Patch 4a-1: the ONE plans table and the paying ACCOUNT. One plan per account (the paying owner), covering 1 / 3 / 5 shops,
-- with one Stripe customer per account. Plans and accounts are written only by the server (webhook / SECURITY DEFINER); browsers read.
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan text PRIMARY KEY CHECK (plan IN ('basic','standard','pro')),
  label text NOT NULL,
  monthly_price_php numeric(10,2) NOT NULL,
  stripe_lookup_key text UNIQUE,  -- Stripe TEST price lookup key (Jorjan creates the prices)
  stripe_price_id text UNIQUE,    -- optional; matched too when a price has no lookup key
  max_stores int,                 -- shops per ACCOUNT: 1 / 3 / 5 (enforced in Patch 4b); NULL = unlimited
  max_skus int,                   -- active products PER SHOP (Don, Oct 8); NULL = unlimited
  ai_menu_builder boolean NOT NULL DEFAULT false,
  animated_pages int,             -- menu pages PER SHOP: 0 = none, NULL = unlimited
  basic_pdf_max_pages int,        -- printable menu page cap: Basic 12 (Don, Oct 8); NULL = no cap
  ai_menu_runs_per_day int NOT NULL DEFAULT 0,  -- per shop
  ml_smart_reorder boolean NOT NULL DEFAULT false,  -- "Best orders list": Standard/Pro only (Don, Oct 8)
  brand_ads boolean NOT NULL DEFAULT false,         -- Basic shows brand ad slots
  support_level text NOT NULL DEFAULT 'email_2d' CHECK (support_level IN ('email_2d','chat_1d','priority_same_day')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.plan_limits (plan, label, monthly_price_php, stripe_lookup_key, max_stores, max_skus, ai_menu_builder, animated_pages, basic_pdf_max_pages, ai_menu_runs_per_day, ml_smart_reorder, brand_ads, support_level) VALUES
  ('basic',    'Basic',    499,  'bizmanager_basic_monthly',    1, 500,  false, 0,    12,   0,   false, true,  'email_2d'),
  ('standard', 'Standard', 999,  'bizmanager_standard_monthly', 3, 999,  true,  24,   NULL, 50,  true,  false, 'chat_1d'),
  ('pro',      'Pro',      1499, 'bizmanager_pro_monthly',      5, NULL, true,  NULL, NULL, 200, true,  false, 'priority_same_day')
ON CONFLICT (plan) DO NOTHING;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT ALL ON public.plan_limits TO service_role;
DROP POLICY IF EXISTS "signed-in users read plan limits" ON public.plan_limits;
CREATE POLICY "signed-in users read plan limits" ON public.plan_limits FOR SELECT TO authenticated USING (true);

-- The paying account: one per owner. The trial clock and the Stripe customer live here, not on a shop,
-- so a 2nd or 3rd shop (Patch 4b) shares the plan and never restarts the trial.
CREATE TABLE IF NOT EXISTS public.business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_accounts TO authenticated;   -- no browser INSERT/UPDATE/DELETE
GRANT ALL ON public.business_accounts TO service_role;
DROP POLICY IF EXISTS "owners read their account" ON public.business_accounts;
CREATE POLICY "owners read their account" ON public.business_accounts FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

-- Internal: find or create a user's account. Never callable from the browser.
CREATE OR REPLACE FUNCTION public.ensure_business_account(_user uuid, _since timestamptz DEFAULT now())
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF _user IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.business_accounts(owner_user_id, trial_started_at) VALUES (_user, LEAST(COALESCE(_since, now()), now()))
  ON CONFLICT (owner_user_id) DO NOTHING;
  SELECT id INTO v_id FROM public.business_accounts WHERE owner_user_id = _user;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.ensure_business_account(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_business_account(uuid, timestamptz) TO service_role;

-- Each shop belongs to one account. Set only by the server, never by the browser.
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS business_account_id uuid REFERENCES public.business_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS shops_business_account_idx ON public.shops(business_account_id, created_at);

-- Backfill: one account per shop's FIRST owner (the same owner rule as webhook.ts:38). Trial clock = that owner's oldest shop.
INSERT INTO public.business_accounts(owner_user_id, trial_started_at, stripe_customer_id)
SELECT o.user_id, min(s.created_at),
       (array_agg(s.stripe_customer_id ORDER BY s.created_at) FILTER (WHERE s.stripe_customer_id IS NOT NULL))[1]
FROM public.shops s
JOIN LATERAL (SELECT sm.user_id FROM public.shop_members sm WHERE sm.shop_id = s.id AND sm.role = 'owner' ORDER BY sm.created_at LIMIT 1) o ON true
GROUP BY o.user_id
ON CONFLICT (owner_user_id) DO NOTHING;
UPDATE public.shops s SET business_account_id = a.id
FROM public.business_accounts a
WHERE s.business_account_id IS NULL
  AND a.owner_user_id = (SELECT sm.user_id FROM public.shop_members sm WHERE sm.shop_id = s.id AND sm.role = 'owner' ORDER BY sm.created_at LIMIT 1);

-- New shops: a signed-in creator's shop always joins the creator's own account (ensure_my_shop today, create_additional_store in 4b).
CREATE OR REPLACE FUNCTION public.shops_set_business_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.business_account_id := public.ensure_business_account(auth.uid()); END IF;
  RETURN NEW;
END $$;
-- A shop created by the server without a signed-in user joins its first owner's account when that owner is added.
CREATE OR REPLACE FUNCTION public.shop_members_link_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.role = 'owner' THEN
    UPDATE public.shops s SET business_account_id = public.ensure_business_account(NEW.user_id, s.created_at)
     WHERE s.id = NEW.shop_id AND s.business_account_id IS NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shops_set_business_account(), public.shop_members_link_account() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shops_set_business_account ON public.shops;
CREATE TRIGGER shops_set_business_account BEFORE INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION public.shops_set_business_account();
DROP TRIGGER IF EXISTS shop_members_link_account ON public.shop_members;
CREATE TRIGGER shop_members_link_account AFTER INSERT ON public.shop_members FOR EACH ROW EXECUTE FUNCTION public.shop_members_link_account();

-- F1 (0031_0034) now also protects business_account_id from browser updates.
CREATE OR REPLACE FUNCTION public.shops_protect_server_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Browser calls run as 'authenticated'/'anon'. SECURITY DEFINER functions, service_role and the SQL editor are not affected.
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.business_account_id IS DISTINCT FROM OLD.business_account_id) THEN
    RAISE EXCEPTION 'This shop field can only be changed by the server';
  END IF;
  RETURN NEW;
END $$;

-- The plan lives on the subscription row (written only by the webhook through service_role), per payments environment.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.business_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic' REFERENCES public.plan_limits(plan);
-- A downgrade booked in the Stripe portal waits for the end of the paid month. Display only: the plan in force is subscriptions.plan.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS pending_plan text REFERENCES public.plan_limits(plan);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS pending_plan_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_subscriptions_account ON public.subscriptions(account_id, environment);

-- Lookup key (or price id) -> plan. The old single price 'bizmanager_monthly' and anything unknown are Basic.
CREATE OR REPLACE FUNCTION public.plan_for_lookup_key(_key text)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT pl.plan FROM public.plan_limits pl WHERE pl.stripe_lookup_key = _key OR pl.stripe_price_id = _key LIMIT 1), 'basic')
$$;
REVOKE ALL ON FUNCTION public.plan_for_lookup_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_for_lookup_key(text) TO service_role;

-- The database, not the webhook code, turns the saved price into the plan, and links the row to the account.
CREATE OR REPLACE FUNCTION public.subscriptions_set_plan_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.price_id IS DISTINCT FROM OLD.price_id THEN NEW.plan := public.plan_for_lookup_key(NEW.price_id); END IF;
  IF NEW.account_id IS NULL THEN
    NEW.account_id := COALESCE((SELECT s.business_account_id FROM public.shops s WHERE s.id = NEW.shop_id),
                               (SELECT a.id FROM public.business_accounts a WHERE a.owner_user_id = NEW.user_id));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.subscriptions_set_plan_account() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS subscriptions_set_plan_account ON public.subscriptions;
CREATE TRIGGER subscriptions_set_plan_account BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.subscriptions_set_plan_account();
UPDATE public.subscriptions x SET plan = public.plan_for_lookup_key(x.price_id),
  account_id = COALESCE(x.account_id, (SELECT s.business_account_id FROM public.shops s WHERE s.id = x.shop_id),
                        (SELECT a.id FROM public.business_accounts a WHERE a.owner_user_id = x.user_id));
-- Account owners read their account's subscriptions (the 0023 policy stays for the per-shop rows).
DROP POLICY IF EXISTS "Account owners read account subscriptions" ON public.subscriptions;
CREATE POLICY "Account owners read account subscriptions" ON public.subscriptions FOR SELECT TO authenticated
  USING (account_id IS NOT NULL AND account_id IN (SELECT a.id FROM public.business_accounts a WHERE a.owner_user_id = auth.uid()));

-- Free trial: 14 days, no card, on Standard (Don, Oct 8). One trial per account.
INSERT INTO public.app_config(key, value) VALUES ('trial_plan', 'standard') ON CONFLICT (key) DO NOTHING;

-- INTERNAL (no browser access): the account's paid subscription in the current payments mode, newest first.
CREATE OR REPLACE FUNCTION public.account_paid_subscription(_account uuid)
RETURNS public.subscriptions LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT x.* FROM public.subscriptions x
   WHERE x.account_id = _account AND x.environment = public.payments_env() AND public.subscription_is_paid(x)
   ORDER BY x.created_at DESC LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.account_on_trial(_account uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT a.trial_started_at + interval '14 days' > now() FROM public.business_accounts a WHERE a.id = _account), false)
$$;
-- INTERNAL: the plan of the shop's account (paid plan, else the trial plan while the trial runs, else basic).
-- Shops not linked to an account (none after the backfill) keep the old per-shop rule.
CREATE OR REPLACE FUNCTION public.shop_plan_unchecked(_shop_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH s AS (SELECT id, business_account_id AS acc, created_at FROM public.shops WHERE id = _shop_id)
  SELECT COALESCE(
    (SELECT (public.account_paid_subscription(s.acc)).plan FROM s WHERE s.acc IS NOT NULL),
    (SELECT x.plan FROM public.subscriptions x, s WHERE s.acc IS NULL AND x.shop_id = s.id AND x.environment = public.payments_env()
       AND public.subscription_is_paid(x) ORDER BY x.created_at DESC LIMIT 1),
    (SELECT COALESCE((SELECT c.value FROM public.app_config c WHERE c.key = 'trial_plan'), 'standard') FROM s
      WHERE CASE WHEN s.acc IS NOT NULL THEN public.account_on_trial(s.acc) ELSE s.created_at + interval '14 days' > now() END),
    'basic')
$$;
CREATE OR REPLACE FUNCTION public.shop_has_access_unchecked(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _shop_id IS NOT NULL AND COALESCE((
    SELECT CASE WHEN s.business_account_id IS NOT NULL
      THEN public.account_on_trial(s.business_account_id) OR (public.account_paid_subscription(s.business_account_id)).id IS NOT NULL
      ELSE s.created_at + interval '14 days' > now()
        OR EXISTS (SELECT 1 FROM public.subscriptions x WHERE x.shop_id = s.id AND x.environment = public.payments_env() AND public.subscription_is_paid(x))
    END FROM public.shops s WHERE s.id = _shop_id), false)
$$;
REVOKE ALL ON FUNCTION public.account_paid_subscription(uuid), public.account_on_trial(uuid), public.shop_plan_unchecked(uuid), public.shop_has_access_unchecked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_paid_subscription(uuid), public.account_on_trial(uuid), public.shop_plan_unchecked(uuid), public.shop_has_access_unchecked(uuid) TO service_role;

-- Access is now per ACCOUNT (same signature and grants as 0030; every RLS policy keeps calling it).
-- Patch 4b adds the store limit here (shop #4 on a 3-shop plan = read-only). Jorjan owns this change; Data Security review.
CREATE OR REPLACE FUNCTION public.shop_has_access(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.shop_has_access_unchecked(_shop_id)
$$;

-- Browser-callable plan of a shop: members only (a signed-in user can't read another shop's plan by id). Server code (no user) sees all.
CREATE OR REPLACE FUNCTION public.shop_plan(_shop_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN auth.uid() IS NULL OR public.is_shop_member(_shop_id) THEN public.shop_plan_unchecked(_shop_id) END
$$;
REVOKE ALL ON FUNCTION public.shop_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_plan(uuid) TO authenticated, service_role;

-- Billing status for the caller's current shop, now read from the shop's ACCOUNT (same signature as 0030; any member can read it).
CREATE OR REPLACE FUNCTION public.get_shop_billing(_env text)
RETURNS TABLE(has_access boolean, state text, trial_ends_at timestamptz, period_end timestamptz, cancel_at_period_end boolean, is_owner boolean, env text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid := public.current_shop_id_raw(); v_acc uuid; v_trial timestamptz; v_s public.subscriptions%ROWTYPE; v_paid boolean := false; v_env text := public.payments_env();
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_member(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT s.business_account_id INTO v_acc FROM public.shops s WHERE s.id = v_shop;
  IF v_acc IS NOT NULL THEN
    SELECT a.trial_started_at + interval '14 days' INTO v_trial FROM public.business_accounts a WHERE a.id = v_acc;
    SELECT * INTO v_s FROM public.subscriptions s WHERE s.account_id = v_acc AND s.environment = v_env
     ORDER BY public.subscription_is_paid(s) DESC, s.created_at DESC LIMIT 1;
  ELSE
    SELECT created_at + interval '14 days' INTO v_trial FROM public.shops WHERE id = v_shop;
    SELECT * INTO v_s FROM public.subscriptions s WHERE s.shop_id = v_shop AND s.environment = v_env ORDER BY s.created_at DESC LIMIT 1;
  END IF;
  IF v_s.id IS NOT NULL THEN v_paid := public.subscription_is_paid(v_s); END IF;
  RETURN QUERY SELECT (v_paid OR v_trial > now()),
    CASE WHEN v_paid THEN v_s.status WHEN v_trial > now() THEN 'trial'
         WHEN v_s.status = 'past_due' THEN 'past_due_locked'
         WHEN v_s.id IS NOT NULL THEN 'expired' ELSE 'trial_ended' END,
    v_trial, v_s.current_period_end, COALESCE(v_s.cancel_at_period_end, false), public.is_shop_owner(v_shop), v_env;
END $$;

-- The caller's plan and limits for the UI (any member of the current shop; works while locked).
DROP FUNCTION IF EXISTS public.get_my_plan();
CREATE FUNCTION public.get_my_plan()
RETURNS TABLE(plan text, label text, monthly_price_php numeric, ai_menu_builder boolean, animated_pages int, basic_pdf_max_pages int,
              ai_menu_runs_per_day int, ml_smart_reorder boolean, brand_ads boolean, max_skus int, max_stores int, support_level text,
              on_trial boolean, trial_ends_at timestamptz, pending_plan text, pending_plan_at timestamptz,
              shops_in_account int, is_account_owner boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT public.current_shop_id_raw() AS shop),
  sh AS (SELECT s.id, s.business_account_id AS acc, s.created_at FROM public.shops s, me WHERE s.id = me.shop),
  a AS (SELECT ba.* FROM public.business_accounts ba, sh WHERE ba.id = sh.acc),
  sub AS (SELECT (public.account_paid_subscription(sh.acc)).* FROM sh WHERE sh.acc IS NOT NULL)
  SELECT pl.plan, pl.label, pl.monthly_price_php, pl.ai_menu_builder, pl.animated_pages, pl.basic_pdf_max_pages,
         pl.ai_menu_runs_per_day, pl.ml_smart_reorder, pl.brand_ads, pl.max_skus, pl.max_stores, pl.support_level,
         (NOT EXISTS (SELECT 1 FROM sub WHERE sub.id IS NOT NULL) AND COALESCE((SELECT a.trial_started_at FROM a), sh.created_at) + interval '14 days' > now()),
         COALESCE((SELECT a.trial_started_at FROM a), sh.created_at) + interval '14 days',
         (SELECT sub.pending_plan FROM sub), (SELECT sub.pending_plan_at FROM sub),
         COALESCE((SELECT count(*)::int FROM public.shops s2 WHERE s2.business_account_id = sh.acc), 1),
         COALESCE((SELECT a.owner_user_id = auth.uid() FROM a), false)
  FROM sh JOIN public.plan_limits pl ON pl.plan = public.shop_plan_unchecked(sh.id)
  WHERE public.is_shop_member(sh.id)
$$;
REVOKE ALL ON FUNCTION public.get_my_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_plan() TO authenticated;