-- =============================================================================
-- Dropvine Direct — Demo Vendors + Drops Seed (June 2026)
-- =============================================================================
-- Seeds three real, publicly visible vendor profiles and drops that the
-- homepage demo cards link to. All rows are tagged `is_demo = true` so they
-- are easy to filter out of analytics, revenue reporting, and bulk operations.
--
-- This file does TWO things:
--   1. Adds `is_demo` BOOLEAN to launches + direct_vendors (defaults false,
--      so existing real rows are untouched).
--   2. Inserts three real auth.users + cascading profiles + direct_vendors
--      (via the existing handle_new_user + handle_new_user_direct_vendor
--      triggers), then UPDATEs the vendor rows to the demo content and
--      INSERTs the three launches.
--
-- Idempotent — re-running is safe:
--   • Each ALTER TABLE uses IF NOT EXISTS.
--   • auth.users INSERT is guarded by a SELECT-first-then-INSERT pattern.
--   • direct_vendors UPDATE is keyed by creator_id (the new auth.users id).
--   • launches INSERT uses ON CONFLICT (handle) DO UPDATE so re-running
--     refreshes the demo content in place without creating duplicates.
--
-- Field notes (deviations from the task brief):
--   • direct_vendors has no `tagline` column in the existing schema, so this
--     migration adds one (`ALTER TABLE … ADD COLUMN IF NOT EXISTS tagline TEXT`).
--   • The vendor `tagline` is also copied into launches.tagline so the drop
--     page hero shows the same one-liner as italic subtitle.
--   • All timestamps are stored as `America/Los_Angeles` offsets (-07:00 PDT
--     is in effect for the May–June dates used here).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1 — `is_demo` flag on launches + direct_vendors
-- ---------------------------------------------------------------------------
ALTER TABLE public.launches
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.direct_vendors
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- New vendor-level marketing tagline (used on /direct/[slug] hero + mirrored
-- into launches.tagline for the drop page italic subtitle).
ALTER TABLE public.direct_vendors
  ADD COLUMN IF NOT EXISTS tagline TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_launches_is_demo
  ON public.launches (is_demo) WHERE is_demo = true;

CREATE INDEX IF NOT EXISTS idx_direct_vendors_is_demo
  ON public.direct_vendors (is_demo) WHERE is_demo = true;

COMMENT ON COLUMN public.launches.is_demo IS
  'When true, this launch is platform-seeded demo content. Should be excluded from analytics, revenue reporting, and vendor-facing bulk operations. The /l/[handle] page renders a non-dismissible "demo" banner when this is true.';

COMMENT ON COLUMN public.direct_vendors.is_demo IS
  'When true, this vendor is platform-seeded demo content. Exclude from analytics and any "vendor count" stats.';

-- ---------------------------------------------------------------------------
-- Step 2 — Seed three demo vendors + drops
-- ---------------------------------------------------------------------------

-- Helper: insert a demo auth.users row only if the email isn't already taken.
-- Returns the resulting id either way.  Declared at SQL-statement scope (PL/pgSQL
-- does NOT support nested function declarations inside a DO block).  Dropped
-- at the bottom of this file so it doesn't linger in the schema.
CREATE OR REPLACE FUNCTION public._dv_ensure_demo_user(p_email text, p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
AS $func$
DECLARE
  existing uuid;
  new_id   uuid;
  v_now    timestamptz := now();
BEGIN
  SELECT id INTO existing FROM auth.users WHERE email = p_email;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;
  new_id := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_id, 'authenticated', 'authenticated', p_email,
    -- Random unguessable password — these accounts are seeded fixtures,
    -- not meant for human login.  If you ever need to log in as a demo
    -- vendor, reset the password via the Supabase Dashboard.
    crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf')),
    v_now,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_display_name),
    v_now, v_now
  );
  RETURN new_id;
END;
$func$;

DO $$
DECLARE
  v_sauce_id    uuid;
  v_cookies_id  uuid;
  v_baxter_id   uuid;
  v_now         timestamptz := now();
