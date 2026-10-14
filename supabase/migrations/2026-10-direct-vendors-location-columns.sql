-- ===========================================================================
-- Record direct_vendors.category, location_city, location_state
-- ===========================================================================
--
-- These columns are read and written by the app (signup → POST
-- /api/direct/me, the /drops directory, /direct/[slug], /l/[handle]) but were
-- added to the live database by hand and never committed to a migration.
-- This file records them so a fresh environment matches production.
--
-- On a database that already has the columns this is a no-op: ADD COLUMN IF
-- NOT EXISTS leaves existing columns, their types and their data untouched.
--
-- Values are written in normalized form by lib/location.js (title-case city,
-- two-letter uppercase state); this migration does not rewrite existing rows.
--
-- Idempotent — safe to re-run.

begin;

alter table public.direct_vendors
  add column if not exists category       text null,
  add column if not exists location_city  text null,
  add column if not exists location_state text null;

commit;
