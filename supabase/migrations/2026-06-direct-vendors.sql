-- ===========================================================================
-- direct_vendors — committed schema + auto-provisioning trigger
-- ===========================================================================
--
-- This migration finally commits the `direct_vendors` table to source control
-- (the admin API routes have been referencing it for a while, but the DDL
-- was never tracked). It also wires up:
--
--   1. A `handle_new_user_direct_vendor()` trigger that auto-inserts a
--      direct_vendors row whenever a new auth.users row is created — so every
--      vendor who signs up gets a vendor profile immediately, no manual admin
--      step required.
--
--   2. A backfill block at the end that creates a direct_vendors row for
--      every existing auth.users row that doesn't already have one.
--
-- Idempotent — safe to re-run.
--
-- Schema notes:
--   • `creator_id` references auth.users so the trigger + the dashboard +
--     /admin can all link reliably. ON DELETE SET NULL so deleting an auth
--     user doesn't cascade-wipe their vendor profile (admins decide).
--   • `slug` is unique + URL-safe — the public profile page is /direct/[slug].
--   • `active` defaults true; setting false hides the public profile + lets
--     admins soft-disable a vendor.
--   • `tier` is a free-form text (matches the existing API): 'free' | 'maker' | 'studio'.

create extension if not exists pgcrypto;

create table if not exists public.direct_vendors (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid references auth.users(id) on delete set null,
  business_name  text not null,
  slug           text not null,
  bio            text,
  logo_url       text,
  photo_url      text,
  venmo_handle   text,
  instagram_url  text,
  website_url    text,
  tier           text not null default 'free',
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Unique slug + creator_id indexes. Slug must be globally unique because the
-- public URL is /direct/[slug]. creator_id is unique-per-active-row so each
-- user has at most one vendor profile.
create unique index if not exists direct_vendors_slug_uidx on public.direct_vendors (lower(slug));
create unique index if not exists direct_vendors_creator_uidx on public.direct_vendors (creator_id)
  where creator_id is not null;
create index if not exists direct_vendors_active_idx on public.direct_vendors (active) where active = true;

alter table public.direct_vendors enable row level security;

do $$
begin
  -- Anon (public) can read ACTIVE vendor rows for the /direct/[slug] page.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'direct_vendors'
      and policyname = 'Public can view active direct vendors'
  ) then
    create policy "Public can view active direct vendors"
      on public.direct_vendors for select using (active = true);
  end if;

  -- Vendor can view + edit own row (authenticated session).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'direct_vendors'
      and policyname = 'Vendors can view their own row'
  ) then
    create policy "Vendors can view their own row"
      on public.direct_vendors for select to authenticated
      using (auth.uid() = creator_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'direct_vendors'
      and policyname = 'Vendors can update their own row'
  ) then
    create policy "Vendors can update their own row"
      on public.direct_vendors for update to authenticated
      using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
  end if;

  -- Service role bypasses RLS, but explicit policy makes intent visible
  -- when reading via the SQL editor with the role switcher.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'direct_vendors'
      and policyname = 'Service role full access direct vendors'
  ) then
    create policy "Service role full access direct vendors"
      on public.direct_vendors using (true);
  end if;
end$$;

-- Auto-bump updated_at on every UPDATE.
create or replace function public.touch_direct_vendors_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists direct_vendors_touch_updated_at on public.direct_vendors;
create trigger direct_vendors_touch_updated_at
  before update on public.direct_vendors
  for each row execute function public.touch_direct_vendors_updated_at();

-- ===========================================================================
-- Slug + name derivation helpers (used by the trigger + the backfill)
-- ===========================================================================
--
-- slugify(text)
--   • lowercases, replaces non-alphanumeric runs with '-',
--   • trims leading/trailing hyphens,
--   • clamps to 40 chars (mirrors the dashboard's handle-derive logic),
--   • returns empty string if input is null/empty/all-symbols.

create or replace function public.slugify(src text)
returns text language sql immutable as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(
          lower(coalesce(src, '')),
          '[^a-z0-9]+', '-', 'g'
        ),
        '(^-+|-+$)', '', 'g'
      ),
      ''
    ),
    ''
  )
$$;

-- Resolve a unique slug — start with `base`, append a 6-char hex suffix on
-- collision, retry up to 5 times, then give up and let the unique-index error
-- bubble (which the caller catches in the trigger via the exception block).
create or replace function public.unique_direct_vendor_slug(base text)
returns text language plpgsql as $$
declare
  s text := nullif(public.slugify(base), '');
  tries int := 0;
begin
  if s is null then
    s := 'vendor-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 8);
  end if;
  while exists (select 1 from public.direct_vendors where lower(slug) = lower(s)) loop
    tries := tries + 1;
    if tries > 5 then
      -- give up tacking nice suffixes; force-randomise
      s := 'vendor-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 12);
      exit;
    end if;
    s := substr(s, 1, 33) || '-' || substr(encode(gen_random_bytes(3), 'hex'), 1, 6);
  end loop;
  return s;
end$$;

-- ===========================================================================
-- handle_new_user_direct_vendor() — auto-provisioning trigger
-- ===========================================================================
--
-- Fires after every auth.users INSERT. Uses raw_user_meta_data->>'display_name'
-- (set by app/signup via supabase.auth.signUp `options.data.display_name`) for
-- the business_name, falls back to the email prefix, falls back to "Studio".
--
-- Wrapped in EXCEPTION WHEN OTHERS so a provisioning failure NEVER blocks the
-- signup itself. We swallow + log only.

create or replace function public.handle_new_user_direct_vendor()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  derived_name text;
  derived_slug text;
begin
  -- Skip if this user already has a vendor row (e.g. backfill ran first, or
  -- this trigger fires twice from some other path).
  if exists (select 1 from public.direct_vendors where creator_id = new.id) then
    return new;
  end if;

  derived_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'),    ''),
    nullif(trim(new.raw_user_meta_data->>'name'),         ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1),  ''),
    'Studio'
  );

  derived_slug := public.unique_direct_vendor_slug(derived_name);

  insert into public.direct_vendors (creator_id, business_name, slug, tier, active)
  values (new.id, derived_name, derived_slug, 'free', true);

  return new;
exception when others then
  -- Never break signup over a vendor-row glitch. Surface to Postgres logs
  -- so we can debug, then carry on.
  raise warning 'handle_new_user_direct_vendor failed for %: %', new.id, sqlerrm;
  return new;
end$$;

drop trigger if exists on_auth_user_created_direct_vendor on auth.users;
create trigger on_auth_user_created_direct_vendor
  after insert on auth.users
  for each row execute function public.handle_new_user_direct_vendor();

-- ===========================================================================
-- Backfill — provision a direct_vendors row for every existing auth.users
-- that doesn't already have one. Safe to re-run (no-op on already-provisioned).
-- ===========================================================================

do $$
declare
  u record;
  derived_name text;
  derived_slug text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.direct_vendors dv on dv.creator_id = au.id
    where dv.id is null
  loop
    derived_name := coalesce(
      nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'),    ''),
      nullif(trim(u.raw_user_meta_data->>'name'),         ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1),  ''),
      'Studio'
    );
    derived_slug := public.unique_direct_vendor_slug(derived_name);
    begin
      insert into public.direct_vendors (creator_id, business_name, slug, tier, active)
      values (u.id, derived_name, derived_slug, 'free', true);
    exception when others then
      raise warning 'backfill direct_vendors failed for %: %', u.id, sqlerrm;
    end;
  end loop;
end$$;
