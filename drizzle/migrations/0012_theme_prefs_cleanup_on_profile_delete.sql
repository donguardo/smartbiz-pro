CREATE OR REPLACE FUNCTION public.delete_theme_prefs_for_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.user_theme_prefs WHERE user_id = OLD.id;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_theme_prefs_for_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_delete_theme_prefs AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.delete_theme_prefs_for_profile();