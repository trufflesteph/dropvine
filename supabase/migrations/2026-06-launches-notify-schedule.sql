-- ===========================================================================
-- Scheduled drop notifications — additive migration
-- ===========================================================================
-- Adds the columns needed to schedule and audit fan-out notifications for
-- Dropvine Direct drops, plus the tiny pieces of scaffolding required so the
-- fan-out actually has somewhere to read its inputs from:
--
--   • launches.notify_at     timestamptz  — when to fire the fan-out
--                                           NULL ⇒ send immediately on publish
--   • launches.notified_at   timestamptz  — set once fan-out completes
--                                           NULL ⇒ never sent (or in flight)
--   • profiles.plan_tier     text         — 'free' | 'maker' | 'studio'
--                                           controls whether SMS is allowed
--   • waitlist_entries.phone text         — optional phone for the SMS fan-out
--
-- Indexes:
--   • partial idx on launches(notify_at) WHERE notified_at IS NULL — so the
--     send-drop-notifications cron is cheap regardless of table size.
--
-- All statements are idempotent; running this twice is a no-op.

-- ---- launches ----
alter table public.launches
  add column if not exists notify_at    timestamptz,
  add column if not exists notified_at  timestamptz;

create index if not exists launches_notify_pending_idx
  on public.launches (notify_at)
  where notified_at is null and notify_at is not null;

-- ---- profiles ----
alter table public.profiles
  add column if not exists plan_tier text not null default 'free';

-- Best-effort check constraint (idempotent — DO blocks let us guard "already exists").
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_plan_tier_check'
  ) then
    alter table public.profiles
      add constraint profiles_plan_tier_check
      check (plan_tier in ('free','maker','studio'));
  end if;
end$$;

-- ---- waitlist_entries ----
alter table public.waitlist_entries
  add column if not exists phone text;
