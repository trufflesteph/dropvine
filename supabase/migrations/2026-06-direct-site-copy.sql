-- ===========================================================================
-- Dropvine Direct — seed editable marketing-copy keys into `site_config`
-- ===========================================================================
-- Idempotent: each row is inserted only if the key does not already exist.
-- Re-running this migration after an admin has edited values via
-- /admin/direct/settings will NOT clobber their changes.
--
-- Sections seeded:
--   • How it works   (headline + 3 numbered steps)
--   • Use cases      (headline + 3 emoji cards)
--   • Example        (business name, tagline, description, 4 stat tiles)
--   • Collection modes (headline, subtext, 4 mode cards)
--   • Bottom CTA     (headline, subtext, button label)

insert into public.site_config (key, value) values
  -- How it works
  ('how_it_works_headline',    'How it works'),
  ('how_it_works_step1_title', '01 — Fill out one form'),
  ('how_it_works_step1_body',  'Set your products and pricing, pick a deadline. Takes five minutes.'),
  ('how_it_works_step2_title', '02 — Your page goes live instantly'),
  ('how_it_works_step2_body',  'Dropvine builds your page automatically. Your customer list gets an SMS and email with the link — no extra steps on your end.'),
  ('how_it_works_step3_title', '03 — Orders come in, you stay organized'),
  ('how_it_works_step3_body',  'Every order is logged in your dashboard. Customers pay you directly via Venmo. You mark orders paid and fulfilled as they come in — all in one place.'),

  -- Use cases
  ('use_cases_headline', 'Built for businesses that make things on a schedule.'),
  ('use_case_1_emoji',   '🥐'),
  ('use_case_1_title',   'Weekly bakery menus'),
  ('use_case_1_body',    'Upload your menu and photos, set a pre-order cutoff, and send your list a link. Customers pre-order, you know exactly what to bake. No guessing, no waste.'),
  ('use_case_2_emoji',   '🌿'),
  ('use_case_2_title',   'Farmers market vendors'),
  ('use_case_2_body',    'Post your weekly harvest or product list before market day. Collect pre-orders so your best stuff is spoken for before you load the van.'),
  ('use_case_3_emoji',   '🎨'),
  ('use_case_3_title',   'Limited-run makers'),
  ('use_case_3_body',    'Releasing something in small quantities? Set a pre-order window, cap the orders, and open it to your list. First come, first served — automatically.'),

  -- Example
  ('example_business_name', 'Good Flour Bakery'),
  ('example_tagline',       'Saturday Pre-Order Window'),
  ('example_description',   'Sourdough, pastries, and seasonal specials. Orders close Thursday at 8pm. Pickup Saturday 9am–noon.'),
  ('example_stat_1_value',  '47'),
  ('example_stat_1_label',  'orders placed'),
  ('example_stat_2_value',  '$0'),
  ('example_stat_2_label',  'wasted'),
  ('example_stat_3_value',  '3 min'),
  ('example_stat_3_label',  'to set up'),
  ('example_stat_4_value',  '0'),
  ('example_stat_4_label',  'DMs to manage'),

  -- Collection modes
  ('modes_headline', 'Pick how your customers commit.'),
  ('modes_subtext',  'Not every business runs the same way. Dropvine has four collection modes — use the one that fits your workflow.'),
  ('mode_1_name',    'Waitlist'),
  ('mode_1_body',    'Get people in line before you open. No payment, no friction — just names and excitement piling up.'),
  ('mode_2_name',    'Pre-order'),
  ('mode_2_body',    'Customers commit and pay through Venmo before you make it. You know exactly what to produce.'),
  ('mode_3_name',    'Reservation'),
  ('mode_3_body',    'Lock in the spot, collect payment later. Great for workshops, sessions, and events.'),
  ('mode_4_name',    'Deposit'),
  ('mode_4_body',    'A small payment now, the rest at pickup. Lower the barrier to commit while keeping it serious.'),

  -- Bottom CTA
  ('bottom_cta_headline', 'Ready to stop managing orders through DMs?'),
  ('bottom_cta_subtext',  'Set your products and pricing, pick a deadline, and let Dropvine handle the rest.'),
  ('bottom_cta_button',   'Try it free →')
on conflict (key) do nothing;
