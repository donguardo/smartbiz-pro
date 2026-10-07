REVOKE ALL ON FUNCTION public.get_shop_billing(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_billing(text) TO authenticated;