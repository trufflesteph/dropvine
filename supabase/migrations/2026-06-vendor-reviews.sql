-- =============================================================================
-- 2026-06 vendor reviews (Shop-tier exclusive on the public profile)
-- =============================================================================
-- Tables:
--   vendor_reviews   — one row per fulfilled order. Created at fulfillment
--                      with status='pending'. Stays pending until the
--                      shopper submits the form at /review/[id], then waits
--                      for moderator approval via /api/reviews/moderate.
--   review_tokens    — one-shot approve / reject links emailed to the
--                      platform owner after the shopper submits. Expires
--                      30 days after the review is created.
--
-- Status lifecycle:
--   pending  → 'published' (visible publicly)   when moderator clicks approve
--   pending  → 'rejected'  (never shown)        when moderator clicks reject
--
-- The status CHECK constraint is intentionally permissive (free text) so
-- that we can introduce additional intermediate states (e.g. 'flagged')
-- without an ALTER. The API layer treats 'published' as the only visible
-- state.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vendor_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id             UUID NOT NULL REFERENCES public.direct_vendors(id) ON DELETE CASCADE,
  drop_id               UUID NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  reviewer_email        TEXT NOT NULL,
  reviewer_name         TEXT NOT NULL,
  rating                INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment               TEXT NULL,
  is_verified_purchase  BOOLEAN NOT NULL DEFAULT true,
  status                TEXT NOT NULL DEFAULT 'pending',
  created_at            TIMESTAMPTZ DEFAULT now(),
  moderated_at          TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.review_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES public.vendor_reviews(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  action      TEXT NOT NULL,
  used_at     TIMESTAMPTZ NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor_id
  ON public.vendor_reviews (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_status
  ON public.vendor_reviews (status);
CREATE INDEX IF NOT EXISTS idx_review_tokens_token
  ON public.review_tokens (token);

-- RLS: server-side / service-role only. The application API endpoints
-- enforce per-row access (reviews are only readable when status='published',
-- moderation is broken via a single-use random hex token).
ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_reviews_service_all ON public.vendor_reviews;
CREATE POLICY vendor_reviews_service_all
  ON public.vendor_reviews
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS review_tokens_service_all ON public.review_tokens;
CREATE POLICY review_tokens_service_all
  ON public.review_tokens
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Verify — both tables should exist with the expected column count.
SELECT 'vendor_reviews' AS t, COUNT(*) AS cols
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'vendor_reviews'
UNION ALL
SELECT 'review_tokens', COUNT(*)
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'review_tokens';
