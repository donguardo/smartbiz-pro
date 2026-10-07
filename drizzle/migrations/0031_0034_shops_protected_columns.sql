CREATE OR REPLACE FUNCTION public.shops_protect_server_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Browser calls run as 'authenticated'/'anon'. SECURITY DEFINER functions, service_role and the SQL editor are not affected.
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id) THEN
    RAISE EXCEPTION 'This shop field can only be changed by the server';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shops_protect_server_columns ON public.shops;
CREATE TRIGGER shops_protect_server_columns BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_protect_server_columns();