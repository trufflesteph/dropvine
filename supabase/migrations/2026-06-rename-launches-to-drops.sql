-- =============================================================================
-- Rename launches → drops (June 2026)
-- =============================================================================
-- The DB has historically used `launches` while the UI / routes / product
-- language all say `drops`. This migration aligns the schema with the product
-- vocabulary:
--
--   launches            → drops
--   launch_products     → drop_products
--   launch_subscribers  → drop_subscribers
--   launch_photos       → drop_photos
--
-- And FK columns on every child table:
--   *.launch_id  →  *.drop_id
--
-- Kept as-is:
--   • launches.launch_at  (the column is a timestamp — not a table reference)
--   • drop_orders         (already named `drop_orders`; only its FK is renamed)
--   • drop_order_items    (already named correctly)
--
-- Idempotent. Each rename is guarded by information_schema lookup so the
-- migration is safe to re-run after a partial application.
--
-- IMPORTANT: Apply this migration BEFORE deploying the matching code, or
-- run them together in a single Vercel deploy + Supabase SQL run window.
-- Postgres renames cascade automatically to indexes, FK constraints,
-- triggers, RLS policies, and views.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: rename a column only if the OLD column exists and the NEW one
-- doesn't. Idempotent + survives partial re-runs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._dv_rename_column(
  p_table text, p_old text, p_new text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name=p_table AND column_name=p_old
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name=p_table AND column_name=p_new
  ) THEN
    EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', p_table, p_old, p_new);
  END IF;
END;
$$;

-- Helper: rename a table only if the OLD name exists and the NEW one doesn't.
CREATE OR REPLACE FUNCTION public._dv_rename_table(p_old text, p_new text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p_old
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p_new
  ) THEN
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', p_old, p_new);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
SELECT public._dv_rename_table('launches',           'drops');
SELECT public._dv_rename_table('launch_products',    'drop_products');
SELECT public._dv_rename_table('launch_subscribers', 'drop_subscribers');
SELECT public._dv_rename_table('launch_photos',      'drop_photos');

-- ---------------------------------------------------------------------------
-- 2) FK columns: every child table that referenced launches(id) needs the
--    column rename for readability (FK itself was already renamed by
--    Postgres when the table renamed; we're only renaming the column).
-- ---------------------------------------------------------------------------
SELECT public._dv_rename_column('drop_products',     'launch_id', 'drop_id');
SELECT public._dv_rename_column('drop_subscribers',  'launch_id', 'drop_id');
SELECT public._dv_rename_column('drop_photos',       'launch_id', 'drop_id');
SELECT public._dv_rename_column('drop_orders',       'launch_id', 'drop_id');
SELECT public._dv_rename_column('email_schedules',   'launch_id', 'drop_id');
SELECT public._dv_rename_column('publish_tokens',    'launch_id', 'drop_id');

-- ---------------------------------------------------------------------------
-- 3) Cleanup
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public._dv_rename_column(text, text, text);
DROP FUNCTION IF EXISTS public._dv_rename_table(text, text);

-- ---------------------------------------------------------------------------
-- 4) Verify: list the renamed tables + their child-FK column names. After a
--    successful migration this query returns:
--      drops              | id
--      drop_products      | drop_id
--      drop_subscribers   | drop_id
--      drop_photos        | drop_id
--      drop_orders        | drop_id
--      email_schedules    | drop_id
--      publish_tokens     | drop_id
-- ---------------------------------------------------------------------------
SELECT t.table_name,
       (SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=t.table_name
           AND column_name IN ('drop_id', 'id') ORDER BY column_name LIMIT 1) AS pk_or_fk
  FROM information_schema.tables t
 WHERE t.table_schema = 'public'
   AND t.table_name IN ('drops','drop_products','drop_subscribers','drop_photos','drop_orders','email_schedules','publish_tokens')
 ORDER BY t.table_name;

-- ---------------------------------------------------------------------------
-- 5) Foreign-key integrity check. Every drop_id should resolve to a real
--    drops.id. Returns zero rows on a healthy DB.
-- ---------------------------------------------------------------------------
SELECT 'drop_products'    AS child, COUNT(*) FROM public.drop_products    LEFT JOIN public.drops d ON d.id = drop_products.drop_id    WHERE drop_products.drop_id    IS NOT NULL AND d.id IS NULL
UNION ALL
SELECT 'drop_subscribers' AS child, COUNT(*) FROM public.drop_subscribers LEFT JOIN public.drops d ON d.id = drop_subscribers.drop_id WHERE drop_subscribers.drop_id IS NOT NULL AND d.id IS NULL
UNION ALL
SELECT 'drop_photos'      AS child, COUNT(*) FROM public.drop_photos      LEFT JOIN public.drops d ON d.id = drop_photos.drop_id      WHERE drop_photos.drop_id      IS NOT NULL AND d.id IS NULL
UNION ALL
SELECT 'drop_orders'      AS child, COUNT(*) FROM public.drop_orders      LEFT JOIN public.drops d ON d.id = drop_orders.drop_id      WHERE drop_orders.drop_id      IS NOT NULL AND d.id IS NULL
UNION ALL
SELECT 'email_schedules'  AS child, COUNT(*) FROM public.email_schedules  LEFT JOIN public.drops d ON d.id = email_schedules.drop_id  WHERE email_schedules.drop_id  IS NOT NULL AND d.id IS NULL
UNION ALL
SELECT 'publish_tokens'   AS child, COUNT(*) FROM public.publish_tokens   LEFT JOIN public.drops d ON d.id = publish_tokens.drop_id   WHERE publish_tokens.drop_id   IS NOT NULL AND d.id IS NULL;
