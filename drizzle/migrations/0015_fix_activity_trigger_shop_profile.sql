CREATE OR REPLACE FUNCTION public.log_shop_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row jsonb := to_jsonb(COALESCE(NEW, OLD));
  v_shop uuid := COALESCE((v_row->>'shop_id')::uuid, CASE WHEN TG_TABLE_NAME = 'shops' THEN (v_row->>'id')::uuid END);
  v_uid uuid := auth.uid();
  v_name text; v_role text; v_action text := lower(TG_OP); v_summary text; v_label text;
BEGIN
  IF v_shop IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  -- Generic triggers must never resolve sales-only record fields for another table.
  IF TG_TABLE_NAME = 'sales' AND TG_OP = 'INSERT' AND (v_row->>'receipt_no') LIKE 'S-%' THEN RETURN NEW; END IF;
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
END $function$;