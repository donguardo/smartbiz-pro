ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paddle';
COMMENT ON COLUMN public.subscriptions.paddle_subscription_id IS 'Provider subscription id (Paddle sub_… or Stripe sub_…); see provider';
COMMENT ON COLUMN public.subscriptions.paddle_customer_id IS 'Provider customer id (Paddle ctm_… or Stripe cus_…); see provider';