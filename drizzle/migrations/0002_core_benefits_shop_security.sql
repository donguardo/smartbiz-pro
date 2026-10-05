CREATE TYPE public.shop_role AS ENUM ('owner', 'cashier');
CREATE TYPE public.goal_period AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE public.sale_status AS ENUM ('completed', 'voided', 'refunded');
CREATE TYPE public.expense_category AS ENUM ('rent', 'electricity', 'water', 'internet', 'salaries', 'supplies', 'transport', 'other');
CREATE TYPE public.document_type AS ENUM ('permit', 'receipt', 'contract', 'other');

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Store',
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'tl')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shop_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.shop_role NOT NULL,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
GRANT SELECT ON public.shop_members TO authenticated;
GRANT ALL ON public.shop_members TO service_role;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_shop_member(_shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_id = _shop_id AND user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.is_shop_owner(_shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_id = _shop_id AND user_id = auth.uid() AND role = 'owner') $$;

GRANT EXECUTE ON FUNCTION public.is_shop_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid) TO authenticated;

CREATE POLICY "members read shop" ON public.shops FOR SELECT TO authenticated USING (public.is_shop_member(id));
CREATE POLICY "owners update shop" ON public.shops FOR UPDATE TO authenticated USING (public.is_shop_owner(id)) WITH CHECK (public.is_shop_owner(id));
CREATE POLICY "members read memberships" ON public.shop_members FOR SELECT TO authenticated USING (public.is_shop_member(shop_id));

INSERT INTO public.shops (id, name, language, created_at)
SELECT p.id, p.business_name, p.language, p.created_at FROM public.profiles p
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.shop_members (shop_id, user_id, role, created_at)
SELECT p.id, p.id, 'owner'::public.shop_role, p.created_at FROM public.profiles p
ON CONFLICT (shop_id, user_id) DO NOTHING;

ALTER TABLE public.profiles ADD COLUMN shop_id uuid REFERENCES public.shops(id);
UPDATE public.profiles SET shop_id = id WHERE shop_id IS NULL;
ALTER TABLE public.products ADD COLUMN shop_id uuid REFERENCES public.shops(id);
UPDATE public.products SET shop_id = user_id WHERE shop_id IS NULL;
ALTER TABLE public.sales ADD COLUMN shop_id uuid REFERENCES public.shops(id);
ALTER TABLE public.sales ADD COLUMN cashier_id uuid;
ALTER TABLE public.sales ADD COLUMN status public.sale_status NOT NULL DEFAULT 'completed';
ALTER TABLE public.sales ADD COLUMN customer_id uuid;
ALTER TABLE public.sales ADD COLUMN voided_at timestamptz;
ALTER TABLE public.sales ADD COLUMN voided_by uuid;
UPDATE public.sales SET shop_id = user_id, cashier_id = user_id WHERE shop_id IS NULL;
ALTER TABLE public.sale_items ADD COLUMN shop_id uuid REFERENCES public.shops(id);
UPDATE public.sale_items SET shop_id = user_id WHERE shop_id IS NULL;
COMMENT ON COLUMN public.products.user_id IS 'DEPRECATED: ownership is determined by shop_id and shop_members';
COMMENT ON COLUMN public.sales.user_id IS 'DEPRECATED: ownership is determined by shop_id and shop_members';
COMMENT ON COLUMN public.sale_items.user_id IS 'DEPRECATED: ownership is determined by shop_id and shop_members';

