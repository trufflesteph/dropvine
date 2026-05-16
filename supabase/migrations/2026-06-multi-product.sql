-- ===========================================================================
-- Multi-product support for Dropvine Direct drops
-- ===========================================================================
-- Adds two tables that turn a single-SKU launch into a basket-style drop:
--
--   • launch_products    — many products per launch (each with its own price,
--                          capacity, photo, sort order). Publicly readable so
--                          the /l/[handle] page can render the catalogue
--                          without an authenticated session.
--
--   • drop_order_items   — line items rolled up under a parent drop_orders row.
--                          Snapshots product_name + price_cents at order time
--                          so admin reporting stays correct if the maker later
--                          edits the launch_products catalogue.
--
-- NB: named `drop_order_items` rather than `order_items` because the Dropvine
-- Markets module already owns a `public.order_items` table with a totally
-- different schema (per-vendor market pre-orders).
--
-- Both tables RLS-enabled. Public anon: SELECT only on launch_products.
-- Service-role (used by server routes) bypasses RLS.
--
-- Idempotent — safe to re-run. CREATE POLICY is guarded via a DO-block since
-- Postgres doesn't yet support "CREATE POLICY IF NOT EXISTS".

create table if not exists public.launch_products (
  id          uuid primary key default gen_random_uuid(),
  launch_id   uuid references public.launches(id) on delete cascade,
  name        text not null,
  description text,
  price_cents integer not null,
  quantity    integer,
  photo_url   text,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

create index if not exists launch_products_launch_idx
  on public.launch_products (launch_id, sort_order);

alter table public.launch_products enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'launch_products'
      and policyname = 'Public can view launch products'
  ) then
    create policy "Public can view launch products"
      on public.launch_products for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'launch_products'
      and policyname = 'Service role full access launch products'
  ) then
    create policy "Service role full access launch products"
      on public.launch_products using (true);
  end if;
end$$;

create table if not exists public.drop_order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid references public.drop_orders(id) on delete cascade,
  launch_product_id uuid references public.launch_products(id),
  product_name      text not null,
  price_cents       integer not null,
  quantity          integer not null default 1,
  created_at        timestamptz default now()
);

create index if not exists drop_order_items_order_idx
  on public.drop_order_items (order_id);
create index if not exists drop_order_items_product_idx
  on public.drop_order_items (launch_product_id);

alter table public.drop_order_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drop_order_items'
      and policyname = 'Service role full access drop order items'
  ) then
    create policy "Service role full access drop order items"
      on public.drop_order_items using (true);
  end if;
end$$;
