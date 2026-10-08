CREATE TABLE public.cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  subscription_id uuid,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','approved','withdrawn','owner_cancelled')),
  admin_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cancellation_requests TO service_role;
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX cancellation_requests_one_open ON public.cancellation_requests(account_id) WHERE status IN ('pending','contacted');

-- Owner: the caller's own account (owner only) and its current paid subscription.
CREATE OR REPLACE FUNCTION public.my_owned_account() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.business_accounts WHERE owner_user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.my_owned_account() FROM public, anon;

CREATE OR REPLACE FUNCTION public.get_my_cancellation_request()
RETURNS TABLE(id uuid, status text, reason text, admin_note text, created_at timestamptz, decided_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.status, r.reason, r.admin_note, r.created_at, r.decided_at
    FROM public.cancellation_requests r
   WHERE r.account_id = public.my_owned_account()
   ORDER BY r.created_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.request_cancellation(_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _acc uuid := public.my_owned_account(); _sub public.subscriptions; _id uuid;
BEGIN
  IF _acc IS NULL THEN RAISE EXCEPTION 'Only the account owner can cancel'; END IF;
  _sub := public.account_paid_subscription(_acc);
  IF _sub.id IS NULL THEN RAISE EXCEPTION 'No active plan to cancel'; END IF;
  IF _sub.cancel_at_period_end THEN RAISE EXCEPTION 'This plan is already set to end'; END IF;
  IF EXISTS (SELECT 1 FROM public.cancellation_requests WHERE account_id = _acc AND status IN ('pending','contacted')) THEN
    RAISE EXCEPTION 'A cancellation request is already open';
  END IF;
  INSERT INTO public.cancellation_requests(account_id, requested_by, subscription_id, reason)
  VALUES (_acc, auth.uid(), _sub.id, left(nullif(btrim(_reason), ''), 1000)) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_cancellation() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.cancellation_requests SET status = 'withdrawn', updated_at = now()
   WHERE account_id = public.my_owned_account() AND status IN ('pending','contacted');
END $$;

-- Owner insists after being contacted: returns the Stripe subscription to end (marked only after Stripe succeeds).
CREATE OR REPLACE FUNCTION public.my_cancel_anyway_target() RETURNS TABLE(request_id uuid, stripe_subscription_id text, env text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, s.paddle_subscription_id, s.environment
    FROM public.cancellation_requests r JOIN public.subscriptions s ON s.id = r.subscription_id
   WHERE r.account_id = public.my_owned_account() AND r.status = 'contacted' AND s.provider = 'stripe'
$$;

CREATE OR REPLACE FUNCTION public.mark_cancel_anyway(_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.cancellation_requests SET status = 'owner_cancelled', updated_at = now(), decided_at = now()
   WHERE id = _request_id AND account_id = public.my_owned_account() AND status = 'contacted';
END $$;

-- Platform admin (allowlist + MFA).
CREATE OR REPLACE FUNCTION public.admin_cancellation_requests()
RETURNS TABLE(id uuid, status text, reason text, admin_note text, created_at timestamptz, decided_at timestamptz,
              owner_email text, shop_names text, plan text, period_end timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_platform_admin_mfa();
  RETURN QUERY
  SELECT r.id, r.status, r.reason, r.admin_note, r.created_at, r.decided_at,
         u.email::text, (SELECT string_agg(sh.name, ', ') FROM public.shops sh WHERE sh.business_account_id = r.account_id),
         s.plan, s.current_period_end
    FROM public.cancellation_requests r
    JOIN public.business_accounts a ON a.id = r.account_id
    LEFT JOIN auth.users u ON u.id = a.owner_user_id
    LEFT JOIN public.subscriptions s ON s.id = r.subscription_id
   ORDER BY (r.status IN ('pending','contacted')) DESC, r.created_at DESC
   LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancellation_target(_id uuid) RETURNS TABLE(stripe_subscription_id text, env text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_platform_admin_mfa();
  RETURN QUERY SELECT s.paddle_subscription_id, s.environment
    FROM public.cancellation_requests r JOIN public.subscriptions s ON s.id = r.subscription_id
   WHERE r.id = _id AND r.status IN ('pending','contacted') AND s.provider = 'stripe';
END $$;

CREATE OR REPLACE FUNCTION public.admin_decide_cancellation(_id uuid, _decision text, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_platform_admin_mfa();
  IF _decision NOT IN ('approved','contacted') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  UPDATE public.cancellation_requests
     SET status = _decision, admin_note = left(nullif(btrim(_note), ''), 1000),
         decided_by = auth.uid(), decided_at = now(), updated_at = now()
   WHERE id = _id AND status IN ('pending','contacted');
  IF NOT FOUND THEN RAISE EXCEPTION 'Request is no longer open'; END IF;
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['get_my_cancellation_request()','request_cancellation(text)','withdraw_cancellation()','my_cancel_anyway_target()','mark_cancel_anyway(uuid)','admin_cancellation_requests()','admin_cancellation_target(uuid)','admin_decide_cancellation(uuid,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  GRANT EXECUTE ON FUNCTION public.my_owned_account() TO authenticated;
END $$;