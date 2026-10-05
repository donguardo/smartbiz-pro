CREATE TABLE public.account_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Manila'))::date,
  user_hash text NOT NULL
);
GRANT ALL ON public.account_deletions TO service_role;
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.delete_account_data(_user_id uuid, _user_hash text)
RETURNS TABLE(file_path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_m record;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  FOR v_m IN SELECT * FROM public.shop_members WHERE user_id = _user_id LOOP
    IF v_m.role = 'owner' AND NOT EXISTS (SELECT 1 FROM public.shop_members o WHERE o.shop_id = v_m.shop_id AND o.role = 'owner' AND o.user_id <> _user_id) THEN
      RETURN QUERY SELECT d.file_path FROM public.shop_documents d WHERE d.shop_id = v_m.shop_id
        UNION ALL SELECT e.receipt_file FROM public.expenses e WHERE e.shop_id = v_m.shop_id AND e.receipt_file IS NOT NULL;
      DELETE FROM public.sale_items WHERE shop_id = v_m.shop_id;
      DELETE FROM public.sales WHERE shop_id = v_m.shop_id;
      DELETE FROM public.supplier_products WHERE shop_id = v_m.shop_id;
      DELETE FROM public.suppliers WHERE shop_id = v_m.shop_id;
      DELETE FROM public.expenses WHERE shop_id = v_m.shop_id;
      DELETE FROM public.shop_notes WHERE shop_id = v_m.shop_id;
      DELETE FROM public.shop_documents WHERE shop_id = v_m.shop_id;
      DELETE FROM public.daily_tips WHERE shop_id = v_m.shop_id;
      DELETE FROM public.weekly_opportunities WHERE shop_id = v_m.shop_id;
      DELETE FROM public.sales_forecasts WHERE shop_id = v_m.shop_id;
      DELETE FROM public.sales_goals WHERE shop_id = v_m.shop_id;
      DELETE FROM public.customers WHERE shop_id = v_m.shop_id;
      DELETE FROM public.products WHERE shop_id = v_m.shop_id;
      DELETE FROM public.shop_invites WHERE shop_id = v_m.shop_id;
      UPDATE public.profiles SET shop_id = NULL WHERE shop_id = v_m.shop_id;
      DELETE FROM public.shop_members WHERE shop_id = v_m.shop_id;
      DELETE FROM public.shops WHERE id = v_m.shop_id;
    ELSE
      DELETE FROM public.shop_members WHERE id = v_m.id;
    END IF;
  END LOOP;
  DELETE FROM public.chat_messages WHERE user_id = _user_id;
  DELETE FROM public.chat_threads WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  INSERT INTO public.account_deletions(user_hash) VALUES (_user_hash);
END $$;
REVOKE ALL ON FUNCTION public.delete_account_data(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_data(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_account_deletion_scope()
RETURNS TABLE(member_role shop_role, sole_owner boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT sm.role, (sm.role = 'owner' AND NOT EXISTS (SELECT 1 FROM public.shop_members o WHERE o.shop_id = sm.shop_id AND o.role = 'owner' AND o.user_id <> auth.uid()))
  FROM public.shop_members sm WHERE sm.user_id = auth.uid()
  ORDER BY (sm.role = 'owner') DESC LIMIT 1
$$;