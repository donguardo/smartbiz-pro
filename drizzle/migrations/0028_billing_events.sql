CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid,
  paddle_event_id text,
  event_type text NOT NULL,
  paddle_subscription_id text,
  environment text NOT NULL,
  sync_status text NOT NULL CHECK (sync_status IN ('synced','failed','skipped')),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their billing events" ON public.billing_events
  FOR SELECT TO authenticated USING (shop_id IS NOT NULL AND public.is_shop_owner(shop_id));
CREATE INDEX billing_events_shop_idx ON public.billing_events (shop_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_billing_link_check()
RETURNS TABLE(shop_id uuid, payments_env text, paddle_subscription_id text, subscription_shop_id uuid, subscription_env text, subscription_status text, shop_ok boolean, env_ok boolean, other_env_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop uuid := public.current_shop_id_raw(); _env text := public.payments_env();
BEGIN
  IF _shop IS NULL OR NOT public.is_shop_owner(_shop) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  WITH mine AS (
    SELECT s.* FROM public.subscriptions s
    WHERE s.shop_id = _shop OR s.user_id = auth.uid()
    ORDER BY (s.environment = _env) DESC, s.created_at DESC LIMIT 1
  )
  SELECT _shop, _env, m.paddle_subscription_id, m.shop_id, m.environment, m.status,
         (m.shop_id = _shop), (m.environment = _env),
         (SELECT count(*) FROM public.subscriptions o WHERE o.shop_id = _shop AND o.environment <> _env)
  FROM (SELECT 1) one LEFT JOIN mine m ON true;
END $$;
REVOKE ALL ON FUNCTION public.get_billing_link_check() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_billing_link_check() TO authenticated;