CREATE OR REPLACE FUNCTION public.shop_has_access(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _shop_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.created_at + interval '14 days' > now())
    OR EXISTS (SELECT 1 FROM public.subscriptions x WHERE x.shop_id = _shop_id AND (
      (x.status IN ('active','trialing','past_due') AND (x.current_period_end IS NULL OR x.current_period_end > now()))
      OR (x.status = 'canceled' AND x.current_period_end > now())))
  )
$$;
REVOKE ALL ON FUNCTION public.shop_has_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_has_access(uuid) TO authenticated, service_role;

-- Membership lookup without the billing gate (used for billing status, shop context and onboarding).
CREATE OR REPLACE FUNCTION public.current_shop_id_raw()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT p.shop_id FROM public.profiles p JOIN public.shop_members sm ON sm.shop_id = p.shop_id AND sm.user_id = auth.uid() WHERE p.id = auth.uid()),
    (SELECT sm.shop_id FROM public.shop_members sm WHERE sm.user_id = auth.uid() ORDER BY sm.created_at LIMIT 1)
  )
$$;
REVOKE ALL ON FUNCTION public.current_shop_id_raw() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_shop_id_raw() TO authenticated;

-- Every data RPC and the shop-forcing triggers use this: unpaid shops resolve to no shop.
CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN public.shop_has_access(r) THEN r END FROM (SELECT public.current_shop_id_raw() AS r) t
$$;

CREATE OR REPLACE FUNCTION public.get_my_shop_context()
RETURNS TABLE(shop_id uuid, shop_name text, member_role shop_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id, s.name, sm.role FROM public.shop_members sm JOIN public.shops s ON s.id = sm.shop_id
  WHERE sm.user_id = auth.uid() AND sm.shop_id = public.current_shop_id_raw() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_shop_billing(_env text)
RETURNS TABLE(has_access boolean, state text, trial_ends_at timestamptz, period_end timestamptz, cancel_at_period_end boolean, is_owner boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop uuid := public.current_shop_id_raw(); v_trial timestamptz; v_s public.subscriptions%ROWTYPE; v_paid boolean := false;
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

CREATE OR REPLACE FUNCTION public.ensure_my_shop(_business_name text DEFAULT 'My Store'::text)
RETURNS TABLE(shop_id uuid, role shop_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user uuid := auth.uid(); v_shop uuid; v_meta jsonb := COALESCE(auth.jwt()->'user_metadata', '{}'::jsonb); v_mobile text; v_type text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT public.current_shop_id_raw() INTO v_shop;
  IF v_shop IS NULL THEN
    v_shop := v_user;
    v_mobile := CASE WHEN (v_meta->>'mobile') ~ '^09[0-9]{9}$' THEN v_meta->>'mobile' END;
    v_type := CASE WHEN (v_meta->>'business_type') IN ('Sari-sari','Food','Retail','Services','Laundry','Hardware','Bakery','Other') THEN v_meta->>'business_type' END;
    INSERT INTO public.shops(id, name, owner_name, mobile, business_type)
    VALUES (v_shop, COALESCE(NULLIF(trim(_business_name), ''), NULLIF(trim(v_meta->>'business_name'), ''), 'My Store'), left(NULLIF(trim(v_meta->>'owner_name'), ''), 80), v_mobile, v_type)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.shop_members(shop_id, user_id, role) VALUES (v_shop, v_user, 'owner') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET full_name = COALESCE(full_name, left(NULLIF(trim(v_meta->>'owner_name'), ''), 80)) WHERE id = v_user;
  END IF;
  UPDATE public.profiles SET shop_id = v_shop WHERE id = v_user;
  RETURN QUERY SELECT v_shop, sm.role FROM public.shop_members sm WHERE sm.shop_id = v_shop AND sm.user_id = v_user;
END $function$;

-- Restrictive policies: in addition to existing rules, shop data is only reachable while the shop has access.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','sales','sale_items','customers','expenses','suppliers','supplier_products','shop_notes','shop_documents','purchase_orders','purchase_order_items','stock_movements','stock_alerts','activity_log','daily_tips','weekly_opportunities','sales_forecasts','sales_goals'] LOOP
    EXECUTE format('CREATE POLICY "Requires active subscription" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.shop_has_access(shop_id)) WITH CHECK (public.shop_has_access(shop_id))', t);
  END LOOP;
END $$;