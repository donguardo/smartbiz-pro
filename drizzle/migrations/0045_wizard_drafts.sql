CREATE TABLE public.wizard_drafts (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wizard_drafts_size CHECK (pg_column_size(data) <= 524288)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wizard_drafts TO authenticated;
GRANT ALL ON public.wizard_drafts TO service_role;
ALTER TABLE public.wizard_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own draft read" ON public.wizard_drafts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own draft insert" ON public.wizard_drafts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own draft update" ON public.wizard_drafts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own draft delete" ON public.wizard_drafts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.wizard_drafts_touch() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER wizard_drafts_touch BEFORE INSERT OR UPDATE ON public.wizard_drafts FOR EACH ROW EXECUTE FUNCTION public.wizard_drafts_touch();