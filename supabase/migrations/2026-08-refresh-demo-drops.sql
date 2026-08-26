-- Refresh the public homepage demo drops with current dates (August 2026).
-- Keeps the existing handles so homepage links remain stable.

UPDATE public.drops
SET
  title = 'Summer Hot Sauce Workshop - September 12',
  launch_at = '2026-09-12 10:00:00-07:00'::timestamptz,
  closes_at = '2026-09-10 23:59:00-07:00'::timestamptz,
  status = 'published',
  pickup_details = '1234 SE Division St, Portland OR 97202 - September 12, 10 AM-12 PM',
  is_demo = true,
  is_featured_homepage = true,
  featured_order = 1
WHERE handle = 'sauce-mamas-workshop-june';

UPDATE public.drops
SET
  title = 'Wednesday Market Box - Week of September 2',
  launch_at = '2026-09-02 14:00:00-07:00'::timestamptz,
  closes_at = '2026-09-01 23:59:00-07:00'::timestamptz,
  status = 'published',
  pickup_details = 'Wednesdays in Willamette Market, Willamette Falls Drive, West Linn - Wednesday September 2, 4-8 PM. Look for the yellow tent.',
  is_demo = true,
  is_featured_homepage = true,
  featured_order = 2
WHERE handle = 'wildflour-may-21';

UPDATE public.drops
SET
  title = 'Weekly Produce Box - September 3',
  launch_at = '2026-09-03 14:00:00-07:00'::timestamptz,
  closes_at = '2026-09-02 20:00:00-07:00'::timestamptz,
  status = 'published',
  pickup_details = 'Option 1: Willamette Market booth, Thursday September 3, 4-8 PM. Option 2: 456 Willamette Falls Dr, West Linn - Thursday 3-5 PM.',
  is_demo = true,
  is_featured_homepage = true,
  featured_order = 3
WHERE handle = 'baxter-produce-may-21';

-- Verify:
SELECT handle, title, status, launch_at, closes_at, is_featured_homepage, featured_order
  FROM public.drops
 WHERE is_demo = true AND is_featured_homepage = true
 ORDER BY featured_order;
