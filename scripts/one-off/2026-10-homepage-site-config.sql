-- ===========================================================================
-- Homepage copy in site_config: add the new home_* keys, remove retired keys
-- ===========================================================================
--
-- One-off. Run by hand in the Supabase SQL Editor after deploying the code
-- that reads the home_* keys (app/page.js). Nothing runs this automatically.
--
--   1. Inserts every home_* key with the text the homepage shows today
--      (same as HOME_COPY_DEFAULTS in lib/site-config/home-copy.js). Keys
--      that already exist are left as they are.
--   2. Deletes every site_config row that no live code reads. Kept:
--        logo_url, hero_primary_cta, hero_primary_cta_href  (shared nav)
--        logo_url, home_*                                   (homepage)
--        footer_tagline                                     (shared footer)
--
-- supabase/migrations/2026-06-direct-site-copy.sql and
-- 2026-06-fixes-card-contrast-and-logos.sql insert some of the deleted keys.
-- Both are marked DO NOT RE-RUN; re-running either would bring those unused
-- rows back.
--
-- The homepage looks the same before and after: a missing or empty home_*
-- key already falls back to this same text.

-- ---------------------------------------------------------------------------
-- Preview (read-only). Step 1: rows that will be inserted.
-- ---------------------------------------------------------------------------
with new_rows (key, value) as (values
  ('home_hero_eyebrow',            'For cottage bakers'),
  ('home_hero_headline_1',         'You bake.'),
  ('home_hero_headline_2',         'Dropvine handles the selling.'),
  ('home_hero_subtext',            'No more taking orders through DMs. Fill out one form and Dropvine builds your order page, emails your customers, and keeps every order in one place.'),
  ('home_hero_cta',                'Start your 30-day free trial'),
  ('home_hero_note',               'Dropvine never takes a cut of your sales. No card needed to start.'),
  ('home_pricing_headline',        'Try it free for 30 days.'),
  ('home_pricing_subtext',         'Your trial includes everything in Shop. No card needed.'),
  ('home_tier_maker_price',        '$10'),
  ('home_tier_maker_period',       '/ month'),
  ('home_tier_maker_tagline',      'For bakers who sell every week.'),
  ('home_tier_maker_features',     E'Unlimited drops\nAll five ways to sell\nCustom sales page for every drop\nAutomatic emails to your list\nOrder list, stock limits, and sold-out alerts\nDropvine badge'),
  ('home_tier_shop_price',         '$24'),
  ('home_tier_shop_period',        '/ month'),
  ('home_tier_shop_tagline',       'For bakers building a following.'),
  ('home_tier_shop_features',      E'Everything in Maker\nYour own shop page, always on, even between drops\nAutomatic emails + texts (coming soon)\nFollow button to organically grow your list\nCustomer reviews\nNo Dropvine badge'),
  ('home_tier_premium_price',      '$455'),
  ('home_tier_premium_period',     '/ year'),
  ('home_tier_premium_tagline',    'For bakers who want it done with them.'),
  ('home_tier_premium_features',   E'Everything in Shop\nHelp setting up your first drop\nA direct line to me, plus a monthly check-in\nMonthly product photo touch-ups\nA featured spot on Dropvine each month'),
  ('home_premium_badge',           'Launch pricing · 25 spots'),
  ('home_premium_original_price',  '$650'),
  ('home_premium_deadline_note',   'Launch pricing through Dec 31.'),
  ('home_final_headline',          'Spend your week baking, not answering messages.'),
  ('home_final_cta',               'Start your 30-day free trial')
)
select n.key, n.value as will_insert
from new_rows n
where not exists (select 1 from public.site_config c where c.key = n.key)
order by n.key;

