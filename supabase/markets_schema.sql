-- =====================================================================
-- Dropvine Markets — Additive schema for the white-label farmers-market PWA.
-- Run this in the Supabase SQL Editor AFTER `schema.sql`.
-- This file ONLY adds new tables, indexes, RLS policies, and seed data.
-- It does NOT modify any existing Dropvine Direct tables.
-- =====================================================================

-- Useful extension for case-insensitive text (slugs, handles)
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- 1) market_config — single-row-per-market configuration / theming
-- ---------------------------------------------------------------------
create table if not exists public.market_config (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text,
  season text,
  primary_color text default '#2F5233',
  accent_color text default '#E2A93C',
  logo_url text,
  pwa_icon_url text,
  pwa_short_name text,
  pwa_theme_color text,
  pwa_background_color text default '#FAF7F2',
  map_layout jsonb default '{"width":1000,"height":700,"stalls":[]}'::jsonb,
  -- Street-schematic map controls (drive the auto-generated SVG)
  map_booth_count integer default 12,
  map_orientation text default 'horizontal' check (map_orientation in ('horizontal','vertical')),
  map_street_name text,
  map_cross_street_start text,
  map_cross_street_end text,
  venmo_platform_handle text,
  contact_email text,
  social_links jsonb default '{}'::jsonb,
  about_md text,
  is_active boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_config_active_idx on public.market_config(is_active);
-- Only one active market at a time
create unique index if not exists market_config_one_active_idx
  on public.market_config((true)) where is_active = true;

-- Idempotent column additions for re-runs (safe if already present).
alter table public.market_config add column if not exists map_booth_count integer default 12;
alter table public.market_config add column if not exists map_orientation text default 'horizontal';
alter table public.market_config add column if not exists map_street_name text;
alter table public.market_config add column if not exists map_cross_street_start text;
alter table public.market_config add column if not exists map_cross_street_end text;

-- ---------------------------------------------------------------------
-- 2) market_dates — every individual market day (Wednesdays etc.)
-- ---------------------------------------------------------------------
create table if not exists public.market_dates (
  id uuid primary key default gen_random_uuid(),
  market_config_id uuid not null references public.market_config(id) on delete cascade,
  date date not null,
  start_time time not null default '15:00',
  end_time time not null default '20:00',
  weather_forecast text,
  is_cancelled boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (market_config_id, date)
);
create index if not exists market_dates_config_idx on public.market_dates(market_config_id);
create index if not exists market_dates_date_idx on public.market_dates(date);

-- ---------------------------------------------------------------------
-- 3) vendors
-- ---------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  market_config_id uuid not null references public.market_config(id) on delete cascade,
  name text not null,
  slug citext unique not null,
  tagline text,
  description text,
  logo_url text,
  cover_url text,
  categories text[] default '{}',
  venmo_handle text,             -- vendor Venmo username (no leading @)
  email text,
  phone text,
  website text,
  instagram_handle text,
  accepts_preorders boolean default false,
  booth_number integer,          -- position on the auto-generated street map (1..map_booth_count)
  map_position jsonb,            -- optional override: {x, y, stallId}
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendors_market_idx on public.vendors(market_config_id);
create index if not exists vendors_active_idx on public.vendors(is_active);

-- Idempotent column additions for re-runs.
alter table public.vendors add column if not exists booth_number integer;

-- ---------------------------------------------------------------------
-- 4) market_attendance — which vendors are at which dates
-- ---------------------------------------------------------------------
create table if not exists public.market_attendance (
  id uuid primary key default gen_random_uuid(),
  market_date_id uuid not null references public.market_dates(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed','tentative','cancelled')),
  created_at timestamptz not null default now(),
  unique (market_date_id, vendor_id)
);
create index if not exists market_attendance_date_idx on public.market_attendance(market_date_id);
create index if not exists market_attendance_vendor_idx on public.market_attendance(vendor_id);

-- ---------------------------------------------------------------------
-- 5) vendor_posts — feed posts by vendors
-- ---------------------------------------------------------------------
create table if not exists public.vendor_posts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  title text,
  body text not null,
  image_url text,
  posted_at timestamptz not null default now(),
  expires_at timestamptz,
  is_published boolean default true
);
create index if not exists vendor_posts_vendor_idx on public.vendor_posts(vendor_id);
create index if not exists vendor_posts_posted_idx on public.vendor_posts(posted_at desc);