BEGIN
  -- Create / lookup the three demo auth users. The existing
  -- handle_new_user() + handle_new_user_direct_vendor() triggers will
  -- auto-insert matching rows into public.profiles and public.direct_vendors.
  v_sauce_id   := public._dv_ensure_demo_user('sauce@saucemamas.com',     'Sauce Mamas');
  v_cookies_id := public._dv_ensure_demo_user('hello@wildflourcookies.com','Wildflour Cookies');
  v_baxter_id  := public._dv_ensure_demo_user('farm@baxterfarmstand.com',  'Baxter Farmstand');

  -- -------------------------------------------------------------------------
  -- 2a) Vendor profiles
  -- -------------------------------------------------------------------------
  -- The trigger creates a stub direct_vendors row with a slug derived from
  -- the display_name. We UPDATE it to lock in the canonical slug + the rest
  -- of the demo content. Re-running this block refreshes the copy.
  UPDATE public.direct_vendors SET
    business_name = 'Sauce Mamas',
    slug          = 'sauce-mamas',
    tagline       = 'Small-batch hot sauces made in Portland',
    bio           = 'Sauce Mamas started at the Saturday farmers market with three sauces and a folding table. Everything is small-batch, fermented, and made in a licensed home kitchen in SE Portland. We run a workshop every quarter where you can make your own batch.',
    tier          = 'free',
    is_demo       = true,
    active        = true,
    venmo_handle  = 'sauce-mamas'
  WHERE creator_id = v_sauce_id;

  UPDATE public.direct_vendors SET
    business_name = 'Wildflour Cookies',
    slug          = 'wildflour-cookies',
    tagline       = 'Weekly market pre-orders — pick up Wednesday',
    bio           = 'Wildflour is a one-woman cookie operation based in West Linn. Every week I bake a small run of decorated shortbread and seasonal drop cookies for the Wednesday market. Pre-order by Sunday night and your box will be waiting at the booth.',
    tier          = 'free',
    is_demo       = true,
    active        = true,
    venmo_handle  = 'wildflour-cookies'
  WHERE creator_id = v_cookies_id;

  UPDATE public.direct_vendors SET
    business_name = 'Baxter Farmstand',
    slug          = 'baxter-farmstand',
    tagline       = 'Weekly produce boxes from our Tualatin Valley farm',
    bio           = 'We''re a small family farm in the Tualatin Valley growing vegetables, herbs, and cut flowers. Our weekly CSA-style produce boxes are available for pre-order each week — we grow it, you pick it up at the market or we drop it at our West Linn hub.',
    tier          = 'free',
    is_demo       = true,
    active        = true,
    venmo_handle  = 'baxter-farmstand'
  WHERE creator_id = v_baxter_id;

  -- -------------------------------------------------------------------------
  -- 2b) Launches
  -- -------------------------------------------------------------------------
  -- ON CONFLICT (handle) DO UPDATE makes the seed idempotent — re-running
  -- refreshes the copy without creating duplicates and without losing the
  -- existing id (so any future foreign keys to these launches stay valid).
  INSERT INTO public.launches (
    creator_id, handle, title, tagline, description,
    launch_at, closes_at, price_cents, capacity, status,
    collection_mode, venmo_handle, pickup_details,
    reservation_enabled, reservation_hold_cents,
    is_demo
  ) VALUES
  -- Sauce Mamas — reservation
  (
    v_sauce_id,
    'sauce-mamas-workshop-june',
    'Summer Hot Sauce Workshop — June 28',
    'Small-batch hot sauces made in Portland',
    'Join us for a 2-hour hands-on hot sauce making workshop in our SE Portland kitchen. You''ll ferment, blend, and bottle your own 8oz batch to take home. All ingredients and equipment provided. Limited to 8 participants.',
    v_now,
    '2026-06-25 23:59:00-07:00'::timestamptz,
    6500, 8, 'published',
    'reservation', 'sauce-mamas',
    '1234 SE Division St, Portland OR 97202 — June 28, 10 AM–12 PM',
    true, 6500,
    true
  ),
  -- Wildflour Cookies — pre-order
  (
    v_cookies_id,
    'wildflour-may-21',
    'Wednesday Market Box — Week of May 21',
    'Weekly market pre-orders — pick up Wednesday',
    'This week''s market box includes 6 decorated lemon shortbread, 4 brown butter chocolate chip, and 2 seasonal specials (rosemary sea salt). Boxed and ready for pickup Wednesday at the Willamette market booth.',
    v_now,
    '2026-05-18 23:59:00-07:00'::timestamptz,
    1800, 20, 'published',
    'pre-order', 'wildflour-cookies',
    'Wednesdays in Willamette Market, Willamette Falls Drive, West Linn — Wednesday May 21, 4–8 PM. Look for the yellow tent.',
    false, 0,
    true
  ),
  -- Baxter Farmstand — pre-order
  (
    v_baxter_id,
    'baxter-produce-may-21',
    'Weekly Produce Box — May 21',
    'Weekly produce boxes from our Tualatin Valley farm',
    'This week''s box includes: 1 head romaine, 1 bunch carrots, 1lb snap peas, 2 zucchini, 1 bunch radishes, fresh dill and parsley. Boxes are packed Wednesday morning and ready for pickup at the Willamette market or our West Linn drop point.',
    v_now,
    '2026-05-19 20:00:00-07:00'::timestamptz,
    3200, 15, 'published',
    'pre-order', 'baxter-farmstand',
    'Option 1: Willamette Market booth, Wednesday May 21, 4–8 PM. Option 2: 456 Willamette Falls Dr, West Linn — Wednesday 3–5 PM.',
    false, 0,
    true
  )
  ON CONFLICT (handle) DO UPDATE SET
    title              = EXCLUDED.title,
    tagline            = EXCLUDED.tagline,
    description        = EXCLUDED.description,
    closes_at          = EXCLUDED.closes_at,
    price_cents        = EXCLUDED.price_cents,
    capacity           = EXCLUDED.capacity,
    status             = EXCLUDED.status,
    collection_mode    = EXCLUDED.collection_mode,
    venmo_handle       = EXCLUDED.venmo_handle,
    pickup_details     = EXCLUDED.pickup_details,
    reservation_enabled     = EXCLUDED.reservation_enabled,
    reservation_hold_cents  = EXCLUDED.reservation_hold_cents,
    is_demo            = true;

  -- Note: helper function is dropped below at SQL-statement scope (DROP
  -- inside a DO block also works, but keeping it out keeps this block focused
  -- on data and the cleanup explicit).
END $$;

-- Cleanup the seed-only helper so it doesn't linger in the public schema.
DROP FUNCTION IF EXISTS public._dv_ensure_demo_user(text, text);

-- =============================================================================
-- Done. Verify with:
--   select handle, title, status, is_demo, closes_at from launches where is_demo = true order by handle;
--   select slug, business_name, tier, is_demo from direct_vendors where is_demo = true order by slug;
--
-- Public URLs (no auth required):
--   /l/sauce-mamas-workshop-june
--   /l/wildflour-may-21
--   /l/baxter-produce-may-21
-- =============================================================================
