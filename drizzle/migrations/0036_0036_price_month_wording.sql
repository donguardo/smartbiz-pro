INSERT INTO public.translations (key, lang, value, updated_at) VALUES
  ('price.per', 'en', '/month', now()),
  ('price.per', 'tl', '/buwan', now())
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- N3 (Data Security): only the server writes translations
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.translations FROM anon, authenticated;
