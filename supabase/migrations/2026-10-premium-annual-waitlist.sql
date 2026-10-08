-- ===========================================================================
-- premium_annual_waitlist — sign-ups from the Premium Shop Annual card
-- ===========================================================================
--
-- Run in the Supabase SQL Editor BEFORE deploying the app change.
--
-- Written only by POST /api/premium-waitlist and read only by the admin
-- Premium waitlist page, both with the service-role client. RLS is on with no
-- policies, and only service_role has table privileges, so the anon and
-- authenticated roles (the browser keys) can't read or write it.
--
-- Idempotent — safe to re-run.

begin;

create extension if not exists pgcrypto;

create table if not exists public.premium_annual_waitlist (
  id            uuid primary key default gen_random_uuid(),
  -- Stored lowercased and trimmed (the API normalizes; the check enforces).
  email         text not null
                constraint premium_annual_waitlist_email_normalized
                check (email = lower(btrim(email)) and email <> ''),
  first_name    text not null,
  business_name text null,
  created_at    timestamptz not null default now(),
  constraint premium_annual_waitlist_email_key unique (email)
);

alter table public.premium_annual_waitlist enable row level security;

-- Supabase grants new public tables to anon and authenticated by default.
-- Take everything away, then give service_role exactly these four.
revoke all on table public.premium_annual_waitlist from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.premium_annual_waitlist to service_role;

commit;
