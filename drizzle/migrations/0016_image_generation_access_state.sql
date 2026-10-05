CREATE TABLE public.image_generation_access_state (
 id text PRIMARY KEY DEFAULT 'store-logo',
 blocked boolean NOT NULL DEFAULT false,
 message text,
 status integer,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.image_generation_access_state TO service_role;
ALTER TABLE public.image_generation_access_state ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.image_generation_access_state IS 'Server-only persistent image provider access denial circuit breaker; no browser access.';