DROP POLICY IF EXISTS "own products" ON public.products;
DROP POLICY IF EXISTS "own sales" ON public.sales;
DROP POLICY IF EXISTS "own sale items" ON public.sale_items;
CREATE POLICY "owners manage products" ON public.products FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "members read completed sales" ON public.sales FOR SELECT TO authenticated USING (public.is_shop_member(shop_id) AND (public.is_shop_owner(shop_id) OR (cashier_id = auth.uid() AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')));
CREATE POLICY "owners update sales" ON public.sales FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "owners read sale items" ON public.sale_items FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));

CREATE TABLE public.shop_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.shop_role NOT NULL DEFAULT 'cashier' CHECK (role = 'cashier'),
  code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  used_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_invites TO authenticated;
GRANT ALL ON public.shop_invites TO service_role;
ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read invites" ON public.shop_invites FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));

CREATE TABLE public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  period public.goal_period NOT NULL,
  target_amount numeric(12,2) NOT NULL CHECK (target_amount > 0),
  starts_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_goals TO authenticated;
GRANT ALL ON public.sales_goals TO service_role;
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read goals" ON public.sales_goals FOR SELECT TO authenticated USING (public.is_shop_member(shop_id));
CREATE POLICY "owners create goals" ON public.sales_goals FOR INSERT TO authenticated WITH CHECK (public.is_shop_owner(shop_id) AND created_by = auth.uid());
CREATE POLICY "owners update goals" ON public.sales_goals FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "owners delete goals" ON public.sales_goals FOR DELETE TO authenticated USING (public.is_shop_owner(shop_id));

CREATE TABLE public.sales_forecasts (
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  expected_sales numeric(12,2) NOT NULL DEFAULT 0,
  low numeric(12,2) NOT NULL DEFAULT 0,
  high numeric(12,2) NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, forecast_date)
);
GRANT SELECT ON public.sales_forecasts TO authenticated;
GRANT ALL ON public.sales_forecasts TO service_role;
ALTER TABLE public.sales_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read forecasts" ON public.sales_forecasts FOR SELECT TO authenticated USING (public.is_shop_member(shop_id));

CREATE TABLE public.weekly_opportunities (
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  best_days jsonb NOT NULL DEFAULT '[]'::jsonb,
  best_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  fastest_growing_product jsonb,
  summary_en text NOT NULL,
  summary_tl text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, week_start)
);
GRANT SELECT ON public.weekly_opportunities TO authenticated;
GRANT ALL ON public.weekly_opportunities TO service_role;
ALTER TABLE public.weekly_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read opportunities" ON public.weekly_opportunities FOR SELECT TO authenticated USING (public.is_shop_member(shop_id));

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  mobile text,
  consent_at timestamptz,
  created_by uuid NOT NULL,
  anonymized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage customers" ON public.customers FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
ALTER TABLE public.sales ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  mobile text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));

CREATE TABLE public.supplier_products (
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  PRIMARY KEY (supplier_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;
GRANT ALL ON public.supplier_products TO service_role;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage supplier products" ON public.supplier_products FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date,
  category public.expense_category NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text,
  receipt_file text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));

CREATE TABLE public.shop_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_notes TO authenticated;
GRANT ALL ON public.shop_notes TO service_role;
ALTER TABLE public.shop_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage notes" ON public.shop_notes FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));

CREATE TABLE public.shop_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title text NOT NULL,
  type public.document_type NOT NULL,
  expiry_date date,
  file_path text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_documents TO authenticated;
GRANT ALL ON public.shop_documents TO service_role;
ALTER TABLE public.shop_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage documents" ON public.shop_documents FOR ALL TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));

CREATE TABLE public.daily_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  tip_date date NOT NULL,
  tip_text text NOT NULL,
  language text NOT NULL CHECK (language IN ('en', 'tl')),
  feedback smallint CHECK (feedback IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, tip_date)
);
GRANT SELECT, UPDATE ON public.daily_tips TO authenticated;
GRANT ALL ON public.daily_tips TO service_role;
ALTER TABLE public.daily_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read tips" ON public.daily_tips FOR SELECT TO authenticated USING (public.is_shop_member(shop_id));
CREATE POLICY "owners rate tips" ON public.daily_tips FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));

