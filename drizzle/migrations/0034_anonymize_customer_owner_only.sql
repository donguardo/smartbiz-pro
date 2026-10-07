CREATE OR REPLACE FUNCTION public.anonymize_customer(_customer_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.customers SET name = 'Deleted customer', mobile = NULL, consent_at = NULL, anonymized_at = now(), updated_at = now()
  WHERE id = _customer_id AND public.is_shop_owner(shop_id);
END $function$;
REVOKE ALL ON FUNCTION public.anonymize_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anonymize_customer(uuid) TO authenticated;