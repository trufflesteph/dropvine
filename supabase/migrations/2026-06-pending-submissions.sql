-- pending_submissions
-- One row per "New drop" CTA click in the vendor dashboard. Carries the
-- vendor's profile snapshot so the Tally webhook can identify the submitter
-- without relying on URL params that Tally may not forward reliably.
--
-- Token is a 64-char hex string (32 random bytes). It is passed to the Tally
-- form as ?token=... and the form has a hidden field that echoes it back in
-- the webhook payload.
--
-- Rows expire after 48 hours. used_at is set the moment the webhook
-- successfully creates the drop — a second submission with the same token is
-- rejected.

CREATE TABLE IF NOT EXISTS public.pending_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token           text UNIQUE NOT NULL,
  vendor_id       uuid NOT NULL REFERENCES public.direct_vendors(id) ON DELETE CASCADE,
  vendor_email    text NOT NULL,
  business_name   text,
  business_category text,
  location_city   text,
  location_state  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz
);

-- Index for the webhook hot-path (token lookup).
CREATE INDEX IF NOT EXISTS pending_submissions_token_idx ON public.pending_submissions (token);

-- RLS: service-role client only (dashboard route + webhook both use admin client).
ALTER TABLE public.pending_submissions ENABLE ROW LEVEL SECURITY;
-- No public policies — all access is via the service-role key.
