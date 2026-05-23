-- =============================================================================
-- Demo vendors — hero images + drop-page cover images (June 2026)
-- =============================================================================
-- Step 1 of the homepage-cards-with-background-image task:
--
--   1. Adds `hero_image_url` to public.launches (column for the homepage
--      featured-card background; vendors will be able to upload from the
--      dashboard later).
--   2. Backfills the three existing demo launches with placeholder Unsplash
--      images for the card background AND with vendor-supplied product
--      photos (`cover_url`) for the drop-page hero.
--
-- Idempotent — safe to re-run (ALTER uses IF NOT EXISTS, UPDATEs are keyed
-- on the canonical demo handles).
-- =============================================================================

ALTER TABLE public.launches
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT NULL;

COMMENT ON COLUMN public.launches.hero_image_url IS
  'Optional background image used by the homepage featured-card grid. When NULL the card falls back to its solid color treatment. Distinct from cover_url, which is the photo shown on the public /l/[handle] drop page hero.';

-- Card-background placeholders (Unsplash) — these will be overridden when a
-- real vendor uploads via the dashboard.
UPDATE public.launches
   SET hero_image_url = 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=800&q=80'
 WHERE handle = 'sauce-mamas-workshop-june';

UPDATE public.launches
   SET hero_image_url = 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80'
 WHERE handle = 'wildflour-may-21';

UPDATE public.launches
   SET hero_image_url = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80'
 WHERE handle = 'baxter-produce-may-21';

-- Drop-page cover photos — supplied by the platform owner from Supabase
-- Storage. Render at the top of /l/[handle] when cover_url is present.
UPDATE public.launches
   SET cover_url = 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/vendor-photos/omni-bd1fdbfc-bfbf-490b-9478-735b17bf8188.png'
 WHERE handle = 'sauce-mamas-workshop-june';

UPDATE public.launches
   SET cover_url = 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/vendor-photos/omni-284232cd-678f-4a50-8f5d-0772602c57c0.png'
 WHERE handle = 'wildflour-may-21';

UPDATE public.launches
   SET cover_url = 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/vendor-photos/omni-35fc362d-021b-4793-bc87-2d5860e18a09.png'
 WHERE handle = 'baxter-produce-may-21';

-- Verify:
SELECT handle, title, cover_url IS NOT NULL AS has_cover, hero_image_url IS NOT NULL AS has_hero
  FROM public.launches
 WHERE is_demo = true
 ORDER BY handle;

-- ---------------------------------------------------------------------------
-- Hero copy update — site_config (overrides app/page.js DEFAULTS at runtime).
-- The landing page reads these two keys on every render via the Supabase anon
-- client, so updating site_config takes effect WITHOUT a redeploy.
-- ---------------------------------------------------------------------------
INSERT INTO public.site_config (key, value) VALUES
  ('hero_headline_line1', 'You Want Orders.'),
  ('hero_subtext',        'You don''t want the DMs, texts, and calls to get them. Let Dropvine handle that.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verify the hero copy is set:
SELECT key, value FROM public.site_config
 WHERE key IN ('hero_headline_line1', 'hero_subtext')
 ORDER BY key;