-- ---------------------------------------------------------------------
-- 6) products
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0,
  image_url text,
  category text,
  is_available boolean default true,
  stock_quantity integer,
  display_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_vendor_idx on public.products(vendor_id);
create index if not exists products_available_idx on public.products(is_available);

-- ---------------------------------------------------------------------
-- 7) orders — Venmo-based pre-orders
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  short_code text unique not null default upper(substr(md5(random()::text), 1, 8)),
  shopper_id uuid references auth.users(id) on delete set null,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  market_date_id uuid references public.market_dates(id) on delete set null,
  subtotal_cents integer not null default 0,
  total_cents integer not null default 0,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','payment_received','fulfilled','cancelled','refunded')),
  venmo_note text,
  stripe_payment_intent_id text,           -- nullable; reserved for future
  payment_received_at timestamptz,
  fulfilled_at timestamptz,
  pickup_window text,
  shopper_email text,
  shopper_name text,
  shopper_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_shopper_idx on public.orders(shopper_id);
create index if not exists orders_vendor_idx on public.orders(vendor_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_idx on public.orders(created_at desc);

-- ---------------------------------------------------------------------
-- 8) order_items
-- ---------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0,
  line_total_cents integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ---------------------------------------------------------------------
-- 9) shopper_profiles — extends auth.users for the Markets module
-- ---------------------------------------------------------------------
create table if not exists public.shopper_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
  phone text,
  preferences jsonb default '{}'::jsonb,
  notification_opt_in boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10) push_subscriptions — Web Push (one shopper may have multiple devices)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_shopper_idx on public.push_subscriptions(shopper_id);

-- ---------------------------------------------------------------------
-- 11) vendor_follows
-- ---------------------------------------------------------------------
create table if not exists public.vendor_follows (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shopper_id, vendor_id)
);
create index if not exists vendor_follows_shopper_idx on public.vendor_follows(shopper_id);
create index if not exists vendor_follows_vendor_idx on public.vendor_follows(vendor_id);

-- ---------------------------------------------------------------------
-- 12) passport_stamps — collected by shoppers via QR scan
-- ---------------------------------------------------------------------
create table if not exists public.passport_stamps (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  market_date_id uuid references public.market_dates(id) on delete set null,
  stamped_at timestamptz not null default now(),
  unique (shopper_id, vendor_id, market_date_id)
);
create index if not exists passport_stamps_shopper_idx on public.passport_stamps(shopper_id);
create index if not exists passport_stamps_vendor_idx on public.passport_stamps(vendor_id);

-- ---------------------------------------------------------------------
-- 13) challenges
-- ---------------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  market_config_id uuid not null references public.market_config(id) on delete cascade,
  title text not null,
  description text,
  icon text,
  target_count integer not null default 1,
  reward_text text,
  badge_id uuid,                            -- linked below after badges table
  is_active boolean default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists challenges_market_idx on public.challenges(market_config_id);

-- ---------------------------------------------------------------------
-- 14) badges
-- ---------------------------------------------------------------------
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  market_config_id uuid not null references public.market_config(id) on delete cascade,
  name text not null,
  description text,
  icon_url text,
  criteria_text text,
  created_at timestamptz not null default now()
);

-- Now add the FK from challenges.badge_id -> badges.id
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'challenges' and constraint_name = 'challenges_badge_id_fkey'
  ) then
    alter table public.challenges
      add constraint challenges_badge_id_fkey
      foreign key (badge_id) references public.badges(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 15) challenge_completions
-- ---------------------------------------------------------------------
create table if not exists public.challenge_completions (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (shopper_id, challenge_id)
);

-- ---------------------------------------------------------------------
-- 16) shopper_badges
-- ---------------------------------------------------------------------
create table if not exists public.shopper_badges (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (shopper_id, badge_id)
);

-- ---------------------------------------------------------------------
-- 17) child_profiles — POP Kids
-- ---------------------------------------------------------------------
create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_shopper_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  age integer,
  avatar_url text,
  total_pop_tokens integer default 0,
  created_at timestamptz not null default now()
);
create index if not exists child_profiles_parent_idx on public.child_profiles(parent_shopper_id);

