-- ===========================================================================
-- Stock limits for Dropvine Direct pre-order / deposit checkout.
-- ===========================================================================
-- Stock is never stored or decremented. It is always computed from orders:
--
--   committed = sum of line-item quantities on this drop's orders whose status
--               is pending_payment, paid or fulfilled (cancelled / refunded
--               orders don't count, so cancelling frees stock automatically)
--   available = drop_products.quantity - committed   (quantity NULL = unlimited)
--
-- Single-product (legacy) drops have no drop_products rows; they use
-- drops.capacity - sum(drop_orders.quantity) over the same statuses
-- (capacity NULL = unlimited).
--
-- create_drop_order() checks availability and inserts the order + its items in
-- one transaction, holding a lock on the drop row and its product rows so two
-- simultaneous orders for the last unit can't both succeed.
--
-- RUN THIS BEFORE DEPLOYING: POST /api/drops/[handle]/preorder calls
-- create_drop_order() and returns 503 until it exists. Requires
-- 2026-09-drop-orders-client-request-id.sql to have been run first.
--
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- drop_committed_quantities(drop_id)
--   One row per product with committed stock, plus one row with a NULL
--   launch_product_id holding the total ordered quantity across all counted
--   orders (used for single-product drops' capacity).
-- ---------------------------------------------------------------------------
create or replace function public.drop_committed_quantities(p_drop_id uuid)
returns table (launch_product_id uuid, committed bigint)
language sql
stable
set search_path = public
as $$
  select oi.launch_product_id, sum(oi.quantity)::bigint
  from public.drop_order_items oi
  join public.drop_orders o on o.id = oi.order_id
  where o.drop_id = p_drop_id
    and o.status in ('pending_payment', 'paid', 'fulfilled')
    and oi.launch_product_id is not null
  group by oi.launch_product_id
  union all
  select null::uuid, coalesce(sum(o.quantity), 0)::bigint
  from public.drop_orders o
  where o.drop_id = p_drop_id
    and o.status in ('pending_payment', 'paid', 'fulfilled')
$$;

-- ---------------------------------------------------------------------------
-- create_drop_order(order, items)
--   p_order: drop_orders fields (drop_id, shopper_email, shopper_name,
--            shopper_phone, quantity, unit_price_cents, total_cents,
--            deposit_cents, balance_cents, venmo_handle, venmo_note,
--            collection_mode, status, client_request_id)
--   p_items: [{ launch_product_id (uuid | null), product_name, price_cents,
--              quantity }]
--   Returns { ok: true, order, items } or, inserting nothing,
--           { ok: false, error: 'insufficient_stock', launch_product_id,
--             product_name, available }
--           { ok: false, error: 'drop_not_found' | 'unknown_product', ... }
--   Unique violations (venmo_note / client_request_id) are raised as errors
--   (SQLSTATE 23505) so the caller can retry with a new memo or return the
--   existing order.
-- ---------------------------------------------------------------------------
create or replace function public.create_drop_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_drop_id   uuid := (p_order->>'drop_id')::uuid;
  v_capacity  integer;
  v_title     text;
  v_committed bigint;
  v_available bigint;
  v_order     public.drop_orders;
  v_items     jsonb;
  r           record;
begin
  -- Serialise orders for this drop: lock the drop row, then its product rows
  -- (in a fixed order). A second order for the same drop waits here until
  -- the first commits, then sees its items in the committed totals.
  select d.capacity, d.title into v_capacity, v_title
  from public.drops d where d.id = v_drop_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'drop_not_found');
  end if;
  perform 1 from public.drop_products p where p.drop_id = v_drop_id order by p.id for update;

  -- Products: check every requested product (summing repeated lines).
  for r in
    select (i->>'launch_product_id')::uuid as product_id,
           sum((i->>'quantity')::integer)   as requested
    from jsonb_array_elements(p_items) i
    where i->>'launch_product_id' is not null
    group by 1
  loop
    select p.name, p.quantity into v_title, v_available
    from public.drop_products p
    where p.id = r.product_id and p.drop_id = v_drop_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'unknown_product', 'launch_product_id', r.product_id);
    end if;
    if v_available is not null then
      select coalesce(sum(c.committed), 0) into v_committed
      from public.drop_committed_quantities(v_drop_id) c
      where c.launch_product_id = r.product_id;
      v_available := greatest(v_available - v_committed, 0);
      if r.requested > v_available then
        return jsonb_build_object(
          'ok', false, 'error', 'insufficient_stock',
          'launch_product_id', r.product_id, 'product_name', v_title, 'available', v_available);
      end if;
    end if;
  end loop;

  -- Single-product drops (the one line has no product id): drops.capacity.
  if v_capacity is not null
     and exists (select 1 from jsonb_array_elements(p_items) i where i->>'launch_product_id' is null) then
    select coalesce(sum(c.committed), 0) into v_committed
    from public.drop_committed_quantities(v_drop_id) c
    where c.launch_product_id is null;
    v_available := greatest(v_capacity - v_committed, 0);
    if (p_order->>'quantity')::integer > v_available then
      select d.title into v_title from public.drops d where d.id = v_drop_id;
      return jsonb_build_object(
        'ok', false, 'error', 'insufficient_stock',
        'launch_product_id', null, 'product_name', v_title, 'available', v_available);
    end if;
  end if;

  insert into public.drop_orders (
    drop_id, shopper_email, shopper_name, shopper_phone, quantity,
    unit_price_cents, total_cents, deposit_cents, balance_cents,
    venmo_handle, venmo_note, collection_mode, status, client_request_id
  ) values (
    v_drop_id,
    p_order->>'shopper_email',
    p_order->>'shopper_name',
    p_order->>'shopper_phone',
    (p_order->>'quantity')::integer,
    (p_order->>'unit_price_cents')::integer,
    (p_order->>'total_cents')::integer,
    (p_order->>'deposit_cents')::integer,
    (p_order->>'balance_cents')::integer,
    p_order->>'venmo_handle',
    p_order->>'venmo_note',
    p_order->>'collection_mode',
    coalesce(p_order->>'status', 'pending_payment'),
    p_order->>'client_request_id'
  )
  returning * into v_order;

  insert into public.drop_order_items (order_id, launch_product_id, product_name, price_cents, quantity)
  select v_order.id,
         (i->>'launch_product_id')::uuid,
         i->>'product_name',
         (i->>'price_cents')::integer,
         (i->>'quantity')::integer
  from jsonb_array_elements(p_items) i;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) into v_items
  from public.drop_order_items x where x.order_id = v_order.id;

  return jsonb_build_object('ok', true, 'order', to_jsonb(v_order), 'items', v_items);
end;
$$;

-- Server-only: the order endpoint and drop page API call these with the
-- service-role key. Nobody else may execute them.
revoke all on function public.drop_committed_quantities(uuid) from public, anon, authenticated;
revoke all on function public.create_drop_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.drop_committed_quantities(uuid) to service_role;
grant execute on function public.create_drop_order(jsonb, jsonb) to service_role;
