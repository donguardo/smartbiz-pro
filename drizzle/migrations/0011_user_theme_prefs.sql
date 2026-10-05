CREATE TABLE public.user_theme_prefs (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  business_theme text NOT NULL DEFAULT 'brand' CHECK (business_theme IN ('brand','cafe','coffeehouse','fiesta','custom')),
  custom_colors jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_theme_prefs TO authenticated;
GRANT ALL ON public.user_theme_prefs TO service_role;
ALTER TABLE public.user_theme_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own theme prefs" ON public.user_theme_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());