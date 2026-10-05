REVOKE ALL ON FUNCTION public.record_sale(text, numeric, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_sale(text, numeric, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_sale(text, numeric, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_sale(text, numeric, uuid, jsonb) TO service_role;