CREATE OR REPLACE FUNCTION public.ensure_my_shop(_business_name text DEFAULT 'My Store')
RETURNS TABLE(shop_id uuid, role public.shop_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_shop uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT sm.shop_id INTO v_shop FROM public.shop_members sm WHERE sm.user_id = v_user ORDER BY sm.created_at LIMIT 1;
  IF v_shop IS NULL THEN
    v_shop := v_user;
    INSERT INTO public.shops(id, name) VALUES (v_shop, COALESCE(NULLIF(trim(_business_name), ''), 'My Store')) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.shop_members(shop_id, user_id, role) VALUES (v_shop, v_user, 'owner') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET shop_id = v_shop WHERE id = v_user;
  END IF;
  RETURN QUERY SELECT v_shop, sm.role FROM public.shop_members sm WHERE sm.shop_id = v_shop AND sm.user_id = v_user;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_my_shop(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_shop_context()
RETURNS TABLE(shop_id uuid, shop_name text, member_role public.shop_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT s.id, s.name, sm.role FROM public.shop_members sm JOIN public.shops s ON s.id = sm.shop_id WHERE sm.user_id = auth.uid() ORDER BY sm.created_at LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION public.get_my_shop_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_shop_products()
RETURNS TABLE(id uuid, shop_id uuid, name text, sku text, category text, price numeric, cost numeric, stock integer, reorder_level integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.shop_id, p.name, p.sku, p.category, p.price,
    CASE WHEN public.is_shop_owner(p.shop_id) THEN p.cost ELSE NULL END,
    p.stock, p.reorder_level, p.created_at
  FROM public.products p WHERE public.is_shop_member(p.shop_id) ORDER BY p.name
$$;
GRANT EXECUTE ON FUNCTION public.get_shop_products() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_masked_customers()
RETURNS TABLE(id uuid, name text, mobile text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name,
    CASE WHEN public.is_shop_owner(c.shop_id) THEN c.mobile
      WHEN c.mobile IS NULL THEN NULL
      ELSE left(c.mobile, 5) || '•• ••• ' || right(regexp_replace(c.mobile, '\D', '', 'g'), 4) END
  FROM public.customers c WHERE public.is_shop_member(c.shop_id) AND c.anonymized_at IS NULL ORDER BY c.name
$$;
GRANT EXECUTE ON FUNCTION public.get_masked_customers() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_shop_customer(_name text, _mobile text, _consented boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid; v_id uuid;
BEGIN
  SELECT sm.shop_id INTO v_shop FROM public.shop_members sm WHERE sm.user_id = auth.uid() ORDER BY sm.created_at LIMIT 1;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT _consented THEN RAISE EXCEPTION 'Customer consent is required'; END IF;
  INSERT INTO public.customers(shop_id, name, mobile, consent_at, created_by) VALUES (v_shop, left(trim(_name), 60), NULLIF(trim(_mobile), ''), now(), auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_shop_customer(text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_shop_invite(_email text)
RETURNS TABLE(invite_id uuid, code text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid; v_invite public.shop_invites%ROWTYPE;
BEGIN
  SELECT sm.shop_id INTO v_shop FROM public.shop_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'owner' ORDER BY sm.created_at LIMIT 1;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.shop_invites(shop_id, email, created_by) VALUES (v_shop, lower(trim(_email)), auth.uid()) RETURNING * INTO v_invite;
  RETURN QUERY SELECT v_invite.id, v_invite.code, v_invite.expires_at;
END $$;
GRANT EXECUTE ON FUNCTION public.create_shop_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_shop_invite(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite public.shop_invites%ROWTYPE; v_email text := lower(COALESCE(auth.jwt()->>'email', ''));
BEGIN
  SELECT * INTO v_invite FROM public.shop_invites WHERE code = _code FOR UPDATE;
  IF v_invite.id IS NULL OR v_invite.used_at IS NOT NULL OR v_invite.expires_at <= now() THEN RAISE EXCEPTION 'Invite is invalid or expired'; END IF;
  IF v_email = '' OR v_email <> lower(v_invite.email) THEN RAISE EXCEPTION 'Sign in with the invited email'; END IF;
  INSERT INTO public.shop_members(shop_id, user_id, role, invited_by) VALUES (v_invite.shop_id, auth.uid(), 'cashier', v_invite.created_by) ON CONFLICT (shop_id, user_id) DO NOTHING;
  UPDATE public.shop_invites SET used_at = now() WHERE id = v_invite.id;
  UPDATE public.profiles SET shop_id = v_invite.shop_id WHERE id = auth.uid();
  RETURN v_invite.shop_id;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_shop_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_shop_invite(_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.shop_invites WHERE id = _invite_id AND used_at IS NULL AND public.is_shop_owner(shop_id);
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_shop_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_shop_cashier(_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.shop_members sm WHERE sm.id = _member_id AND sm.role = 'cashier' AND public.is_shop_owner(sm.shop_id);
END $$;
GRANT EXECUTE ON FUNCTION public.remove_shop_cashier(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_sale(_payment_method text, _amount_tendered numeric, _customer_id uuid, _items jsonb)
RETURNS TABLE(sale_id uuid, receipt_no text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid; v_sale uuid := gen_random_uuid(); v_receipt text := 'R-' || upper(substr(replace(v_sale::text, '-', ''), 1, 12)); v_total numeric := 0; v_cost numeric := 0; v_item jsonb; v_product public.products%ROWTYPE; v_qty integer;
BEGIN
  SELECT sm.shop_id INTO v_shop FROM public.shop_members sm WHERE sm.user_id = auth.uid() ORDER BY sm.created_at LIMIT 1;
  IF v_shop IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Invalid sale'; END IF;
  IF _payment_method NOT IN ('cash', 'ewallet', 'card') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF _customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.shop_id = v_shop) THEN RAISE EXCEPTION 'Invalid customer'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'qty')::integer;
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop FOR UPDATE;
    IF v_product.id IS NULL OR v_qty <= 0 OR v_product.stock < v_qty THEN RAISE EXCEPTION 'Not enough stock'; END IF;
    v_total := v_total + v_product.price * v_qty; v_cost := v_cost + v_product.cost * v_qty;
  END LOOP;
  INSERT INTO public.sales(id, user_id, shop_id, cashier_id, receipt_no, total, cost_total, payment_method, amount_tendered, customer_id)
  VALUES(v_sale, auth.uid(), v_shop, auth.uid(), v_receipt, v_total, v_cost, _payment_method, _amount_tendered, _customer_id);
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := (v_item->>'qty')::integer;
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND shop_id = v_shop;
    INSERT INTO public.sale_items(sale_id, user_id, shop_id, product_id, name, category, qty, price, cost)
    VALUES(v_sale, auth.uid(), v_shop, v_product.id, v_product.name, v_product.category, v_qty, v_product.price, v_product.cost);
    UPDATE public.products SET stock = stock - v_qty WHERE id = v_product.id;
  END LOOP;
  RETURN QUERY SELECT v_sale, v_receipt;
END $$;
GRANT EXECUTE ON FUNCTION public.record_sale(text, numeric, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.void_sale(_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sale public.sales%ROWTYPE; v_item public.sale_items%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR NOT public.is_shop_owner(v_sale.shop_id) OR v_sale.status <> 'completed' THEN RAISE EXCEPTION 'Sale cannot be voided'; END IF;
  UPDATE public.sales SET status = 'voided', voided_at = now(), voided_by = auth.uid() WHERE id = _sale_id;
  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP UPDATE public.products SET stock = stock + v_item.qty WHERE id = v_item.product_id; END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.anonymize_customer(_customer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.customers SET name = 'Deleted customer', mobile = NULL, consent_at = NULL, anonymized_at = now(), updated_at = now() WHERE id = _customer_id AND public.is_shop_owner(shop_id);
END $$;
GRANT EXECUTE ON FUNCTION public.anonymize_customer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.forecast_sales(_shop_id uuid, _days integer)
RETURNS TABLE(forecast_date date, expected_sales numeric, low numeric, high numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_shop_member(_shop_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _days NOT IN (7,30) THEN RAISE EXCEPTION 'Days must be 7 or 30'; END IF;
  IF (SELECT COALESCE((max((created_at AT TIME ZONE 'Asia/Manila')::date) - min((created_at AT TIME ZONE 'Asia/Manila')::date)),0) FROM public.sales WHERE shop_id=_shop_id AND status='completed' AND created_at >= now()-interval '8 weeks') < 13 THEN RETURN; END IF;
  RETURN QUERY
  WITH daily AS (
    SELECT (s.created_at AT TIME ZONE 'Asia/Manila')::date d, sum(s.total)::numeric total
    FROM public.sales s WHERE s.shop_id=_shop_id AND s.status='completed' AND s.created_at >= now()-interval '8 weeks' GROUP BY 1
  ), stats AS (
    SELECT extract(isodow from d)::int dow, avg(total)::numeric avg_total, COALESCE(stddev_samp(total),0)::numeric sd FROM daily GROUP BY 1
  ), trend AS (
    SELECT LEAST(1.2, GREATEST(0.8, COALESCE(
      (SELECT avg(total) FROM daily WHERE d >= (now() AT TIME ZONE 'Asia/Manila')::date-27) /
      NULLIF((SELECT avg(total) FROM daily WHERE d BETWEEN (now() AT TIME ZONE 'Asia/Manila')::date-55 AND (now() AT TIME ZONE 'Asia/Manila')::date-28),0), 1)))::numeric factor
  ), payday AS (
    SELECT COALESCE(LEAST(1.5, GREATEST(1.0, avg(total) FILTER (WHERE extract(day from d) IN (1,15,16) OR d = (date_trunc('month', d)+interval '1 month-1 day')::date) / NULLIF(avg(total),0))),1)::numeric factor FROM daily
  )
  SELECT f.d, round(COALESCE(st.avg_total,0)*tr.factor*CASE WHEN extract(day from f.d) IN (1,15,16) OR f.d=(date_trunc('month',f.d)+interval '1 month-1 day')::date THEN p.factor ELSE 1 END,2),
    round(GREATEST(0,COALESCE(st.avg_total,0)*tr.factor-COALESCE(st.sd,0)),2),
    round(GREATEST(0,COALESCE(st.avg_total,0)*tr.factor+COALESCE(st.sd,0)),2)
  FROM generate_series((now() AT TIME ZONE 'Asia/Manila')::date+1,(now() AT TIME ZONE 'Asia/Manila')::date+_days,'1 day') f(d)
  LEFT JOIN stats st ON st.dow=extract(isodow from f.d)::int CROSS JOIN trend tr CROSS JOIN payday p ORDER BY f.d;
END $$;
GRANT EXECUTE ON FUNCTION public.forecast_sales(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_all_forecasts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop public.shops%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  FOR v_shop IN SELECT * FROM public.shops LOOP
    DELETE FROM public.sales_forecasts WHERE shop_id=v_shop.id AND forecast_date > (now() AT TIME ZONE 'Asia/Manila')::date;
    INSERT INTO public.sales_forecasts(shop_id,forecast_date,expected_sales,low,high,computed_at)
    SELECT v_shop.id,f.forecast_date,f.expected_sales,f.low,f.high,now() FROM public.forecast_sales(v_shop.id,30) f
    ON CONFLICT(shop_id,forecast_date) DO UPDATE SET expected_sales=excluded.expected_sales,low=excluded.low,high=excluded.high,computed_at=excluded.computed_at;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.refresh_all_forecasts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_all_forecasts() TO service_role;

CREATE INDEX products_shop_idx ON public.products(shop_id);
CREATE INDEX sales_shop_created_idx ON public.sales(shop_id, created_at DESC) WHERE status='completed';
CREATE INDEX sale_items_shop_created_idx ON public.sale_items(shop_id, created_at DESC);
CREATE INDEX customers_shop_idx ON public.customers(shop_id);
CREATE INDEX expenses_shop_date_idx ON public.expenses(shop_id, date DESC);
CREATE INDEX documents_shop_expiry_idx ON public.shop_documents(shop_id, expiry_date);
