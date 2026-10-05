ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS low_stock_alerts boolean NOT NULL DEFAULT true;

CREATE TABLE public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  unit text NOT NULL,
  stock_at numeric NOT NULL,
  threshold numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX stock_alerts_shop_unread ON public.stock_alerts (shop_id, created_at DESC) WHERE read_at IS NULL;
GRANT SELECT ON public.stock_alerts TO authenticated;
GRANT UPDATE (read_at) ON public.stock_alerts TO authenticated;
GRANT ALL ON public.stock_alerts TO service_role;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read stock alerts" ON public.stock_alerts FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));
CREATE POLICY "owners mark stock alerts read" ON public.stock_alerts FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));

CREATE OR REPLACE FUNCTION public.raise_low_stock_alert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT NEW.track_stock OR NEW.archived_at IS NOT NULL OR NEW.shop_id IS NULL OR NEW.stock_qty > NEW.reorder_level THEN RETURN NEW; END IF;
  -- Only when stock newly crosses the threshold (or the threshold is raised past it).
  IF TG_OP = 'UPDATE' AND OLD.track_stock AND OLD.archived_at IS NULL AND OLD.stock_qty <= OLD.reorder_level THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.stock_qty = 0 THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = NEW.shop_id AND s.low_stock_alerts) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.stock_alerts a WHERE a.product_id = NEW.id AND a.read_at IS NULL) THEN RETURN NEW; END IF;
  INSERT INTO public.stock_alerts(shop_id, product_id, product_name, unit, stock_at, threshold)
  VALUES (NEW.shop_id, NEW.id, NEW.name, NEW.unit, NEW.stock_qty, NEW.reorder_level);
  RETURN NEW;
END $$;
CREATE TRIGGER products_low_stock_alert AFTER INSERT OR UPDATE OF stock_qty, reorder_level, track_stock, archived_at ON public.products FOR EACH ROW EXECUTE FUNCTION public.raise_low_stock_alert();