-- =============================================================================
-- Dropvine Direct — Phase A: Vendor Lifecycle Foundations (June 2026)
-- =============================================================================
-- Adds the schema needed for the 12-step vendor lifecycle:
--   • launches.closes_at         — when orders stop being accepted
--   • launch_subscribers         — CSV-uploaded contact list per drop (Tally)
--   • launch_photos              — Shop-tier 10-photo carousel
--   • email_schedules            — idempotent cadence ledger for crons
--
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS guards). Re-running
-- this file is safe and is the recommended way to roll out to staging+prod.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. launches.closes_at
-- ---------------------------------------------------------------------------
-- The vendor picks "drop closes on YYYY-MM-DD" in the Tally form. Stored as
-- a tz-aware timestamp. NULL = "open-ended" (legacy / no close window).
ALTER TABLE launches
  ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN launches.closes_at IS
  'When this drop stops accepting orders. NULL = no close window. The lifecycle cron uses this to schedule the 24h-pre-close reminder + close summary.';

-- Index for the cron that scans "drops closing in the next 24h".
CREATE INDEX IF NOT EXISTS idx_launches_closes_at_status
  ON launches (closes_at)
  WHERE closes_at IS NOT NULL AND status = 'published';

-- ---------------------------------------------------------------------------
-- 2. launch_subscribers — per-drop contact list (Tally CSV ingestion)
-- ---------------------------------------------------------------------------
-- One row per (launch, email). Phone is optional. `source` records how this
-- contact got onto the list ('csv' from Tally upload, 'manual' from admin
-- paste, 'follow' from vendor profile follow button when Phase D ships).
CREATE TABLE IF NOT EXISTS launch_subscribers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id   UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  phone       TEXT NULL,
  name        TEXT NULL,
  source      TEXT NOT NULL DEFAULT 'csv',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup: one record per (launch, email). Lower-cased on insert by the app.
CREATE UNIQUE INDEX IF NOT EXISTS uq_launch_subscribers_launch_email
  ON launch_subscribers (launch_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_launch_subscribers_launch
  ON launch_subscribers (launch_id);

COMMENT ON TABLE launch_subscribers IS
  'Per-launch contact list. Populated by Tally CSV upload (source=csv) or vendor follow (source=follow). Used by the lifecycle cron for open / +5d / pre-close email fan-out.';

-- ---------------------------------------------------------------------------
-- 3. launch_photos — Shop tier 10-photo carousel
-- ---------------------------------------------------------------------------
-- Drop-level gallery (separate from per-product photos in launch_products).
-- Free / Maker tiers are app-side capped to 1 photo, Shop tier allows up to 10.
CREATE TABLE IF NOT EXISTS launch_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id   UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         TEXT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_launch_photos_launch_sort
  ON launch_photos (launch_id, sort_order);

COMMENT ON TABLE launch_photos IS
  'Drop-level photo carousel (1 for Free, 5 for Maker, up to 10 for Shop). Per-product photos live on launch_products.photo_url.';

-- ---------------------------------------------------------------------------
-- 4. email_schedules — idempotent cadence ledger
-- ---------------------------------------------------------------------------
-- One row per (launch, kind). The cron scans rows where
-- scheduled_for <= now() AND sent_at IS NULL, sends the right email batch,
-- then stamps sent_at. The UNIQUE constraint guarantees no double-sends even
-- under retries or parallel cron runs.
--
-- Kinds:
--   • open            — fan-out "the drop is now live" to subscribers
--   • reminder_5d     — "+5 day" mid-window reminder
--   • pre_close_24h   — "closes in 24h" reminder
--   • close_summary   — vendor recap (total orders + total $) after close
CREATE TABLE IF NOT EXISTS email_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id       UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ NULL,
  recipients      INTEGER NULL,
  error           TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One of each kind per launch.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_schedules_launch_kind
  ON email_schedules (launch_id, kind);

-- Scanning index: cron query is "WHERE sent_at IS NULL AND scheduled_for <= now()".
CREATE INDEX IF NOT EXISTS idx_email_schedules_due
  ON email_schedules (scheduled_for)
  WHERE sent_at IS NULL;

COMMENT ON TABLE email_schedules IS
  'Cadence ledger for /api/cron/drop-lifecycle. UNIQUE (launch_id, kind) + sent_at guarantees idempotent sends.';

-- =============================================================================
-- Migration complete. After applying, re-deploy / restart the app so the
-- new tables show up in the PostgREST schema cache.
-- =============================================================================
