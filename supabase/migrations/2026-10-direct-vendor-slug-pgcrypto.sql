-- ===========================================================================
-- unique_direct_vendor_slug(): call pgcrypto by schema
-- ===========================================================================
--
-- pgcrypto is installed in the `extensions` schema. The function called
-- gen_random_bytes() unqualified and had no search_path of its own, so it
-- used its caller's. Inside handle_new_user_direct_vendor() (search_path =
-- public) that fails whenever a suffix is needed — a slug collision or an
-- empty slug — and the trigger swallows the error, leaving that signup with
-- no direct_vendors row.
--
-- Recreates only unique_direct_vendor_slug(), the one provisioning function
-- that uses pgcrypto (slugify() and handle_new_user_direct_vendor() don't).
-- Same body as supabase/migrations/2026-06-direct-vendors.sql except
-- extensions.gen_random_bytes and its own search_path. Triggers, the Shop
-- trial and tables are unchanged.
--
-- Idempotent — safe to re-run.

begin;

create or replace function public.unique_direct_vendor_slug(base text)
returns text language plpgsql set search_path = public, extensions as $$
declare
  s text := nullif(public.slugify(base), '');
  tries int := 0;
begin
  if s is null then
    s := 'vendor-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8);
  end if;
  while exists (select 1 from public.direct_vendors where lower(slug) = lower(s)) loop
    tries := tries + 1;
    if tries > 5 then
      -- give up tacking nice suffixes; force-randomise
      s := 'vendor-' || substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 12);
      exit;
    end if;
    s := substr(s, 1, 33) || '-' || substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 6);
  end loop;
  return s;
end$$;

commit;