-- ---------------------------------------------------------------------
-- 18) pop_tokens — virtual currency for POP Kids
-- ---------------------------------------------------------------------
create table if not exists public.pop_tokens (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  amount integer not null,
  source text not null check (source in ('purchase','reward','admin')),
  market_date_id uuid references public.market_dates(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists pop_tokens_child_idx on public.pop_tokens(child_profile_id);

-- ---------------------------------------------------------------------
-- 19) pop_redemptions
-- ---------------------------------------------------------------------
create table if not exists public.pop_redemptions (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  amount integer not null check (amount > 0),
  market_date_id uuid references public.market_dates(id) on delete set null,
  redeemed_at timestamptz not null default now()
);
create index if not exists pop_redemptions_child_idx on public.pop_redemptions(child_profile_id);
create index if not exists pop_redemptions_vendor_idx on public.pop_redemptions(vendor_id);

-- ---------------------------------------------------------------------
-- 20) pop_stamp_types
-- ---------------------------------------------------------------------
create table if not exists public.pop_stamp_types (
  id uuid primary key default gen_random_uuid(),
  market_config_id uuid not null references public.market_config(id) on delete cascade,
  name text not null,
  icon text,
  description text,
  token_reward integer default 0,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 21) pop_stamps_earned
-- ---------------------------------------------------------------------
create table if not exists public.pop_stamps_earned (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  pop_stamp_type_id uuid not null references public.pop_stamp_types(id) on delete cascade,
  market_date_id uuid references public.market_dates(id) on delete set null,
  earned_at timestamptz not null default now()
);
create index if not exists pop_stamps_earned_child_idx on public.pop_stamps_earned(child_profile_id);

-- ---------------------------------------------------------------------
-- 22) flash_deals
-- ---------------------------------------------------------------------
create table if not exists public.flash_deals (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  market_date_id uuid references public.market_dates(id) on delete set null,
  title text not null,
  description text,
  original_price_cents integer,
  sale_price_cents integer,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean default true,
  created_at timestamptz not null default now()
);
create index if not exists flash_deals_vendor_idx on public.flash_deals(vendor_id);
create index if not exists flash_deals_active_idx on public.flash_deals(is_active);

-- ---------------------------------------------------------------------
-- 23) fulfillment_tokens — magic-link tokens for vendors
-- ---------------------------------------------------------------------
create table if not exists public.fulfillment_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fulfillment_tokens_order_idx on public.fulfillment_tokens(order_id);
create index if not exists fulfillment_tokens_token_idx on public.fulfillment_tokens(token);

-- ---------------------------------------------------------------------
-- 24) market_amenities
-- ---------------------------------------------------------------------
create table if not exists public.market_amenities (
  id uuid primary key default gen_random_uuid(),
  market_config_id uuid not null references public.market_config(id) on delete cascade,
  name text not null,
  icon text,
  description text,
  map_position jsonb,
  display_order integer default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 25) post_submissions — Tally vendor post submissions awaiting review
-- ---------------------------------------------------------------------
create table if not exists public.post_submissions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete set null,
  vendor_email text,
  raw_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  processed_at timestamptz,
  processed_by_role text,
  resulting_post_id uuid references public.vendor_posts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists post_submissions_status_idx on public.post_submissions(status);

-- ---------------------------------------------------------------------
-- 26) product_submissions — Tally product submissions awaiting review
-- ---------------------------------------------------------------------
create table if not exists public.product_submissions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete set null,
  vendor_email text,
  raw_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  processed_at timestamptz,
  processed_by_role text,
  resulting_product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists product_submissions_status_idx on public.product_submissions(status);

-- ---------------------------------------------------------------------
-- 27) admin_audit_log — track admin actions
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_role text not null check (admin_role in ('platform','organiser')),
  action text not null,
  target_type text,
  target_id uuid,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);

-- =====================================================================
-- TRIGGER: auto-create shopper_profile on signup (additive — keeps
-- existing handle_new_user trigger from Dropvine Direct intact).
-- =====================================================================
create or replace function public.handle_new_shopper() returns trigger as $$
begin
  insert into public.shopper_profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_shopper on auth.users;
