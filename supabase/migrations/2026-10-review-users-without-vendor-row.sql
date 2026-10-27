-- ===========================================================================
-- READ-ONLY review: auth users with no direct_vendors row
-- ===========================================================================
--
-- Every statement here is a SELECT; nothing is written. Run it in the
-- Supabase SQL Editor to review who is affected before deciding on any
-- backfill.
--
-- Since the vendor-settings branch, GET /api/direct/me creates a missing row
-- the first time the vendor loads /dashboard or /dashboard/settings
-- (lib/vendors/provision.js). Users who never sign in again keep no row.
--
-- Queries 2–4 help explain why handle_new_user_direct_vendor() didn't create
-- the rows. It swallows its errors; failures appear in the Postgres logs as
-- "handle_new_user_direct_vendor failed for <user id>: <error>".

-- 1) Users with no vendor row, newest first, with what signup saved for them.
select
  au.id                                              as user_id,
  au.email,
  au.created_at                                      as signed_up_at,
  au.email_confirmed_at,
  au.last_sign_in_at,
  au.raw_user_meta_data->>'display_name'             as business_name,
  au.raw_user_meta_data->>'category'                 as category,
  au.raw_user_meta_data->>'location_city'            as location_city,
  au.raw_user_meta_data->>'location_state'           as location_state,
  au.raw_app_meta_data->>'signup_profile_copied_at'  as signup_profile_copied_at,
  (select count(*) from public.drops d where d.creator_id = au.id) as drop_count
from auth.users au
left join public.direct_vendors dv on dv.creator_id = au.id
where dv.id is null
order by au.created_at desc;

-- 2) Triggers on auth.users. Expect on_auth_user_created_direct_vendor with
--    tgenabled = 'O' (enabled). Missing or 'D' means signups never get a row.
select t.tgname, t.tgenabled, p.proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 3) The provisioning functions, and whether the trigger inserts the Shop
--    trial (2026-10-vendor-trials.sql) or the older 'free' tier.
select n.nspname as schema, p.proname,
       pg_get_functiondef(p.oid) ilike '%''shop''%' as inserts_shop_trial
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('handle_new_user_direct_vendor', 'unique_direct_vendor_slug', 'slugify');

-- 4) Where pgcrypto is installed. unique_direct_vendor_slug() calls
--    gen_random_bytes() on a slug collision or an empty slug; inside the
--    trigger the search_path is only `public`, so if pgcrypto is in another
--    schema (Supabase uses `extensions`), those signups fail silently.
select e.extname, e.extnamespace::regnamespace as schema
from pg_extension e
where e.extname = 'pgcrypto';
