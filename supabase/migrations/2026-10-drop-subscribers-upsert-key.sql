-- =============================================================================
-- 2026-10 drop_subscribers — plain unique key for upsert
-- =============================================================================
-- lib/drop-lifecycle/contacts.js upserts on (drop_id, email) with
-- ignoreDuplicates, so a duplicate in an upload is skipped instead of
-- failing the whole batch. PostgREST's on_conflict needs a unique index on
-- exactly those columns; the existing one is on (drop_id, lower(email)),
-- which it can't target.
--
-- The app lowercases emails before inserting, and the existing lower(email)
-- index already guarantees no two rows share (drop_id, email), so this index
-- always builds. The lower(email) index stays.
--
-- Idempotent + safe to re-run.
-- =============================================================================

create unique index if not exists uq_drop_subscribers_drop_email
  on public.drop_subscribers (drop_id, email);
