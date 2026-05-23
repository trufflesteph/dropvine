-- =============================================================================
-- Dropvine \u2014 4 focused fixes (June 2026)
-- =============================================================================
-- Three small SQL statements that pair with the matching code changes in:
--   \u2022 app/page.js              (brighter card overlays + new use-case default)
--   \u2022 app/direct/[slug]/page.js (Live/Upcoming/Past lifecycle on DropCard)
--
-- Run after deploying the code. Idempotent \u2014 safe to re-run any time.
-- =============================================================================

-- 1) Use-case section headline override (DB value overrides app/page.js DEFAULTS).
--    Old: "Built for businesses that make things on a schedule."
--    New: "Dropvine sells for you."
INSERT INTO public.site_config (key, value) VALUES
  ('use_cases_headline', 'Dropvine sells for you.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2-4) Vendor profile logos for the three demo vendors. Without these the
-- /direct/[slug] page renders a "?" placeholder in the square hero tile.
UPDATE public.direct_vendors
   SET logo_url = 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/vendor-photos/omni-bd1fdbfc-bfbf-490b-9478-735b17bf8188.png'
 WHERE slug = 'sauce-mamas';

UPDATE public.direct_vendors
   SET logo_url = 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/vendor-photos/omni-284232cd-678f-4a50-8f5d-0772602c57c0.png'
 WHERE slug = 'wildflour-cookies';

UPDATE public.direct_vendors
   SET logo_url = 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/vendor-photos/omni-35fc362d-021b-4793-bc87-2d5860e18a09.png'
 WHERE slug = 'baxter-farmstand';

-- Verify:
SELECT key, value FROM public.site_config WHERE key = 'use_cases_headline';
SELECT slug, business_name, logo_url IS NOT NULL AS has_logo
  FROM public.direct_vendors WHERE is_demo = true ORDER BY slug;
