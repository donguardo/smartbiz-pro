CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (key <> 'payments_env' OR value IN ('sandbox','live'))
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
INSERT INTO public.app_config(key, value) VALUES ('payments_env', 'sandbox') ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.payments_env()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT value FROM public.app_config WHERE key = 'payments_env'), 'sandbox')
$$;
REVOKE ALL ON FUNCTION public.payments_env() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payments_env() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_payments_env()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.payments_env()
$$;
REVOKE ALL ON FUNCTION public.get_payments_env() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payments_env() TO authenticated;

-- Access counts only subscriptions from the site's own payments mode.
CREATE OR REPLACE FUNCTION public.shop_has_access(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _shop_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.created_at + interval '14 days' > now())
    OR EXISTS (SELECT 1 FROM public.subscriptions x WHERE x.shop_id = _shop_id AND x.environment = public.payments_env() AND (
      (x.status IN ('active','trialing','past_due') AND (x.current_period_end IS NULL OR x.current_period_end > now()))
      OR (x.status = 'canceled' AND x.current_period_end > now())))
  )
$$;

-- The browser no longer chooses the mode; _env is ignored, the server's payments_env() is used.
DROP FUNCTION public.get_shop_billing(text);
CREATE FUNCTION public.get_shop_billing(_env text)
RETURNS TABLE(has_access boolean, state text, trial_ends_at timestamptz, period_end timestamptz, cancel_at_period_end boolean, is_owner boolean, env text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid := public.current_shop_id_raw(); v_trial timestamptz; v_s public.subscriptions%ROWTYPE; v_paid boolean := false; v_env text := public.payments_env();
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_member(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT created_at + interval '14 days' INTO v_trial FROM public.shops WHERE id = v_shop;
  SELECT * INTO v_s FROM public.subscriptions s WHERE s.shop_id = v_shop AND s.environment = v_env ORDER BY s.created_at DESC LIMIT 1;
  IF v_s.id IS NOT NULL THEN
    v_paid := (v_s.status IN ('active','trialing','past_due') AND (v_s.current_period_end IS NULL OR v_s.current_period_end > now()))
           OR (v_s.status = 'canceled' AND v_s.current_period_end > now());
  END IF;
  RETURN QUERY SELECT (v_paid OR v_trial > now()),
    CASE WHEN v_paid THEN v_s.status WHEN v_trial > now() THEN 'trial' WHEN v_s.id IS NOT NULL THEN 'expired' ELSE 'trial_ended' END,
    v_trial, v_s.current_period_end, COALESCE(v_s.cancel_at_period_end, false), public.is_shop_owner(v_shop), v_env;
END $$;