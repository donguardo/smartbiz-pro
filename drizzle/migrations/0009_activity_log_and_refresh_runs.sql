CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text NOT NULL DEFAULT 'System',
  actor_role text,
  entity text NOT NULL,
  action text NOT NULL,
  entity_id uuid,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_shop_created_idx ON public.activity_log(shop_id, created_at DESC);
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read activity" ON public.activity_log FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));

CREATE TABLE public.refresh_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL DEFAULT 'daily-business-refresh',
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  shops_processed integer NOT NULL DEFAULT 0,
  error text
);
CREATE INDEX refresh_runs_started_idx ON public.refresh_runs(started_at DESC);
GRANT SELECT ON public.refresh_runs TO authenticated;
GRANT ALL ON public.refresh_runs TO service_role;
ALTER TABLE public.refresh_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read refresh runs" ON public.refresh_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shop_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'owner'));

CREATE OR REPLACE FUNCTION public.log_shop_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row jsonb := to_jsonb(COALESCE(NEW, OLD));
  v_shop uuid := COALESCE((v_row->>'shop_id')::uuid, CASE WHEN TG_TABLE_NAME = 'shops' THEN (v_row->>'id')::uuid END);
  v_uid uuid := auth.uid();
  v_name text; v_role text; v_action text := lower(TG_OP); v_summary text; v_label text;
BEGIN
  IF v_shop IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  -- historical sample-store sales are not staff activity
  IF TG_TABLE_NAME = 'sales' AND TG_OP = 'INSERT' AND NEW.receipt_no LIKE 'S-%' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'sale_items' THEN RETURN NEW; END IF;
  IF v_uid IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(p.full_name), ''), auth.jwt()->>'email', 'Staff') INTO v_name FROM public.profiles p WHERE p.id = v_uid;
    v_name := COALESCE(v_name, auth.jwt()->>'email', 'Staff');
    SELECT sm.role::text INTO v_role FROM public.shop_members sm WHERE sm.shop_id = v_shop AND sm.user_id = v_uid;
  END IF;
  v_label := COALESCE(v_row->>'name', v_row->>'receipt_no', v_row->>'title', v_row->>'category', '');
  IF TG_TABLE_NAME = 'sales' THEN
    IF TG_OP = 'INSERT' THEN v_action := 'sale'; v_summary := 'Recorded sale ' || NEW.receipt_no || ' (₱' || NEW.total || ', ' || NEW.payment_method || ')';
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN v_action := NEW.status::text; v_summary := initcap(NEW.status::text) || ' sale ' || NEW.receipt_no || ' (₱' || NEW.total || ')';
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'products' AND TG_OP = 'UPDATE' THEN
    IF NEW.stock IS DISTINCT FROM OLD.stock AND NEW.price = OLD.price AND NEW.cost = OLD.cost AND NEW.name = OLD.name AND v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.sales s WHERE s.cashier_id = v_uid AND s.created_at = now()) THEN RETURN NEW; END IF;
    v_summary := 'Updated product ' || NEW.name ||
      CASE WHEN NEW.price IS DISTINCT FROM OLD.price THEN ' · price ₱' || OLD.price || ' → ₱' || NEW.price ELSE '' END ||
      CASE WHEN NEW.stock IS DISTINCT FROM OLD.stock THEN ' · stock ' || OLD.stock || ' → ' || NEW.stock ELSE '' END;
  ELSIF TG_TABLE_NAME = 'shop_members' THEN
    v_label := COALESCE(v_row->>'role', 'member');
    v_summary := CASE TG_OP WHEN 'INSERT' THEN 'Added ' || v_label ELSE 'Removed ' || v_label END;
  ELSIF TG_TABLE_NAME = 'customers' THEN
    v_summary := initcap(v_action) || 'd customer ' || COALESCE(v_row->>'name', '');
  ELSE
    v_summary := initcap(v_action) || 'd ' || replace(rtrim(TG_TABLE_NAME, 's'), '_', ' ') || CASE WHEN v_label <> '' THEN ' ' || v_label ELSE '' END;
  END IF;
  v_summary := replace(replace(v_summary, 'Insertd', 'Added'), 'Deleted', 'Deleted');
  v_summary := replace(replace(v_summary, 'Updated', 'Updated'), 'Deleted', 'Deleted');
  INSERT INTO public.activity_log(shop_id, actor_id, actor_name, actor_role, entity, action, entity_id, summary)
  VALUES (v_shop, v_uid, COALESCE(v_name, 'System'), v_role, TG_TABLE_NAME, v_action, (v_row->>'id')::uuid, left(v_summary, 300));
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.log_shop_activity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER activity_sales AFTER INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.log_shop_activity();
CREATE TRIGGER activity_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_shop_activity();
CREATE TRIGGER activity_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.log_shop_activity();
CREATE TRIGGER activity_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.log_shop_activity();
CREATE TRIGGER activity_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.log_shop_activity();
CREATE TRIGGER activity_goals AFTER INSERT OR UPDATE OR DELETE ON public.sales_goals FOR EACH ROW EXECUTE FUNCTION public.log_shop_activity();
CREATE TRIGGER activity_members AFTER INSERT OR DELETE ON public.shop_members FOR EACH ROW EXECUTE FUNCTION public.log_shop_activity();
CREATE TRIGGER activity_shops AFTER UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.log_shop_activity();