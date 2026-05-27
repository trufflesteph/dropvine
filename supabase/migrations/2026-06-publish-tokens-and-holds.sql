-- =============================================================================
-- Draft → Preview → Publish/Schedule flow (June 2026)
-- =============================================================================
-- Two new pieces of schema:
--
--   1. publish_tokens   — one-time URLs the vendor clicks from the
--      confirmation email to flip a draft launch to `published` or
--      `scheduled`. Each row carries publish_action so the endpoint knows
--      which terminal state to apply.
--
--   2. email_schedules.hold — boolean that pauses the lifecycle cron so the
--      pre-computed open / +5d / pre_close_24h / close_summary rows don't
--      fire while the launch is still in `draft` state. The publish endpoint
--      releases the hold (sets hold=false) when the vendor publishes/schedules.
--
-- Idempotent — every statement uses IF NOT EXISTS or is otherwise safe to
-- re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) publish_tokens
-- ---------------------------------------------------------------------------
-- One row per launch (in practice). Cascades on launch delete. The token
-- column is auto-populated by Postgres with a 64-char hex random string, so
-- the app never has to mint its own.
CREATE TABLE IF NOT EXISTS public.publish_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id       UUID NOT NULL REFERENCES public.launches(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  publish_action  TEXT NOT NULL DEFAULT 'publish',  -- 'publish' or 'schedule'
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  used_at         TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publish_tokens_token     ON public.publish_tokens(token);
CREATE INDEX IF NOT EXISTS idx_publish_tokens_launch_id ON public.publish_tokens(launch_id);

COMMENT ON TABLE public.publish_tokens IS
  'One-shot tokens. Issued at draft creation, redeemed by GET /api/launches/publish/[token]. Cascades on launch delete.';
COMMENT ON COLUMN public.publish_tokens.publish_action IS
  '"publish" = flip to status=published immediately. "schedule" = flip to status=scheduled, lifecycle cron auto-publishes at launch_at.';

-- ---------------------------------------------------------------------------
-- 2) email_schedules.hold
-- ---------------------------------------------------------------------------
-- Default false so existing rows continue to fire normally. The Tally
-- webhook now creates schedules with hold=true; the publish endpoint flips
-- them to false at the moment the vendor confirms publish/schedule.
ALTER TABLE public.email_schedules
  ADD COLUMN IF NOT EXISTS hold BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.email_schedules.hold IS
  'When true, the lifecycle cron skips this row. Released by /api/launches/publish/[token] when the vendor publishes or schedules.';

-- ---------------------------------------------------------------------------
-- 3) launches.status — widen to include 'scheduled' (defensive)
-- ---------------------------------------------------------------------------
-- The status column is TEXT in our schema (no enum constraint), so this is a
-- no-op DDL today. Comment kept for future readers + in case anyone adds a
-- CHECK constraint later.
COMMENT ON COLUMN public.launches.status IS
  'draft | scheduled | published | archived. "scheduled" is set by /api/launches/publish/[token] when publish_action=schedule; lifecycle cron flips it to published at launch_at.';

-- Verify:
SELECT 'publish_tokens'     AS table_name, COUNT(*) FROM public.publish_tokens
UNION ALL
SELECT 'email_schedules.hold col exists?', COUNT(*)
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='email_schedules' AND column_name='hold';
