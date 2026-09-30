-- ===========================================================================
-- drops.sold_out_notified_at — when the vendor was emailed that a
-- pre-order / deposit drop sold out (lib/orders/sold-out.js). NULL = not sent.
-- Set once and never cleared, so each drop gets at most one sold-out email.
--
-- RUN THIS BEFORE DEPLOYING. Without it the order still succeeds but the
-- sold-out email is skipped (the update fails and is logged).
--
-- Idempotent — safe to re-run.
-- ===========================================================================
alter table public.drops
  add column if not exists sold_out_notified_at timestamptz null;
