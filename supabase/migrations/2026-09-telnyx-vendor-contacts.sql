-- Telnyx STOP handling: preserve opt-out state for vendor contacts.
-- The vendor_contacts table is managed by the contact-list feature. This is
-- intentionally conditional so the migration can be applied before that table exists.
do $$
begin
  if to_regclass('public.vendor_contacts') is not null then
    alter table public.vendor_contacts
      add column if not exists unsubscribed boolean not null default false;
  end if;
end $$;