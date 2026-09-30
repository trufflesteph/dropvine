-- ===========================================================================
-- drop_orders.client_request_id — duplicate-submit protection for the
-- honor-system checkout (POST /api/drops/[handle]/preorder).
-- ===========================================================================
-- The drop page sends one random ID per checkout. A repeat of the same ID for
-- the same drop returns the existing order instead of creating a second one.
-- Nullable: orders created before this column (and any client that doesn't
-- send an ID) keep NULL and are never matched.
--
-- RUN THIS BEFORE DEPLOYING the checkout change: the endpoint writes this
-- column on every insert, so orders fail until it exists.
--
-- Idempotent — safe to re-run.

alter table public.drop_orders
  add column if not exists client_request_id text;

create unique index if not exists drop_orders_client_request_per_drop_idx
  on public.drop_orders (drop_id, client_request_id)
  where client_request_id is not null;

-- Check (read-only): the memo must also be unique per drop. The original
-- migration created drop_orders_note_per_launch_idx on (launch_id, venmo_note);
-- the launches→drops rename moved it to (drop_id, venmo_note). Expect one row
-- with a UNIQUE index definition on (drop_id, venmo_note):
--
--   select indexname, indexdef from pg_indexes
--   where schemaname = 'public' and tablename = 'drop_orders'
--     and indexdef ilike '%venmo_note%';
