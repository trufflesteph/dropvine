-- ===========================================================================
-- READ-ONLY review: auth users missing a profiles or direct_vendors row
-- ===========================================================================
--
-- Every statement here is a SELECT; nothing is written. Run it in the
-- Supabase SQL Editor to review before any backfill.
--
-- profiles rows come from handle_new_user() (supabase/schema.sql) and
-- direct_vendors rows from handle_new_user_direct_vendor(), both on
-- auth.users insert. Since the vendor-settings branch, GET /api/direct/me
-- creates both, if missing, the first time the vendor loads /dashboard,
-- /dashboard/settings or /dashboard/orders (lib/vendors/provision.js).

-- 1) Auth users with no profiles row.
select au.id as user_id, au.email, au.created_at as signed_up_at, au.last_sign_in_at
from auth.users au
where not exists (select 1 from public.profiles p where p.id = au.id)
order by au.created_at desc;

-- 2) Auth users with no direct_vendors row, and whether they have a profile.
select au.id as user_id, au.email, au.created_at as signed_up_at, au.last_sign_in_at,
       exists (select 1 from public.profiles p where p.id = au.id) as has_profile
from auth.users au
where not exists (select 1 from public.direct_vendors dv where dv.creator_id = au.id)
order by au.created_at desc;

-- 3) Foreign keys that reference profiles, with their on-delete rule
--    (confdeltype: a = no action, r = restrict, c = cascade, n = set null,
--    d = set default). The repo's DDL has direct_vendors.creator_id →
--    auth.users, but production's direct_vendors_creator_id_fkey points at
--    profiles; this shows what deleting a profiles row actually does.
select c.conname, c.conrelid::regclass as from_table,
       c.confrelid::regclass as to_table, c.confdeltype as on_delete,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.contype = 'f'
  and c.confrelid = 'public.profiles'::regclass
order by from_table, c.conname;
