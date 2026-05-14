-- ===========================================================================
-- Twilio SMS Opt-In — additive migration (additive only, no existing changes)
-- ===========================================================================
-- Adds explicit SMS opt-in flags to shopper_profiles and vendors. Defaults
-- are FALSE for strict TCPA-style compliance (user must explicitly opt in).
-- The existing `phone` column on each table is reused.

alter table public.shopper_profiles
  add column if not exists sms_opt_in boolean default false;

alter table public.vendors
  add column if not exists sms_opt_in boolean default false;

-- Indexes to make cron-time fan-out queries cheap.
create index if not exists shopper_profiles_sms_opt_in_idx
  on public.shopper_profiles (sms_opt_in)
  where sms_opt_in = true;

create index if not exists vendors_sms_opt_in_idx
  on public.vendors (sms_opt_in)
  where sms_opt_in = true;