create trigger on_auth_user_created_shopper
  after insert on auth.users
  for each row execute function public.handle_new_shopper();

-- =====================================================================
-- updated_at maintenance for tables with updated_at column
-- =====================================================================
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array[
    'market_config','vendors','products','orders','shopper_profiles'
  ]) loop
    execute format(
      'drop trigger if exists trg_touch_%s on public.%I;
       create trigger trg_touch_%s before update on public.%I
       for each row execute function public.touch_updated_at();', t, t, t, t);
  end loop;
end $$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.market_config enable row level security;
alter table public.market_dates enable row level security;
alter table public.vendors enable row level security;
alter table public.market_attendance enable row level security;
alter table public.vendor_posts enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shopper_profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.vendor_follows enable row level security;
alter table public.passport_stamps enable row level security;
alter table public.challenges enable row level security;
alter table public.badges enable row level security;
alter table public.challenge_completions enable row level security;
alter table public.shopper_badges enable row level security;
alter table public.child_profiles enable row level security;
alter table public.pop_tokens enable row level security;
alter table public.pop_redemptions enable row level security;
alter table public.pop_stamp_types enable row level security;
alter table public.pop_stamps_earned enable row level security;
alter table public.flash_deals enable row level security;
alter table public.fulfillment_tokens enable row level security;
alter table public.market_amenities enable row level security;
alter table public.post_submissions enable row level security;
alter table public.product_submissions enable row level security;
alter table public.admin_audit_log enable row level security;

-- ---------- PUBLIC READ (active/published content) ----------
drop policy if exists market_config_public_read on public.market_config;
create policy market_config_public_read on public.market_config
  for select using (is_active = true);

drop policy if exists market_dates_public_read on public.market_dates;
create policy market_dates_public_read on public.market_dates for select using (true);

drop policy if exists vendors_public_read on public.vendors;
create policy vendors_public_read on public.vendors
  for select using (is_active = true);

drop policy if exists market_attendance_public_read on public.market_attendance;
create policy market_attendance_public_read on public.market_attendance for select using (true);

drop policy if exists vendor_posts_public_read on public.vendor_posts;
create policy vendor_posts_public_read on public.vendor_posts
  for select using (is_published = true);

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select using (is_available = true);

drop policy if exists challenges_public_read on public.challenges;
create policy challenges_public_read on public.challenges for select using (is_active = true);

drop policy if exists badges_public_read on public.badges;
create policy badges_public_read on public.badges for select using (true);

drop policy if exists pop_stamp_types_public_read on public.pop_stamp_types;
create policy pop_stamp_types_public_read on public.pop_stamp_types
  for select using (is_active = true);

drop policy if exists flash_deals_public_read on public.flash_deals;
create policy flash_deals_public_read on public.flash_deals
  for select using (is_active = true);

drop policy if exists market_amenities_public_read on public.market_amenities;
create policy market_amenities_public_read on public.market_amenities for select using (true);

-- ---------- SHOPPER-OWNED ROWS ----------
drop policy if exists shopper_profiles_self on public.shopper_profiles;
create policy shopper_profiles_self on public.shopper_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists push_subscriptions_self on public.push_subscriptions;
create policy push_subscriptions_self on public.push_subscriptions
  for all using (auth.uid() = shopper_id) with check (auth.uid() = shopper_id);

drop policy if exists vendor_follows_self on public.vendor_follows;
create policy vendor_follows_self on public.vendor_follows
  for all using (auth.uid() = shopper_id) with check (auth.uid() = shopper_id);

drop policy if exists passport_stamps_self on public.passport_stamps;
create policy passport_stamps_self on public.passport_stamps
  for all using (auth.uid() = shopper_id) with check (auth.uid() = shopper_id);

drop policy if exists challenge_completions_self on public.challenge_completions;
create policy challenge_completions_self on public.challenge_completions
  for all using (auth.uid() = shopper_id) with check (auth.uid() = shopper_id);

drop policy if exists shopper_badges_self on public.shopper_badges;
create policy shopper_badges_self on public.shopper_badges
  for all using (auth.uid() = shopper_id) with check (auth.uid() = shopper_id);

drop policy if exists child_profiles_self on public.child_profiles;
create policy child_profiles_self on public.child_profiles
  for all using (auth.uid() = parent_shopper_id) with check (auth.uid() = parent_shopper_id);

drop policy if exists pop_tokens_self on public.pop_tokens;
create policy pop_tokens_self on public.pop_tokens
  for select using (
    exists (select 1 from public.child_profiles c where c.id = child_profile_id and c.parent_shopper_id = auth.uid())
  );

drop policy if exists pop_redemptions_self on public.pop_redemptions;
create policy pop_redemptions_self on public.pop_redemptions
  for select using (
    exists (select 1 from public.child_profiles c where c.id = child_profile_id and c.parent_shopper_id = auth.uid())
  );

drop policy if exists pop_stamps_earned_self on public.pop_stamps_earned;
create policy pop_stamps_earned_self on public.pop_stamps_earned
  for select using (
    exists (select 1 from public.child_profiles c where c.id = child_profile_id and c.parent_shopper_id = auth.uid())
  );

-- Orders: shoppers may read & insert their own orders. Vendors are read
-- server-side using the service role key, so no extra policy is needed.
drop policy if exists orders_self_read on public.orders;
create policy orders_self_read on public.orders
  for select using (auth.uid() = shopper_id);

drop policy if exists orders_anyone_insert on public.orders;
create policy orders_anyone_insert on public.orders for insert with check (true);

-- Tally / fulfillment / submissions / audit: NO public policies.
-- These are accessed exclusively via server-side service role.

-- =====================================================================
-- SEED DATA — Willamette Summer Street Market
-- =====================================================================
do $$
declare
  v_market_id uuid;
  v_brookside uuid;
  v_terra uuid;
  v_yarrow uuid;
  v_riverside uuid;
  v_mossy uuid;
  v_indigo uuid;
  v_d_may13 uuid;
  v_d_may20 uuid;
  v_d_may27 uuid;
  v_d_jun3  uuid;
  v_d_jun10 uuid;
  v_badge_explorer uuid;
  v_badge_foodie uuid;
  v_badge_pop uuid;
  v_chal_visit5 uuid;
  v_chal_taste3 uuid;
begin
  -- Skip if already seeded
  if exists (select 1 from public.market_config where name = 'Willamette Summer Street Market') then
    return;
  end if;

  insert into public.market_config (name, subtitle, season, primary_color, accent_color,
    pwa_short_name, pwa_theme_color, contact_email, social_links, about_md,
    map_booth_count, map_orientation, map_street_name, map_cross_street_start, map_cross_street_end,
    is_active)
  values (
    'Willamette Summer Street Market',
    'Wednesdays after work in downtown Eugene',
    'Summer 2026',
    '#2F5233',
    '#E2A93C',
    'WSSM',
    '#2F5233',
    'hello@willamettestreet.market',
    jsonb_build_object('instagram','@willamettestreetmarket','website','https://willamettestreet.market'),
    '## Welcome to the Willamette Summer Street Market

Every Wednesday from May through September we close down Willamette Falls Drive between 12th and 15th streets for an open-air street market featuring local farmers, makers, and food carts.',
    12,
    'horizontal',
    'Willamette Falls Drive',
    '12th St',
    '15th St',
    true
  ) returning id into v_market_id;

  -- Vendors (booth_number assigns them onto the auto-generated street map; 1..map_booth_count)
  insert into public.vendors (market_config_id, name, slug, tagline, description, categories, venmo_handle, accepts_preorders, booth_number, instagram_handle, is_active) values
    (v_market_id, 'Brookside Farm',  'brookside-farm',  'Pasture-raised eggs & seasonal produce', 'A family-run organic farm just outside Junction City.', array['produce','eggs'], 'brookside-farm', true, 1, '@brooksidefarmco', true)
    returning id into v_brookside;
  insert into public.vendors (market_config_id, name, slug, tagline, description, categories, venmo_handle, accepts_preorders, booth_number, instagram_handle, is_active) values
    (v_market_id, 'Terra Bread Co.', 'terra-bread', 'Wood-fired sourdough', 'Naturally leavened breads and pastries baked overnight.', array['bakery','pastries'], 'terra-bread', true, 2, '@terrabreadco', true)
    returning id into v_terra;
  insert into public.vendors (market_config_id, name, slug, tagline, description, categories, venmo_handle, accepts_preorders, booth_number, instagram_handle, is_active) values
    (v_market_id, 'Yarrow & Yew',    'yarrow-yew',    'Botanical apothecary',     'Hand-blended teas, salves, and tinctures.', array['apothecary','wellness'], 'yarrow-yew', false, 4, '@yarrowandyew', true)
    returning id into v_yarrow;
  insert into public.vendors (market_config_id, name, slug, tagline, description, categories, venmo_handle, accepts_preorders, booth_number, instagram_handle, is_active) values
    (v_market_id, 'Riverside Coffee','riverside-coffee','Single-origin pour-overs', 'Direct-trade beans from the Willamette roastery.', array['coffee','drinks'], 'riverside-coffee', true, 7, '@riversidecoffeeroasters', true)
    returning id into v_riverside;
  insert into public.vendors (market_config_id, name, slug, tagline, description, categories, venmo_handle, accepts_preorders, booth_number, instagram_handle, is_active) values
    (v_market_id, 'Mossy Goods',     'mossy-goods',   'Hand-thrown ceramics',     'Functional stoneware mugs, bowls, and planters.', array['crafts','ceramics'], 'mossy-goods', false, 9, '@mossy.goods', true)
    returning id into v_mossy;
  insert into public.vendors (market_config_id, name, slug, tagline, description, categories, venmo_handle, accepts_preorders, booth_number, instagram_handle, is_active) values
    (v_market_id, 'Indigo Tacos',    'indigo-tacos',  'Heirloom corn tortillas',  'Pop-up taqueria with rotating regional menu.', array['food','tacos'], 'indigo-tacos', true, 11, '@indigotacospdx', true)
    returning id into v_indigo;

  -- Market dates: every Wednesday May 13 \u2014 Sep 9, 2026 (18 dates inclusive).
  insert into public.market_dates (market_config_id, date, start_time, end_time)
  select v_market_id, d::date, '15:00', '20:00'
  from generate_series('2026-05-13'::date, '2026-09-09'::date, interval '7 days') d;

  -- Capture first five date IDs for attendance examples.
  select id into v_d_may13 from public.market_dates where market_config_id = v_market_id and date = '2026-05-13';
  select id into v_d_may20 from public.market_dates where market_config_id = v_market_id and date = '2026-05-20';
  select id into v_d_may27 from public.market_dates where market_config_id = v_market_id and date = '2026-05-27';
  select id into v_d_jun3  from public.market_dates where market_config_id = v_market_id and date = '2026-06-03';
  select id into v_d_jun10 from public.market_dates where market_config_id = v_market_id and date = '2026-06-10';

  -- All vendors confirmed for first 5 weeks
  insert into public.market_attendance (market_date_id, vendor_id, status)
  select md.id, v.id, 'confirmed'
  from public.market_dates md
  cross join public.vendors v
  where md.market_config_id = v_market_id
    and v.market_config_id = v_market_id
    and md.date <= '2026-06-10';

  -- Products
  insert into public.products (vendor_id, name, description, price_cents, category, display_order) values
    (v_brookside, 'Pasture-raised eggs (dozen)', 'Mixed brown & blue eggs.', 800, 'eggs', 1),
    (v_brookside, 'Sungold cherry tomato pint', 'Picked Tuesday morning.', 600, 'produce', 2),
    (v_brookside, 'Heirloom lettuce mix (8oz)', 'Living lettuces.', 500, 'produce', 3),
    (v_terra, 'Country sourdough loaf', 'Wild yeast, 24h fermentation.', 1000, 'bread', 1),
    (v_terra, 'Almond croissant', 'Twice-baked with frangipane.', 550, 'pastry', 2),
    (v_terra, 'Olive ciabatta', 'Castelvetrano olives.', 900, 'bread', 3),
    (v_yarrow, 'Calendula salve 1oz', 'For sun-dried hands.', 1600, 'apothecary', 1),
    (v_yarrow, 'Nettle tea blend', 'Loose-leaf, 2oz.', 1400, 'tea', 2),
    (v_riverside, 'Pour-over (12oz)', 'Daily single-origin.', 500, 'drink', 1),
    (v_riverside, 'Whole-bean Ethiopia (12oz)', 'Light roast.', 2200, 'beans', 2),
    (v_mossy, 'Stoneware mug', 'Slate glaze, 10oz.', 4200, 'ceramics', 1),
    (v_indigo, 'Al pastor taco (3 ct)', 'Heirloom corn tortillas.', 1500, 'tacos', 1),
    (v_indigo, 'Carnitas burrito', 'Slow-braised pork shoulder.', 1400, 'burritos', 2);

  -- Amenities
  insert into public.market_amenities (market_config_id, name, icon, description, map_position, display_order) values
    (v_market_id, 'Restrooms',  'Toilet',     'ADA-accessible portable restrooms.', jsonb_build_object('x',80,'y',650), 1),
    (v_market_id, 'Info Booth', 'Info',       'Stop by for the POP Kids Passport!',  jsonb_build_object('x',500,'y',60), 2),
    (v_market_id, 'Bike Parking','Bike',      'Covered racks at 8th & Oak.',         jsonb_build_object('x',900,'y',650), 3),
    (v_market_id, 'Live Music', 'Music',      'Acoustic stage near Pearl.',          jsonb_build_object('x',900,'y',60), 4),
    (v_market_id, 'Seating',    'Armchair',   'Picnic tables in the central plaza.', jsonb_build_object('x',500,'y',320), 5);

  -- Badges
  insert into public.badges (market_config_id, name, description, criteria_text) values
    (v_market_id, 'Market Explorer', 'Visited 5 different vendors in one season.', 'Collect 5 unique passport stamps.')
    returning id into v_badge_explorer;
  insert into public.badges (market_config_id, name, description, criteria_text) values
    (v_market_id, 'Foodie Favorite', 'Tasted from 3 food vendors.', 'Order from 3 food categories.')
    returning id into v_badge_foodie;
  insert into public.badges (market_config_id, name, description, criteria_text) values
    (v_market_id, 'POP Kids Star',   'Earned 10 POP Kids stamps.',   'Complete the POP passport.')
    returning id into v_badge_pop;

  -- Challenges
  insert into public.challenges (market_config_id, title, description, icon, target_count, reward_text, badge_id, is_active, starts_at, ends_at)
  values
    (v_market_id, 'Visit 5 Vendors', 'Stamp your passport at 5 different vendors this season.', 'Footprints', 5, 'Market Explorer badge', v_badge_explorer, true, '2026-05-13','2026-09-09'),
    (v_market_id, 'Taste the Town',  'Order from 3 food vendors this season.',                  'Utensils',   3, 'Foodie Favorite badge', v_badge_foodie,  true, '2026-05-13','2026-09-09');

  -- POP stamp types
  insert into public.pop_stamp_types (market_config_id, name, icon, description, token_reward) values
    (v_market_id, 'Try a new fruit',       'Apple',      'Sample a fruit you have never tried before.', 1),
    (v_market_id, 'Greet a vendor',        'Hand',       'Practice saying hello and thank you.',         1),
    (v_market_id, 'Help carry the basket', 'ShoppingBag','Be a market helper today.',                    1),
    (v_market_id, 'Visit the music stage', 'Music',      'Listen for one whole song.',                   1);

  -- A starter post per vendor
  insert into public.vendor_posts (vendor_id, title, body) values
    (v_brookside, 'See you Wednesday!', 'Pre-orders open through Tuesday at 9pm. Eggs are stacking up nicely.'),
    (v_terra,     'New: olive ciabatta','Tonight''s bake includes a small batch of Castelvetrano olive ciabatta.'),
    (v_riverside,'Featured this week', 'Yirgacheffe washed — bright lemon and jasmine.'),
    (v_indigo,   'Menu update',         'Adding tinga de pollo this week alongside our usual.');

end $$;

-- =====================================================================
-- POST-SEED ADJUSTMENTS — idempotent, run on every execution.
-- =====================================================================
-- Mark July 1, 2026 as a "dark week" for Independence Day so it appears
-- on the calendar with the explanation rather than being silently absent.
update public.market_dates
set is_cancelled = true,
    notes = 'Dark week — Independence Day holiday'
where date = '2026-07-01'
  and market_config_id = (
    select id from public.market_config
    where name = 'Willamette Summer Street Market'
  );
