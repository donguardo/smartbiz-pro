CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  paddle_subscription_id text NOT NULL UNIQUE,
  paddle_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_shop ON public.subscriptions(shop_id, environment);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their shop subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (shop_id IS NOT NULL AND public.is_shop_owner(shop_id)));

-- Billing status for the caller's current shop. Any member can read it so cashiers inherit the owner's plan.
CREATE OR REPLACE FUNCTION public.get_shop_billing(_env text)
RETURNS TABLE(has_access boolean, state text, trial_ends_at timestamptz, period_end timestamptz, cancel_at_period_end boolean, is_owner boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid := public.current_shop_id(); v_trial timestamptz; v_s public.subscriptions%ROWTYPE; v_paid boolean := false;
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_member(v_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _env NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
  SELECT created_at + interval '14 days' INTO v_trial FROM public.shops WHERE id = v_shop;
  SELECT * INTO v_s FROM public.subscriptions s WHERE s.shop_id = v_shop AND s.environment = _env ORDER BY s.created_at DESC LIMIT 1;
  IF v_s.id IS NOT NULL THEN
    v_paid := (v_s.status IN ('active','trialing','past_due') AND (v_s.current_period_end IS NULL OR v_s.current_period_end > now()))
           OR (v_s.status = 'canceled' AND v_s.current_period_end > now());
  END IF;
  RETURN QUERY SELECT (v_paid OR v_trial > now()),
    CASE WHEN v_paid THEN v_s.status WHEN v_trial > now() THEN 'trial' WHEN v_s.id IS NOT NULL THEN 'expired' ELSE 'trial_ended' END,
    v_trial, v_s.current_period_end, COALESCE(v_s.cancel_at_period_end, false), public.is_shop_owner(v_shop);
END $$;
REVOKE ALL ON FUNCTION public.get_shop_billing(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_billing(text) TO authenticated;