CREATE OR REPLACE FUNCTION public.list_my_stores()
RETURNS TABLE(shop_id uuid, shop_name text, member_role shop_role, is_current boolean, logo_url text, business_categories text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id, s.name, sm.role, s.id = public.current_shop_id_raw(), s.logo_url, s.business_categories
  FROM public.shop_members sm JOIN public.shops s ON s.id = sm.shop_id
  WHERE sm.user_id = auth.uid() ORDER BY s.created_at
$$;

CREATE OR REPLACE FUNCTION public.switch_my_store(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_member(_shop_id) THEN RAISE EXCEPTION 'You are not a member of this store'; END IF;
  UPDATE public.profiles SET shop_id = _shop_id WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.create_my_store(_name text, _categories text[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_cur uuid; v_acc uuid; v_plan text; v_max int; v_count int; v_new uuid := gen_random_uuid(); v_name text := NULLIF(trim(_name), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  v_cur := public.current_shop_id_raw();
  IF v_cur IS NULL OR NOT public.is_shop_owner(v_cur) THEN RAISE EXCEPTION 'Only store owners can add stores'; END IF;
  IF v_name IS NULL OR length(v_name) > 80 THEN RAISE EXCEPTION 'Store name is required (max 80 characters)'; END IF;
  SELECT business_account_id INTO v_acc FROM public.shops WHERE id = v_cur;
  IF v_acc IS NULL OR v_acc IS DISTINCT FROM public.my_owned_account() THEN RAISE EXCEPTION 'Only the account owner can add stores'; END IF;
  PERFORM 1 FROM public.business_accounts WHERE id = v_acc FOR UPDATE;
  v_plan := public.shop_plan_unchecked(v_cur);
  SELECT max_stores INTO v_max FROM public.plan_limits WHERE plan = v_plan;
  SELECT count(*) INTO v_count FROM public.shops WHERE business_account_id = v_acc;
  IF v_max IS NOT NULL AND v_count >= v_max THEN RAISE EXCEPTION 'STORE_LIMIT: Your plan allows % store(s). Upgrade to add more.', v_max; END IF;
  _categories := COALESCE(_categories, '{}');
  IF v_plan = 'basic' AND cardinality(_categories) > 1 THEN RAISE EXCEPTION 'CATEGORY_LIMIT: Solopreneur stores can have one category.'; END IF;
  IF cardinality(_categories) > 12 THEN RAISE EXCEPTION 'Too many categories'; END IF;
  INSERT INTO public.shops(id, name, business_categories, owner_name, mobile, business_type)
  SELECT v_new, v_name, _categories, s.owner_name, s.mobile, s.business_type FROM public.shops s WHERE s.id = v_cur;
  UPDATE public.shops SET business_account_id = v_acc WHERE id = v_new;
  INSERT INTO public.shop_members(shop_id, user_id, role) VALUES (v_new, v_user, 'owner');
  UPDATE public.profiles SET shop_id = v_new WHERE id = v_user;
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.shops_category_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.business_categories IS DISTINCT FROM OLD.business_categories
     AND cardinality(NEW.business_categories) > 1
     AND public.shop_plan_unchecked(NEW.id) = 'basic' THEN
    RAISE EXCEPTION 'CATEGORY_LIMIT: Solopreneur stores can have one category.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shops_category_limit ON public.shops;
CREATE TRIGGER shops_category_limit BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.shops_category_limit();

REVOKE ALL ON FUNCTION public.list_my_stores() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.switch_my_store(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_my_store(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_stores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_my_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_store(text, text[]) TO authenticated;