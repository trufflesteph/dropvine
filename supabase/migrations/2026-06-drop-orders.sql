-- ===========================================================================
-- drop_orders — pre-order / deposit orders placed against Dropvine Direct
-- launches via the public /l/[handle] page.
-- ===========================================================================
-- Kept separate from the Markets `orders` table (which requires vendor_id) so
-- the two domains don’t leak into one another. Schema mirrors the Markets
-- table where it makes sense so admin-side reporting code can be DRYed up
-- later.
--
-- Idempotent — safe to re-run.

create table if not exists public.drop_orders (
  id              uuid primary key default gen_random_uuid(),
  short_code      text unique not null default upper(substr(md5(random()::text), 1, 6)),
  launch_id       uuid not null references public.launches(id) on delete cascade,

  shopper_email   text not null,
  shopper_name    text,
  shopper_phone   text,

  quantity        integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0,  -- snapshot of launches.price_cents at order time
  total_cents     integer not null default 0,   -- quantity * unit_price
  deposit_cents   integer,                      -- for collection_mode='deposit' only
  balance_cents   integer,                      -- total - deposit

  venmo_handle    text,                         -- snapshot of launches.venmo_handle
  venmo_note      text not null,                -- '<handle>-XXXX' shopper writes in Venmo memo

  collection_mode text not null check (collection_mode in ('pre-order','deposit')),
  status          text not null default 'pending_payment'
                  check (status in ('pending_payment','paid','fulfilled','cancelled','refunded')),

  notes           text,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz,
  fulfilled_at    timestamptz
);

create index if not exists drop_orders_launch_idx  on public.drop_orders (launch_id);
create index if not exists drop_orders_status_idx  on public.drop_orders (status);
create index if not exists drop_orders_email_idx   on public.drop_orders (shopper_email);
create unique index if not exists drop_orders_note_per_launch_idx
  on public.drop_orders (launch_id, venmo_note);

-- Row-level security: we use the service-role key from server routes, so the
-- public anon role does not need any direct read/write access. The RLS table
-- is enabled but no policies are added — anon traffic is therefore denied by
-- default. Service role bypasses RLS.
alter table public.drop_orders enable row level security;
