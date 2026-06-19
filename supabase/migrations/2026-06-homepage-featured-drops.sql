-- Homepage featured-drops manual curation (June 2026)
-- =============================================================================
-- Replaces the hardcoded demo cards on the homepage with a manually curated
-- selection. The platform owner sets is_featured_homepage = true and
-- featured_order (1, 2, 3, ...) directly in Supabase to control what shows.
--
-- No auto-fill: the homepage shows exactly the drops marked featured, in
-- featured_order. If fewer than 3 are marked, only those show.
-- =============================================================================

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS is_featured_homepage BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS featured_order INTEGER NULL;

COMMENT ON COLUMN public.drops.is_featured_homepage IS
  'When true, this drop appears in the homepage featured-drops section. Set manually in Supabase — no auto-fill logic in code.';
COMMENT ON COLUMN public.drops.featured_order IS
  'Display order within the homepage featured-drops section (lower = shown first / the large featured card). Always set alongside is_featured_homepage = true.';

-- One-time seed: mark the three existing demo drops as featured, matching
-- their current top-to-bottom position on the homepage.
UPDATE public.drops SET is_featured_homepage = true, featured_order = 1
 WHERE handle = 'sauce-mamas-workshop-june';

UPDATE public.drops SET is_featured_homepage = true, featured_order = 2
 WHERE handle = 'wildflour-may-21';

UPDATE public.drops SET is_featured_homepage = true, featured_order = 3
 WHERE handle = 'baxter-produce-may-21';

-- Verify:
SELECT handle, title, is_featured_homepage, featured_order
  FROM public.drops
 WHERE is_featured_homepage = true
 ORDER BY featured_order;
