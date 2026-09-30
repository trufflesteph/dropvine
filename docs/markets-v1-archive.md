# Dropvine Markets v1 — archive

> **This code was removed from dropvine.pro on September 30, 2026. The full code is preserved on the GitHub branch `archive/markets-v1`.**

This describes the first Dropvine Markets build, which lived inside the Dropvine Direct codebase (dropvine.pro) before Markets became a separate site. It was written from commit `4e990d2` so that anyone rebuilding a feature in the new Markets app knows what existed, where it lived, what data it used, and what was wrong with it.

File paths below are as they were in that commit. To read the code, check out `archive/markets-v1`.

## Contents

1. [How it fit together](#how-it-fit-together)
2. [Features](#features)
3. [Database](#database)
4. [Passport and booth stamps, end to end](#passport-and-booth-stamps-end-to-end)
5. [Known issues](#known-issues)
6. [Configuration and dependencies](#configuration-and-dependencies)
7. [What stayed in dropvine.pro](#what-stayed-in-dropvinepro)

---

## How it fit together

- **One Next.js 14 App Router app.** Shopper pages under `/market/*`, admin pages under `/admin/*`, API routes under `/api/market/*`, two crons under `/api/cron/market-*`.
- **One Supabase project, shared with Direct.** The Markets tables sat next to the Direct tables in `public`, and Markets shoppers signed in through Direct's Supabase Auth (`/login`, `/signup`).
- **Single-market, white-label.** Exactly one `market_config` row could be active (enforced by a partial unique index). Everything shopper-facing read "the active market": name, colours, map, vendors, dates. Seed data was the "Willamette Summer Street Market" (Wednesdays, May 13 – Sep 9, 2026).
- **Server-side data access.** API routes read and wrote with the Supabase service-role client (`getSupabaseAdmin()`), after checking the caller themselves. Shopper identity came from the Supabase session cookie (`getSupabaseServer().auth.getUser()`).
- **Admin auth.** A shared password login (`/admin/login` → `POST /api/market/admin/login`) issued an HMAC-signed token (signed with `CRON_SECRET`, 12-hour expiry) with role `platform` (`VITE_ADMIN_PASSWORD`) or `organiser` (`VITE_ORGANISER_PASSWORD`). The browser kept it in sessionStorage (`dropvine_market_admin`) and sent it as `Authorization: Bearer`. Helpers: `lib/markets/admin-auth.js` (server) and `lib/markets/admin-client.js` (browser). Direct's admin used and still uses the same mechanism.
- **Payments.** None handled by Dropvine. Pre-orders were paid by the shopper on Venmo using a deep link, and the vendor confirmed receipt.
- **PWA.** `app/manifest.js` (dynamic manifest from `market_config`) and `public/sw.js` (service worker: offline shell and Web Push).

---

## Features

### 1. Shopper app shell

What it did: a mobile-first PWA themed from the active `market_config`. It had a bottom nav (Home, Shop, Passport, POP Kids, Me), a floating cart button, and a home page with the market name, the next market day and its hours, and 4 featured vendors.

| Kind | Files |
|---|---|
| Pages | `app/market/layout.js` (loads the active `market_config` server-side), `app/market/page.js` (home) |
| API | `GET /api/market/config` (`app/api/market/config/route.js`) |
| lib | `lib/markets/config-context.js` (`MarketConfigProvider` / `useMarketConfig()`, sets `--market-primary`, `--market-accent`, `--market-bg` CSS variables), `lib/markets/defaults.js` (neutral fallback colours, admin input placeholders) |
| Components | `components/markets/MarketProviders.jsx`, `MarketHeader.jsx`, `BottomNav.jsx`, `CartFAB.jsx` |
| PWA | `app/manifest.js`, `public/sw.js`, `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (placeholder market-stall art) |

### 2. Vendor list and vendor pages

What it did: the Shop page listed active vendors with a **map** view and a **list** view. The map was an auto-generated street schematic (booths numbered along a street between two cross streets, coloured by category). Each vendor page showed the vendor's details, available products (with add-to-cart for vendors that accept pre-orders) and their latest posts.

| Kind | Files |
|---|---|
| Pages | `app/market/shop/page.js`, `app/market/v/[slug]/page.js` |
| API | `GET /api/market/vendors` (active vendors of the active market; optional `?category=` and `?q=`), `GET /api/market/vendors/[slug]` (vendor, available products, 10 latest published posts) |
| Components | `components/markets/MarketStreetMap.jsx` (driven by `map_booth_count`, `map_orientation`, `map_street_name`, `map_cross_street_start/end`, colours; vendors placed by `vendors.booth_number`), `VendorCard.jsx`, `AddToCartButton.jsx` |
| Tables | `vendors`, `products`, `vendor_posts`, `market_config` |

### 3. Pre-orders and fulfillment magic links

What it did:
1. **Cart.** Single-vendor cart in localStorage (`dropvine_market_cart_v1`). Adding an item from a different vendor replaced the cart.
2. **Checkout** (`/market/cart`) sent `POST /api/market/orders` with vendor, items and shopper email/name/phone. The server re-read prices, created an `orders` row (`status = 'pending_payment'`, random 8-character `short_code`), set `venmo_note = "Order #<short_code>"`, inserted `order_items` with name and price snapshots, and created a `fulfillment_tokens` row (random token, 30-day expiry).
3. **Notifications.** Email to the shopper (`MarketOrderConfirmation`, from "`<vendor>` via Dropvine", blind copy to the vendor) with the Venmo deep link. Email to the vendor (`MarketFulfillmentMagicLink`) with a link to `/market/fulfillment/<token>`. Either could also go by SMS if opted in (see feature 7).
4. **Order page** (`/market/orders/<short_code>`): amount, Venmo handle and note with copy buttons, and a "Pay with Venmo" deep link: `https://venmo.com/<handle>?txn=pay&amount=<dollars>&note=Order%20%23<code>`.
5. **Vendor fulfillment page** (`/market/fulfillment/<token>`): no login. The token is the credential. It showed the order, shopper contact and items, with buttons for **Mark payment received**, **Mark fulfilled** and **Cancel**.
6. **Recovery cron** (hourly): for orders from the last 48 hours still `pending_payment` / `payment_received` with no unexpired token, it minted a new 7-day token and re-sent the vendor email/SMS. Admins could also force this per vendor.

| Kind | Files |
|---|---|
| Pages | `app/market/cart/page.js`, `app/market/orders/[shortCode]/page.js`, `app/market/fulfillment/[token]/page.js` |
| API | `POST /api/market/orders`, `GET /api/market/orders/[shortCode]`, `GET` / `POST /api/market/fulfillment/[token]`, `POST /api/market/admin/vendors/[id]/regenerate-fulfillment-links`, `POST /api/market/admin/orders` (duplicate of the public order route; see Known issues) |
| lib | `lib/markets/cart-context.js` (`CartProvider`, `useCart()`, `venmoUrl()`), `lib/notifications/index.js` (`notifyMarketOrderPlaced`, `notifyMarketVendorOrderArrived`), `lib/email/notifications.js` (`sendMarketOrderConfirmation`, `sendMarketFulfillmentMagicLink`), `lib/notifications/channels/sms.js` (same two, SMS) |
| Email templates | `lib/email/templates/MarketOrderConfirmation.jsx`, `MarketFulfillmentMagicLink.jsx` |
| Cron | `app/api/cron/market-fulfillment-links/route.js`, hourly (`0 * * * *`) |
| Tables | `orders`, `order_items`, `fulfillment_tokens`, `products`, `vendors`, `shopper_profiles` (SMS preference), `market_config` |

### 4. Passport and booth stamps

What it did: each vendor had a printable QR code at their booth. Scanning it (with the phone camera or the in-app scanner) recorded a "stamp" for the signed-in shopper. The Passport page showed a grid of every active vendor, stamped or not, with a progress bar ("N of M vendors stamped"). Details in [Passport and booth stamps, end to end](#passport-and-booth-stamps-end-to-end).

| Kind | Files |
|---|---|
| Pages | `app/market/passport/page.js`, `app/market/passport/scan/page.js`, `app/market/stamp/[vendorSlug]/page.js`, `app/admin/qr-codes/page.js` |
| API | `GET` / `POST /api/market/passport`, `GET /api/market/vendors` |
| npm | `html5-qrcode` (in-app scanner), `qrcode.react` (printable codes) |
| Tables | `passport_stamps`, `vendors`, `market_dates` |

### 5. POP Kids program (Power of Produce)

What it did: a signed-in parent created profiles for their children and recorded activities for them. Each activity was a "stamp type" such as "Try a new fruit" or "Greet a vendor", and earned the child POP tokens. Children spent tokens at vendors.

- **Profiles:** create (name, age 0–18, optional avatar), view, edit, delete. Only the parent could read or change their children.
- **Stamps:** the Earn page listed the active market's `pop_stamp_types`. Tapping one inserted `pop_stamps_earned` and credited `token_reward` tokens as a `pop_tokens` row (`source = 'reward'`).
- **Tokens:** a ledger (`pop_tokens` credits, `pop_redemptions` debits). The balance was computed live as credits minus debits, and also copied into `child_profiles.total_pop_tokens`.
- **Redemptions:** the parent picked a vendor and an amount (1 up to the balance). The server checked the balance, inserted `pop_redemptions`, and told the parent to show the screen to the vendor.

| Kind | Files |
|---|---|
| Pages | `app/market/pop/page.js`, `pop/new/page.js`, `pop/[childId]/page.js`, `pop/[childId]/earn/page.js`, `pop/[childId]/redeem/page.js`, `app/admin/pop/page.js` (placeholder only) |
| API | `GET` / `POST /api/market/pop/children`, `GET` / `PATCH` / `DELETE /api/market/pop/children/[id]` (detail returns the last 50 stamps, tokens and redemptions), `GET /api/market/pop/stamp-types`, `POST /api/market/pop/stamps`, `POST /api/market/pop/redemptions` |
| lib | `lib/markets/pop-icons.js` (maps `pop_stamp_types.icon` names to lucide icons; avatar colours) |
| Tables | `child_profiles`, `pop_stamp_types`, `pop_stamps_earned`, `pop_tokens`, `pop_redemptions`, `vendors`, `market_dates`, `market_config` |

### 6. Push notifications

What it did: shoppers could turn on browser notifications on their profile page. On market day at 8:00 a.m. Pacific, every subscribed device got "Today at `<market>`: Open today `<start>`–`<end>`…", linking to `/market`.

- **Service worker:** `public/sw.js`, registered at scope `/` by `ServiceWorkerRegister` (mounted in the `/market` layout, 1.5 s after load). Besides push, it cached `/market` shell routes and served network-first navigations and stale-while-revalidate scripts, styles and images for the whole origin, except `/api` and `/admin`.
- **Subscribe:** `lib/markets/push-client.js` requested permission, subscribed with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and posted to `/api/market/push/subscribe`. That route upserts on `endpoint` and attaches `shopper_id` if signed in; anonymous subscriptions were allowed.
- **Send:** `lib/markets/web-push-server.js` (`web-push`, VAPID keys). It returns `gone` for 404/410 so the cron deletes dead subscriptions.
- **Cron:** `app/api/cron/market-day-push/route.js` was scheduled at **both** 15:00 and 16:00 UTC on Wednesdays (`0 15 * * 3`, `0 16 * * 3`). Only the run where the Pacific hour is 8 proceeded, to handle daylight saving. It skipped days with no `market_dates` row or a cancelled one. It accepted `?dryRun=1` and `?force=1`, or a POST body with a custom message. It also sent the SMS reminder (feature 7).

| Kind | Files |
|---|---|
| Pages | `app/market/profile/page.js` (toggle) |
| API | `POST /api/market/push/subscribe`, `POST /api/market/push/unsubscribe` (by endpoint), `GET /api/market/push/public-key` (unused; the client read the env var directly) |
| lib / components | `lib/markets/push-client.js`, `lib/markets/web-push-server.js`, `components/markets/ServiceWorkerRegister.jsx` |
| Other | `public/sw.js` |
| Cron | `app/api/cron/market-day-push/route.js` |
| Tables | `push_subscriptions`, `market_config`, `market_dates` |

### 7. SMS opt-in

What it did: shoppers could save a phone number and opt in to texts on their profile page. Vendors could receive texts if `vendors.sms_opt_in = true` and `vendors.phone` was set.

SMS was used for:
- the shopper order confirmation, when the shopper was opted in (profile flag) and had a phone
- the vendor fulfillment link
- the market-day morning reminder to all opted-in shoppers

Provider: Twilio, through `lib/notifications/channels/sms.js`, which Direct also uses. Every text ended with "Reply STOP to opt out." Phones were normalised to E.164, and US 10-digit numbers got `+1`.

| Kind | Files |
|---|---|
| Pages | `app/market/profile/page.js`, `app/admin/notifications/page.js` (Twilio status and test send, platform role) |
| API | `GET` / `PATCH /api/market/profile/notifications` (opting in requires a phone on file; creates the `shopper_profiles` row if missing), `GET` / `POST /api/market/admin/sms/test` |
| lib | `lib/notifications/channels/sms.js` (`sendMarketOrderConfirmation`, `sendMarketFulfillmentMagicLink`, `sendMarketDayReminder`, `sendGeneric`), `lib/notifications/index.js` (`notifyMarketDayReminder`, `channelStatus`) |
| Migration | `supabase/migrations/2026-06-twilio-sms-opt-in.sql` |
| Tables | `shopper_profiles` (`phone`, `sms_opt_in`), `vendors` (`phone`, `sms_opt_in`), `orders.shopper_phone` |

### 8. Market dates and configuration

What it did:
- **Calendar page:** the season's market days grouped by month, with cancelled "dark weeks" and notes.
- **Admin Settings (platform role):** edits the active market's identity, colours, PWA name, icon and colours, street-map settings, Venmo platform handle, contact email, social links and "about" text.
- **Admin Market dates:** updates existing dates (notes, cancelled). There was no way to add dates from the UI; they came from the seed SQL.

| Kind | Files |
|---|---|
| Pages | `app/market/calendar/page.js`, `app/admin/market-dates/page.js`, `app/admin/dates/page.js` (redirect to market-dates), `app/admin/settings/page.js` |
| API | `GET /api/market/dates`, `GET /api/market/config`, `GET` / `PATCH /api/market/admin/config` (PATCH platform-only), `GET /api/market/admin/dates`, `PATCH /api/market/admin/dates/[id]` (`date`, `start_time`, `end_time`, `weather_forecast`, `is_cancelled`, `notes`) |
| Tables | `market_config`, `market_dates` |

### 9. Markets admin

All pages used `components/markets/AdminShell.jsx`. It checks for an admin session, redirects to `/admin/login` if there isn't one, and shows a sidebar with a "Dropvine Direct" section and a "Dropvine Markets" section. Both roles saw everything except Settings and Notifications (platform only).

| Area | Page | API | What it did |
|---|---|---|---|
| Dashboard | `app/admin/page.js` | `GET /api/market/admin/dashboard` | Counts (vendors, products, orders by status, pending submissions) and the 8 latest orders |
| Vendors | `app/admin/vendors/page.js`, `vendors/new/page.js`, `vendors/[id]/page.js` | `GET` / `POST /api/market/admin/vendors`, `GET` / `PATCH` / `DELETE /api/market/admin/vendors/[id]`, `POST …/[id]/regenerate-fulfillment-links` | List, create, edit (name, slug, tagline, description, logo, cover, categories, Venmo, email, phone, website, Instagram, accepts pre-orders, booth number, active). Delete hides the vendor (`is_active = false`). Shows product and post counts only; there was no product editor. Uses `components/markets/VendorEditor.jsx`. |
| QR codes | `app/admin/qr-codes/page.js` | `GET /api/market/admin/vendors` | Printable grid of booth QR codes (see feature 4) |
| Submissions | `app/admin/submissions/page.js` | `GET /api/market/admin/submissions`, `POST /api/market/admin/submissions/[type]/[id]/[action]` | Review vendor posts and products sent in through Tally forms. Approve or reject only changed the submission's status (see Known issues). |
| Tally webhooks | — | `POST /api/webhooks/tally-post`, `POST /api/webhooks/tally-product` (plus `GET` health checks) | Verified the `tally-signature` HMAC (`TALLY_WEBHOOK_SECRET`; unsigned requests were accepted if the secret was empty), matched the vendor by email and stored the raw payload as a `pending` submission |
| Orders | `app/admin/orders/page.js` | `GET /api/market/admin/orders` (does not exist; see Known issues), `GET` / `PATCH /api/market/admin/orders/[id]` | List orders and change status with quick actions |
| Settings | `app/admin/settings/page.js` | `/api/market/admin/config` | See feature 8 |
| Notifications | `app/admin/notifications/page.js` | `/api/market/admin/sms/test` | See feature 7 |
| Placeholders | `app/admin/attendance`, `challenges`, `amenities`, `pop` | — | "Coming soon" pages; never built |
| Unused | — | `GET /api/market/admin/me` | Returns the role for a token; nothing called it |

---

## Database

### Where it came from

| File | What it created |
|---|---|
| `supabase/markets_schema.sql` | All 27 tables below, indexes, RLS policies, two trigger functions, and the Willamette seed data. Additive: meant to run after `supabase/schema.sql` and to touch no Direct table. |
| `supabase/migrations/2026-06-twilio-sms-opt-in.sql` | `shopper_profiles.sms_opt_in`, `vendors.sms_opt_in` and partial indexes on both. The same statements are repeated at the end of `markets_schema.sql`. |

No Markets table shares a name with a Direct table. Direct uses `direct_vendors`, `drops`, `drop_orders`, `drop_order_items` and so on.

### Tables and columns

Unless noted, `id uuid primary key default gen_random_uuid()` and `created_at timestamptz not null default now()`. "Unused" means no code in this build read or wrote the table.

**Market and schedule**
- **`market_config`**: `id`, `name text not null`, `subtitle`, `season`, `primary_color` (default `#2F5233`), `accent_color` (default `#E2A93C`), `logo_url`, `pwa_icon_url`, `pwa_short_name`, `pwa_theme_color`, `pwa_background_color` (default `#FAF7F2`), `map_layout jsonb` (default `{"width":1000,"height":700,"stalls":[]}`, unused by the map), `map_booth_count int` (default 12), `map_orientation text` (`horizontal` | `vertical`), `map_street_name`, `map_cross_street_start`, `map_cross_street_end`, `venmo_platform_handle`, `contact_email`, `social_links jsonb` (default `{}`), `about_md`, `is_active bool` (default false; unique index allows only one true), `created_at`, `updated_at`.
- **`market_dates`**: `id`, `market_config_id → market_config` (cascade), `date date not null`, `start_time time` (default 15:00), `end_time time` (default 20:00), `weather_forecast`, `is_cancelled bool` (default false), `notes`, `created_at`. Unique `(market_config_id, date)`.
- **`market_attendance`** (unused): `id`, `market_date_id → market_dates`, `vendor_id → vendors`, `status` (`confirmed` | `tentative` | `cancelled`), `created_at`. Unique `(market_date_id, vendor_id)`.
- **`market_amenities`** (unused): `id`, `market_config_id`, `name`, `icon`, `description`, `map_position jsonb`, `display_order`, `created_at`.

**Vendors and catalogue**
- **`vendors`**: `id`, `market_config_id → market_config` (cascade), `name not null`, `slug citext unique not null`, `tagline`, `description`, `logo_url`, `cover_url`, `categories text[]`, `venmo_handle` (no `@`), `email`, `phone`, `website`, `instagram_handle`, `accepts_preorders bool` (default false), `booth_number int`, `map_position jsonb`, `is_active bool` (default true), `sms_opt_in bool` (default false), `created_at`, `updated_at`.
- **`products`**: `id`, `vendor_id → vendors` (cascade), `name not null`, `description`, `price_cents int` (default 0), `image_url`, `category`, `is_available bool` (default true), `stock_quantity int` (never enforced), `display_order int`, `created_at`, `updated_at`.
- **`vendor_posts`**: `id`, `vendor_id → vendors`, `title`, `body not null`, `image_url`, `posted_at`, `expires_at`, `is_published bool` (default true).
- **`flash_deals`** (unused): `id`, `vendor_id`, `market_date_id`, `title`, `description`, `original_price_cents`, `sale_price_cents`, `starts_at`, `ends_at`, `is_active`, `created_at`.

**Orders**
- **`orders`**: `id`, `short_code text unique not null` (default `upper(substr(md5(random()::text),1,8))`), `shopper_id → auth.users` (set null), `vendor_id → vendors` (restrict), `market_date_id → market_dates` (set null; always null in practice), `subtotal_cents`, `total_cents`, `status` (`pending_payment` | `payment_received` | `fulfilled` | `cancelled` | `refunded`), `venmo_note`, `stripe_payment_intent_id` (unused), `payment_received_at`, `fulfilled_at`, `pickup_window`, `shopper_email`, `shopper_name`, `shopper_phone`, `notes`, `created_at`, `updated_at`.
- **`order_items`**: `id`, `order_id → orders` (cascade), `product_id → products` (set null), `product_name_snapshot not null`, `quantity int > 0`, `unit_price_cents`, `line_total_cents`, `created_at`.
- **`fulfillment_tokens`**: `id`, `order_id → orders` (cascade), `token text unique not null`, `expires_at not null`, `used_at` (never set), `created_at`.

**Shoppers**
- **`shopper_profiles`**: `id → auth.users` (primary key, cascade), `email unique`, `display_name`, `avatar_url`, `phone`, `preferences jsonb`, `notification_opt_in bool` (default true), `sms_opt_in bool` (default false), `created_at`, `updated_at`.
- **`push_subscriptions`**: `id`, `shopper_id → auth.users` (nullable), `endpoint text unique not null`, `p256dh not null`, `auth not null`, `user_agent`, `created_at`.
- **`vendor_follows`** (unused): `id`, `shopper_id → auth.users`, `vendor_id → vendors`, `created_at`. Unique `(shopper_id, vendor_id)`.

**Passport and gamification**
- **`passport_stamps`**: `id`, `shopper_id → auth.users` (cascade), `vendor_id → vendors` (cascade), `market_date_id → market_dates` (set null), `stamped_at`. Unique `(shopper_id, vendor_id, market_date_id)`.
- **`challenges`** (unused): `id`, `market_config_id`, `title`, `description`, `icon`, `target_count`, `reward_text`, `badge_id → badges`, `is_active`, `starts_at`, `ends_at`, `created_at`.
- **`badges`** (unused): `id`, `market_config_id`, `name`, `description`, `icon_url`, `criteria_text`, `created_at`.
- **`challenge_completions`** (unused): `id`, `shopper_id`, `challenge_id`, `completed_at`. Unique `(shopper_id, challenge_id)`.
- **`shopper_badges`** (unused): `id`, `shopper_id`, `badge_id`, `earned_at`. Unique `(shopper_id, badge_id)`.

**POP Kids**
- **`child_profiles`**: `id`, `parent_shopper_id → auth.users` (cascade), `name not null`, `age int`, `avatar_url`, `total_pop_tokens int` (default 0, denormalised), `created_at`.
- **`pop_stamp_types`**: `id`, `market_config_id → market_config`, `name not null`, `icon` (lucide icon name), `description`, `token_reward int` (default 0), `is_active bool`, `created_at`.
- **`pop_stamps_earned`**: `id`, `child_profile_id → child_profiles` (cascade), `pop_stamp_type_id → pop_stamp_types` (cascade), `market_date_id` (set null), `earned_at`.
- **`pop_tokens`**: `id`, `child_profile_id → child_profiles` (cascade), `amount int not null`, `source` (`purchase` | `reward` | `admin`), `market_date_id`, `notes`, `created_at`.
- **`pop_redemptions`**: `id`, `child_profile_id → child_profiles` (cascade), `vendor_id → vendors` (restrict), `amount int > 0`, `market_date_id`, `redeemed_at`.

**Admin**
- **`post_submissions`**: `id`, `vendor_id → vendors` (set null), `vendor_email`, `raw_payload jsonb not null`, `status` (`pending` | `approved` | `rejected`), `processed_at`, `processed_by_role`, `resulting_post_id → vendor_posts` (never set), `created_at`.
- **`product_submissions`**: same shape as `post_submissions`, with `resulting_product_id → products` (never set).
- **`admin_audit_log`** (unused): `id`, `admin_role` (`platform` | `organiser`), `action`, `target_type`, `target_id`, `payload jsonb`, `created_at`.

### Triggers, RLS and seed

- **`on_auth_user_created_shopper`** on `auth.users` → `handle_new_shopper()` inserts a `shopper_profiles` row for **every** new user, including Direct vendors. Drop this trigger before dropping `shopper_profiles`.
- **`trg_touch_<table>`** → `touch_updated_at()` keeps `updated_at` current on `market_config`, `vendors`, `products`, `orders` and `shopper_profiles`.
- **RLS** was enabled on all 27 tables:
  - Public reads: active config, all dates, active vendors, attendance, published posts, available products, active challenges, badges, active stamp types, active flash deals, amenities.
  - Owner-only (`auth.uid()`): shopper profiles, push subscriptions, follows, passport stamps, completions, badges earned, child profiles, and select-only on a child's tokens, redemptions and stamps.
  - Orders: shoppers could read their own; **anyone could insert**.
  - Fulfillment tokens, submissions and the audit log had no policies (service role only).

  In practice the app went through the service role, so RLS mattered only for direct anon-key access.
- **Seed:** one market, 6 vendors (booths 1, 2, 4, 7, 9, 11), 18 Wednesday dates (July 1 marked cancelled), attendance for the first 5 weeks, 13 products, 5 amenities, 3 badges, 2 challenges, 4 POP stamp types (1 token each) and 4 vendor posts.

---

## Passport and booth stamps, end to end

### Pieces

| Piece | Where |
|---|---|
| Printable booth QR codes | `app/admin/qr-codes/page.js` |
| In-app scanner | `app/market/passport/scan/page.js` |
| Stamp landing page (what a QR opens) | `app/market/stamp/[vendorSlug]/page.js` |
| Stamp API | `app/api/market/passport/route.js` (`GET` list, `POST` stamp) |
| Passport page | `app/market/passport/page.js` |
| Data | `passport_stamps`, `vendors`, `market_dates` |

### Flow

1. **Codes.** The admin opens **QR codes**. The page loads active vendors (`GET /api/market/admin/vendors`, filtered to `is_active`) and renders one card per vendor: booth number, name and a QR code (`qrcode.react`, `QRCodeSVG`, 170 px, error correction level M) encoding **`<site origin>/market/stamp/<vendor slug>`**. "Print all" calls `window.print()`, and print CSS hides the chrome and avoids splitting cards. The QR holds only a public URL; there is no secret in it.
2. **Scan.** Either:
   - the shopper's phone camera opens the URL directly, or
   - the shopper taps **Scan a vendor's QR** on the Passport page (`/market/passport/scan`). It dynamic-imports `html5-qrcode` and renders `Html5QrcodeScanner` (10 fps, 240 px box, remembers the last camera). On a decode it accepts either a URL whose path matches `/market/stamp/<slug>` or a bare slug (`^[a-z0-9-]+$`), stops the scanner and navigates to `/market/stamp/<slug>`. Anything else shows "That QR didn't look like a booth code."
3. **Landing page** (`/market/stamp/<slug>`, client component). It waits for auth to load, then:
   - **Signed out:** shows "Sign in to stamp" with a link to `/login?next=/market/stamp/<slug>`. The login page ignored `next`; see Known issues.
   - **Signed in:** immediately sends `POST /api/market/passport` with `{ vendor_slug }` and shows "Stamping…". Then:
     - **"Stamp collected!"** with the vendor name, or
     - **"Already stamped today"**, or
     - **"Couldn't stamp"** with the error.

     The success states link to **View passport** and **Scan another**.
4. **Stamp API** (`POST /api/market/passport`):
   1. Requires a Supabase session (`auth.getUser()` from the cookie); otherwise 401.
   2. Requires `vendor_slug`; otherwise 400.
   3. Looks up an **active** vendor by slug (service role); otherwise 404 "vendor not found".
   4. Finds today's market day: `market_dates` for the vendor's `market_config_id` where `date` = today, taken as the **UTC** date (`new Date().toISOString().slice(0,10)`). It uses the row's id only if the row exists and isn't cancelled; otherwise `market_date_id = null`.
   5. Inserts `passport_stamps (shopper_id, vendor_id, market_date_id)`.
   6. If the insert hits the unique constraint `(shopper_id, vendor_id, market_date_id)` (Postgres error 23505), it returns `{ ok: true, alreadyStamped: true, vendor }`. Otherwise it returns `{ ok: true, stamp, vendor }`.

   The intended rule was **one stamp per shopper per vendor per market day**.
5. **Passport page** (`/market/passport`):
   - Loads every active vendor of the active market (`GET /api/market/vendors`) and, if signed in, the shopper's stamps (`GET /api/market/passport`: stamps joined to vendor id, name, slug, categories, booth; newest first).
   - "Stamped" means the vendor's id appears in any stamp, on any day.
   - Shows "N of M vendors stamped", a progress bar and a grid of every vendor: filled check badge if stamped, dashed outline if not.
   - Signed-out visitors see a sign-in prompt and the empty grid.

### Rebuilding it in a separate Next.js + Supabase app

The minimum to reproduce the behaviour:

1. **Tables:** `vendors (id, market_id, name, slug unique, booth_number, is_active)`, `market_dates (id, market_id, date, is_cancelled)`, `passport_stamps (id, shopper_id → auth.users, vendor_id, market_date_id, stamped_at)`, with RLS letting a shopper read their own stamps.
2. **Stamp endpoint:** server route, session required, looks up the vendor by slug, resolves today's market day, inserts, and treats a unique violation as "already stamped".
3. **Pages:** `/stamp/[slug]` (auto-stamps on load), `/passport` (grid and progress), `/passport/scan` (`html5-qrcode`), and an admin QR sheet (`qrcode.react`).

**Fix these while rebuilding** (details in Known issues):
- Resolve "today" in the market's time zone, not UTC.
- Make the one-per-day rule hold on non-market days. Use a non-null `stamp_date date` column and `unique (shopper_id, vendor_id, stamp_date)`, or a unique index that treats null as a value (Postgres 15+ `NULLS NOT DISTINCT`).
- Carry the return path through sign-in and sign-up so a first-time scanner lands back on the stamp page.
- Decide whether proof of presence matters. If it does, put a rotating or signed token in the QR (for example `?t=<HMAC(vendor, date)>`) and check it on the server; a static URL can be shared and stamped from anywhere.

---

## Known issues

These were found in the code and were still present when it was archived.

**Raised in review**
1. **Admin Orders page never showed orders.** `app/admin/orders/page.js` fetched `GET /api/market/admin/orders`, but that route only exports `POST`, so the request returned 405 and the list was always empty. Status changes through `PATCH /api/market/admin/orders/[id]` worked.
2. **Unauthenticated `POST /api/market/admin/orders`.** Despite the admin path, the route had no admin check. It was a copy of the public `POST /api/market/orders`: anyone could create an order, a fulfillment token, and the shopper and vendor emails/SMS. Nothing in the app called it with POST.
3. **Public order lookup by short code.** `GET /api/market/orders/[shortCode]` returned the order, including `shopper_email` and `shopper_name`, plus items and vendor, to anyone with the code. Codes are 8 hex characters with no rate limit.

**Also found while writing this**

4. **Sign-in didn't return shoppers to the stamp page.** `/login` ignored `?next=` and always sent people to `/dashboard` (Direct's vendor dashboard). The stamp page also offered "Sign in with Google", which didn't exist.
5. **Every shopper who signed up became a Direct vendor.** Markets used Direct's Supabase Auth. Direct's `on_auth_user_created_direct_vendor` trigger creates a `direct_vendors` row for every new user, and the Markets trigger creates a `shopper_profiles` row for every new user. Shopper and vendor accounts were never separated.
6. **UTC "today".** The passport, POP stamps and redemptions all used the UTC date to find today's `market_dates` row. From 5 p.m. Pacific in summer (4 p.m. in winter) they looked for tomorrow's date, found nothing, and saved `market_date_id = null`. The seed markets ran 3–8 p.m., so the last hours of every market were affected.
7. **"One stamp per vendor per day" didn't hold without a market day.** Postgres treats nulls as distinct in unique constraints, so with `market_date_id = null` the same shopper could stamp the same vendor any number of times. This happened on any non-market day and during the UTC evening window above.
8. **No proof of presence for stamps.** The QR was a static public URL; anyone with it could stamp from anywhere.
9. **POP was on the honour system.** Parents awarded stamps (and so tokens) to their own children with no limit and no staff or vendor check. Redemptions were self-reported; the vendor never confirmed. The balance check and insert weren't atomic, so two simultaneous redemptions could overspend.
10. **`child_profiles.total_pop_tokens` could drift.** It was updated with read-modify-write after each stamp or redemption. The child detail endpoint recomputed the live balance, but the list endpoint returned the stored value.
11. **Fulfillment link had no status rules.** Any action was allowed from any status (for example cancelled → fulfilled). `fulfillment_tokens.used_at` was never set, so links stayed valid until expiry (30 days, or 7 for re-minted links).
12. **Admin order status updates dropped timestamps.** The PATCH wrote `paid_at`, `cancelled_at` and `admin_note`, which don't exist on `orders`. It then retried with the status only, so `payment_received_at` was never set from the admin page.
13. **Approving a submission did nothing else.** Approve and reject only changed `post_submissions.status` or `product_submissions.status`; no `vendor_posts` or `products` row was created, and `resulting_*_id` was never set. There was also no admin UI to create or edit products, so products existed only from the seed.
14. **Vendor SMS had no UI.** `vendors.sms_opt_in` wasn't editable in the vendor editor (not in the allowed fields); it could only be set in SQL.
15. **Order fields the cart never sent.** The cart never sent `market_date_id` (always null on orders) or `sms_opt_in` (shopper SMS happened only through the profile setting). `products.stock_quantity` was never checked.
16. **Order creation wasn't transactional.** The order row, the Venmo-note update, the items and the token were separate writes. A failed item insert was only logged, and the token insert wasn't checked.
17. **Service worker covered the whole site.** `sw.js` registered at scope `/` and cached navigations and static assets for every dropvine.pro page, not just `/market`. It stays in browsers that installed it until replaced by a worker that unregisters itself.
18. **Site-wide PWA manifest pointed at Markets.** `app/manifest.js` served the Markets name, `start_url: '/market'` and `/market` shortcuts for the whole domain, so installing dropvine.pro as an app opened the Markets shopper app.
19. **Anyone could insert orders directly.** The `orders_anyone_insert` RLS policy let anyone with the anon key insert order rows through Supabase, bypassing the API's checks.
20. **Tally webhooks accepted unsigned requests** when `TALLY_WEBHOOK_SECRET` was empty.
21. **Unused tables:** `market_attendance`, `market_amenities`, `flash_deals`, `vendor_follows`, `challenges`, `badges`, `challenge_completions`, `shopper_badges` and `admin_audit_log` were created (some seeded) but never used by code.

---

## Configuration and dependencies

**Environment variables**

| Variable | Used for | Shared with Direct? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Database and auth | Yes |
| `VITE_ADMIN_PASSWORD`, `VITE_ORGANISER_PASSWORD` | Admin login roles | Yes |
| `CRON_SECRET` | Cron auth; admin token signing | Yes |
| `RESEND_API_KEY`, `RESEND_FROM` | Email | Yes |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS | Yes |
| `TALLY_WEBHOOK_SECRET` | Tally signature check on the post and product webhooks | No; Direct's Tally drop webhook doesn't check it |
| `NEXT_PUBLIC_BASE_URL` | Absolute links in emails and push | Yes |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push | No, Markets only |

**Crons** (`vercel.json`): `/api/cron/market-fulfillment-links` hourly; `/api/cron/market-day-push` Wednesdays at 15:00 and 16:00 UTC.

**npm packages used only by Markets:** `html5-qrcode`, `qrcode.react`, `web-push`. Shared: `twilio`, `resend`, `@react-email/*`, `@supabase/*`, `lucide-react`.

---

## What stayed in dropvine.pro

These files look like Markets code but are used by Dropvine Direct, so they were kept:

| File | Why |
|---|---|
| `app/admin/login/page.js`, `POST /api/market/admin/login` | Admin login for `/admin/direct/*` |
| `components/markets/AdminShell.jsx` | Layout for every `/admin/direct/*` page |
| `lib/markets/admin-auth.js`, `lib/markets/admin-client.js` | Admin tokens for Direct admin pages and routes |
| `/api/market/admin/direct/*` | Direct admin: drops, orders, vendors, site settings |
| `/api/market/admin/drops/[id]/publish`, `…/notify-now`, `…/[id]`, `…/[id]/products` | Direct drops (the path only says "market") |
| `lib/markets/tally.js`, `tally-products.js`, `tally-images.js` | Direct's Tally drop webhook, drop lifecycle emails and templates |
| `lib/markets/direct-vendor-markets.js` | "Find them at these markets" on Direct vendor pages. Reads the **new** Markets site's Supabase (`NEXT_PUBLIC_MARKETS_SUPABASE_*`), not these tables. |
| `lib/notifications/index.js`, `lib/notifications/channels/sms.js`, `lib/email/notifications.js` | Direct email and SMS; only the Markets functions were removed |

The Markets **database tables were not dropped** when the code was removed. `supabase/markets_schema.sql` and `supabase/migrations/2026-06-twilio-sms-opt-in.sql` remain the record of how they were created.
