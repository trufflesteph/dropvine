-- =============================================================================
-- Rename launches → drops (June 2026) — follow-up
-- =============================================================================
-- The primary migration (2026-06-rename-launches-to-drops.sql) renamed all of
-- the *_subscribers/*_products/*_photos child tables and their `launch_id` FK
-- columns. Two more tables also keep a launch reference but were missed:
--
--   waitlist_entries.launch_id   →  drop_id
--   reservations.launch_id       →  drop_id
--
-- Without this rename the public /api/drops/[id]/waitlist and reserve
-- endpoints fail with "column waitlist_entries.drop_id does not exist"
-- because the code (correctly) now writes drop_id everywhere.
--
-- Idempotent + safe to re-run.
-- =============================================================================

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

SELECT public._dv_rename_column('waitlist_entries', 'launch_id', 'drop_id');
SELECT public._dv_rename_column('reservations',     'launch_id', 'drop_id');

DROP FUNCTION IF EXISTS public._dv_rename_column(text, text, text);

-- Verify: should return drop_id for both rows.
SELECT t.table_name,
       (SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=t.table_name
           AND column_name IN ('drop_id', 'launch_id')
         ORDER BY column_name LIMIT 1) AS fk_column
  FROM information_schema.tables t
 WHERE t.table_schema = 'public'
   AND t.table_name IN ('waitlist_entries', 'reservations')
 ORDER BY t.table_name;

-- Foreign-key integrity check. Zero rows = healthy.
SELECT 'waitlist_entries' AS child, COUNT(*) AS orphaned FROM public.waitlist_entries we
  LEFT JOIN public.drops d ON d.id = we.drop_id
 WHERE we.drop_id IS NOT NULL AND d.id IS NULL
UNION ALL
SELECT 'reservations'     AS child, COUNT(*) AS orphaned FROM public.reservations r
  LEFT JOIN public.drops d ON d.id = r.drop_id
 WHERE r.drop_id IS NOT NULL AND d.id IS NULL;
