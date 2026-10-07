-- ===========================================================================
-- 30-day free trial for new vendor signups
-- ===========================================================================
--
-- Run in the Supabase SQL Editor BEFORE deploying the app change.
--
--   1. Adds direct_vendors.trial_ends_at (nullable timestamptz). Existing
--      rows are not touched and stay null.
--   2. Replaces handle_new_user_direct_vendor() so every new signup's vendor
--      row starts on tier 'shop' with trial_ends_at = now() + 30 days
--      (previously tier 'free', no trial). Same body as
--      2026-06-direct-vendors.sql otherwise. The trigger itself is unchanged.
--
-- Nothing happens automatically when a trial ends: no downgrade, no pause,
-- no email. Tier changes after a trial are made by hand.
--
-- Idempotent — safe to re-run.

begin;

alter table public.direct_vendors
  add column if not exists trial_ends_at timestamptz null;

-- Stop here if a check constraint on tier would reject 'shop'. The trigger
-- swallows insert errors, so a rejected insert would silently leave new
-- signups with no vendor row at all.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.direct_vendors'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tier%'
      and pg_get_constraintdef(oid) not ilike '%''shop''%'
  ) then
    raise exception 'direct_vendors has a tier check constraint that does not allow ''shop''; nothing was changed';
  end if;
end$$;

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

  -- Every new signup starts a 30-day Shop trial.
  insert into public.direct_vendors (creator_id, business_name, slug, tier, active, trial_ends_at)
  values (new.id, derived_name, derived_slug, 'shop', true, now() + interval '30 days');

  return new;
exception when others then
  -- Never break signup over a vendor-row glitch. Surface to Postgres logs
  -- so we can debug, then carry on.
  raise warning 'handle_new_user_direct_vendor failed for %: %', new.id, sqlerrm;
  return new;
end$$;

commit;
