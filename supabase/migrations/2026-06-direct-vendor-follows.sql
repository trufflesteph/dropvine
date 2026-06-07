-- =============================================================================
-- 2026-06 direct_vendor_follows — Shop-tier follow + SMS broadcast (Phase D)
-- =============================================================================
-- Stores anonymous "follow this maker" signups gathered from the public
-- /direct/[slug] vendor profile page. When a Shop-tier vendor opens a drop,
-- the cron fans-out an SMS to every follower with `sms_opt_in = true`.
--
-- This is intentionally separate from `public.vendor_follows` (which lives
-- in the Markets schema and is keyed to auth.users + vendors). Dropvine
-- Direct uses anonymous email-keyed signups instead.
--
-- Idempotent + safe to re-run.
-- =============================================================================

create table if not exists public.direct_vendor_follows (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.direct_vendors(id) on delete cascade,
  follower_email  text not null,
  follower_name   text,
  follower_phone  text,
  sms_opt_in      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One follower-email per vendor.
  constraint direct_vendor_follows_uniq unique (vendor_id, follower_email)
);

create index if not exists direct_vendor_follows_vendor_idx
  on public.direct_vendor_follows (vendor_id);

create index if not exists direct_vendor_follows_sms_idx
  on public.direct_vendor_follows (vendor_id)
 where sms_opt_in = true and follower_phone is not null;

-- Touch updated_at on writes.
create or replace function public.touch_direct_vendor_follows_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists direct_vendor_follows_touch on public.direct_vendor_follows;
create trigger direct_vendor_follows_touch
  before update on public.direct_vendor_follows
  for each row execute function public.touch_direct_vendor_follows_updated_at();

-- ---- RLS ----
-- Reads are server-side only (no anon select). Writes happen through the
-- service-role POST /api/direct/[slug]/follow endpoint.
alter table public.direct_vendor_follows enable row level security;

drop policy if exists direct_vendor_follows_admin_all on public.direct_vendor_follows;
create policy direct_vendor_follows_admin_all
  on public.direct_vendor_follows
  for all
  to service_role
  using (true)
  with check (true);

-- Public counts (no PII) are allowed for anon — the API uses count(*) only.
drop policy if exists direct_vendor_follows_count_anon on public.direct_vendor_follows;
create policy direct_vendor_follows_count_anon
  on public.direct_vendor_follows
  for select
  to anon
  using (true);

comment on table public.direct_vendor_follows is
  'Anonymous follower signups for Dropvine Direct Shop-tier vendors. Powers the SMS broadcast on drop open.';

-- Verify
select table_name,
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='direct_vendor_follows') as column_count
  from information_schema.tables
 where table_schema='public' and table_name='direct_vendor_follows';
