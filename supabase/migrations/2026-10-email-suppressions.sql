-- =============================================================================
-- 2026-10 email_suppressions — unsubscribe list for marketing emails
-- =============================================================================
-- One row per opt-out. Marketing sends (DropOpened, DropStillOpen,
-- DropClosingSoon, LaunchLive, LaunchReminder, ReviewRequest) skip any
-- recipient with a row for that vendor or with scope 'all'.
--
--   scope 'vendor' — stop emails from one vendor; vendor_id = the vendor's
--                    creator_id (drops.creator_id / profiles.id)
--   scope 'all'    — stop all Dropvine marketing emails; vendor_id is null
--
-- Written only by the service-role API (/api/unsubscribe and
-- /api/unsubscribe/one-click). RLS is on with no policies, and only
-- service_role has table privileges.
--
-- Idempotent + safe to re-run.
-- =============================================================================

create table if not exists public.email_suppressions (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  scope       text not null,
  vendor_id   uuid,
  source      text not null,
  created_at  timestamptz not null default now(),
  -- The app lowercases and trims before writing; this keeps it that way.
  constraint email_suppressions_email_normalized
    check (email = lower(btrim(email)) and email <> ''),
  constraint email_suppressions_scope_check
    check (scope in ('vendor', 'all')),
  constraint email_suppressions_vendor_id_matches_scope
    check ((scope = 'vendor' and vendor_id is not null)
        or (scope = 'all' and vendor_id is null)),
  constraint email_suppressions_source_check
    check (source in ('link', 'one_click', 'admin'))
);

-- Unique on (email, scope, vendor_id), with a null vendor_id counted as one
-- value so each email has at most one 'all' row. coalesce() instead of
-- NULLS NOT DISTINCT so this also runs on Postgres 14. Also serves the
-- send-time lookup (email in (...)).
create unique index if not exists email_suppressions_uniq
  on public.email_suppressions (email, scope, coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---- Access ----
alter table public.email_suppressions enable row level security;

revoke all on table public.email_suppressions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.email_suppressions to service_role;

comment on table public.email_suppressions is
  'Marketing email opt-outs. scope=vendor (vendor_id = creator_id) or scope=all (vendor_id null). Checked before every marketing send.';

-- Verify
select table_name,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'email_suppressions') as column_count
  from information_schema.tables
 where table_schema = 'public' and table_name = 'email_suppressions';