-- ---------------------------------------------------------------------------
-- Preview (read-only). Step 2: rows that will be deleted.
-- ---------------------------------------------------------------------------
select key, value as will_delete
from public.site_config
where key <> all (array[
  'logo_url', 'hero_primary_cta', 'hero_primary_cta_href', 'footer_tagline',
  'home_hero_eyebrow', 'home_hero_headline_1', 'home_hero_headline_2',
  'home_hero_subtext', 'home_hero_cta', 'home_hero_note',
  'home_pricing_headline', 'home_pricing_subtext',
  'home_tier_maker_price', 'home_tier_maker_period', 'home_tier_maker_tagline', 'home_tier_maker_features',
  'home_tier_shop_price', 'home_tier_shop_period', 'home_tier_shop_tagline', 'home_tier_shop_features',
  'home_tier_premium_price', 'home_tier_premium_period', 'home_tier_premium_tagline', 'home_tier_premium_features',
  'home_premium_badge', 'home_premium_original_price', 'home_premium_deadline_note',
  'home_final_headline', 'home_final_cta'
])
order by key;

-- ---------------------------------------------------------------------------
-- Apply: insert and delete in one transaction.
-- ---------------------------------------------------------------------------
begin;

insert into public.site_config (key, value) values
  ('home_hero_eyebrow',            'For cottage bakers'),
  ('home_hero_headline_1',         'You bake.'),
  ('home_hero_headline_2',         'Dropvine handles the selling.'),
  ('home_hero_subtext',            'No more taking orders through DMs. Fill out one form and Dropvine builds your order page, emails your customers, and keeps every order in one place.'),
  ('home_hero_cta',                'Start your 30-day free trial'),
  ('home_hero_note',               'Dropvine never takes a cut of your sales. No card needed to start.'),
  ('home_pricing_headline',        'Try it free for 30 days.'),
  ('home_pricing_subtext',         'Your trial includes everything in Shop. No card needed.'),
  ('home_tier_maker_price',        '$10'),
  ('home_tier_maker_period',       '/ month'),
  ('home_tier_maker_tagline',      'For bakers who sell every week.'),
  ('home_tier_maker_features',     E'Unlimited drops\nAll five ways to sell\nCustom sales page for every drop\nAutomatic emails to your list\nOrder list, stock limits, and sold-out alerts\nDropvine badge'),
  ('home_tier_shop_price',         '$24'),
  ('home_tier_shop_period',        '/ month'),
  ('home_tier_shop_tagline',       'For bakers building a following.'),
  ('home_tier_shop_features',      E'Everything in Maker\nYour own shop page, always on, even between drops\nAutomatic emails + texts (coming soon)\nFollow button to organically grow your list\nCustomer reviews\nNo Dropvine badge'),
  ('home_tier_premium_price',      '$455'),
  ('home_tier_premium_period',     '/ year'),
  ('home_tier_premium_tagline',    'For bakers who want it done with them.'),
  ('home_tier_premium_features',   E'Everything in Shop\nHelp setting up your first drop\nA direct line to me, plus a monthly check-in\nMonthly product photo touch-ups\nA featured spot on Dropvine each month'),
  ('home_premium_badge',           'Launch pricing · 25 spots'),
  ('home_premium_original_price',  '$650'),
  ('home_premium_deadline_note',   'Launch pricing through Dec 31.'),
  ('home_final_headline',          'Spend your week baking, not answering messages.'),
  ('home_final_cta',               'Start your 30-day free trial')
on conflict (key) do nothing;

delete from public.site_config
where key <> all (array[
  'logo_url', 'hero_primary_cta', 'hero_primary_cta_href', 'footer_tagline',
  'home_hero_eyebrow', 'home_hero_headline_1', 'home_hero_headline_2',
  'home_hero_subtext', 'home_hero_cta', 'home_hero_note',
  'home_pricing_headline', 'home_pricing_subtext',
  'home_tier_maker_price', 'home_tier_maker_period', 'home_tier_maker_tagline', 'home_tier_maker_features',
  'home_tier_shop_price', 'home_tier_shop_period', 'home_tier_shop_tagline', 'home_tier_shop_features',
  'home_tier_premium_price', 'home_tier_premium_period', 'home_tier_premium_tagline', 'home_tier_premium_features',
  'home_premium_badge', 'home_premium_original_price', 'home_premium_deadline_note',
  'home_final_headline', 'home_final_cta'
]);

commit;

-- Check afterwards: should list exactly the kept keys.
-- select key from public.site_config order by key;
