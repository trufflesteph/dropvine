// Tally webhook for Dropvine DIRECT drop submissions.
//
// A vendor fills out a Tally form, Tally POSTs the response here, we extract
// the product fields, look up the creator via vendor_email, generate a unique
// handle, insert a DRAFT row into `launches`, and email the platform owner a
// link to the admin preview page.
//
// Header: `tally-signature` = HMAC-SHA256(rawBody, TALLY_DIRECT_DROP_SECRET) base64.
// If the secret is empty, accepts unsigned (placeholder mode) — same pattern as
// /api/webhooks/tally-post.
//
// NOTE: This route is ADDITIVE — it does not touch existing Dropvine Direct
// routes. Drafts are invisible on the public /l/[handle] page until published.

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getTallyField, getTallyEmail, getTallyText, getTallyNumber, getTallyFiles } from '@/lib/markets/tally'
import { extractLaunchProducts } from '@/lib/markets/tally-products'
import { extractLaunchSubscribers, ingestLaunchSubscribers } from '@/lib/drop-lifecycle/contacts'
import { scheduleDropLifecycle } from '@/lib/drop-lifecycle/cadence'
import { sendDraftDropReview } from '@/lib/email/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isSecretConfigured() {
  return !!process.env.TALLY_DIRECT_DROP_SECRET && process.env.TALLY_DIRECT_DROP_SECRET.trim().length > 0
}

function verifySignature({ rawBody, signature }) {
  if (!isSecretConfigured()) return { ok: true, placeholder: true }
  if (!signature) return { ok: false, reason: 'missing tally-signature header' }
  const expected = crypto.createHmac('sha256', process.env.TALLY_DIRECT_DROP_SECRET).update(rawBody, 'utf8').digest('base64')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return { ok: false, reason: 'signature length mismatch' }
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' }
  return { ok: true }
}

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/['’“”"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56)
}

function randomSuffix(n = 5) {
  return crypto.randomBytes(8).toString('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, n)
}

async function makeUniqueHandle(supa, base) {
  const root = slugify(base) || 'drop'
  // Try plain root first, then root-xxxx until we find a free slot
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${randomSuffix(4)}`
    const { data } = await supa.from('launches').select('id').eq('handle', candidate).maybeSingle()
    if (!data) return candidate
  }
  return `${root}-${randomSuffix(8)}`
}

function extractFirstUrl(arr) {
  if (!Array.isArray(arr) || !arr.length) return null
  const first = arr[0]
  return first?.url || null
}

export async function POST(request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('tally-signature')
    const verify = verifySignature({ rawBody, signature })
    if (!verify.ok) {
      console.warn('[tally-direct-drop] signature failed:', verify.reason)
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
    if (verify.placeholder) {
      console.warn('[tally-direct-drop] PLACEHOLDER MODE — TALLY_DIRECT_DROP_SECRET is empty; accepting unsigned webhook')
    }

    let body
    try { body = JSON.parse(rawBody) } catch {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }

    const fields = body?.data?.fields || []

    // Extract every field. Labels are tolerant — we match by substring.
    const vendorEmail = (getTallyEmail(fields) || '').trim().toLowerCase() || null
    const productName = getTallyText(fields, 'product name') || getTallyText(fields, 'title') || 'Untitled drop'
    const description = getTallyText(fields, 'description') || null
    const priceCents = (() => {
      const dollars = getTallyNumber(fields, 'price')
      if (dollars == null) return 0
      // Treat any value > 1000 as already-cents; otherwise multiply.
      return dollars >= 1000 ? Math.round(dollars) : Math.round(dollars * 100)
    })()
    const capacity = getTallyNumber(fields, 'capacity') || getTallyNumber(fields, 'quantity') || null
    const openMode = (getTallyText(fields, 'open mode') || getTallyText(fields, 'when') || 'now').toLowerCase()
    const countdownAtRaw = getTallyText(fields, 'countdown')
    const countdownAt = countdownAtRaw ? new Date(countdownAtRaw) : null
    const pickupDetails = getTallyText(fields, 'pickup') || null
    const venmoHandle = (getTallyText(fields, 'venmo') || '').replace(/^@/, '').trim() || null
    const collectionMode = (getTallyText(fields, 'collection') || 'pre-order').toLowerCase()
    const coverFiles = getTallyFiles(fields, 'cover')
    const galleryFiles = getTallyFiles(fields, 'photo')
    const coverUrl = extractFirstUrl(coverFiles) || extractFirstUrl(galleryFiles) || null
    const photoUrls = galleryFiles.map((f) => f.url).filter(Boolean)

    // notify_at — when to fan-out to the waitlist. Optional on the Tally form.
    // Matches labels containing 'notify', 'send notification', or 'announce'.
    const notifyRaw = getTallyText(fields, 'notify')
      || getTallyText(fields, 'send notification')
      || getTallyText(fields, 'announce')
    let notifyAt = null
    if (notifyRaw) {
      const d = new Date(notifyRaw)
      if (!Number.isNaN(d.getTime())) notifyAt = d.toISOString()
    }

    // closes_at — when this drop stops accepting orders. Optional. Matches
    // labels containing 'close', 'closes', 'order deadline', or 'cutoff'.
    // Used by the lifecycle cron to schedule pre-close + close-summary emails.
    const closeRaw = getTallyText(fields, 'close')
      || getTallyText(fields, 'closes')
      || getTallyText(fields, 'order deadline')
      || getTallyText(fields, 'cutoff')
    let closesAt = null
    if (closeRaw) {
      const d = new Date(closeRaw)
      if (!Number.isNaN(d.getTime())) closesAt = d.toISOString()
    }

    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

    // Look up creator by email — profiles table is the source of truth.
    let creatorId = null
    let vendorName = null
    if (vendorEmail) {
      const { data: profile } = await supa
        .from('profiles').select('id, display_name, full_name')
        .eq('email', vendorEmail).maybeSingle()
      if (profile) {
        creatorId = profile.id
        vendorName = profile.display_name || profile.full_name || null
      }
    }
    // Fallback: if no vendor profile match (vendors don't have logins in this
    // flow, so they may not exist in `profiles` yet), assign the draft to the
    // platform owner so it can land + be triaged. Owner can re-attribute later.
    let attributedToOwner = false
    if (!creatorId && process.env.PLATFORM_OWNER_EMAIL) {
      const { data: owner } = await supa
        .from('profiles').select('id')
        .eq('email', process.env.PLATFORM_OWNER_EMAIL).maybeSingle()
      if (owner) { creatorId = owner.id; attributedToOwner = true }
    }
    if (!creatorId) {
      console.warn('[tally-direct-drop] no profile match for vendor or owner:', vendorEmail, process.env.PLATFORM_OWNER_EMAIL)
      return NextResponse.json({
        error: 'no_creator_match',
        detail: `Could not find a profile for vendor_email "${vendorEmail || '(missing)'}" or PLATFORM_OWNER_EMAIL "${process.env.PLATFORM_OWNER_EMAIL || '(unset)'}". Create a profile for the vendor in Supabase (or set PLATFORM_OWNER_EMAIL to a registered user) and retry.`,
      }, { status: 422 })
    }

    // Decide launch_at
    const now = new Date()
    let launchAt = now.toISOString()
    if (openMode.startsWith('countdown') && countdownAt && !isNaN(countdownAt.getTime())) {
      launchAt = countdownAt.toISOString()
    }

    // Unique handle
    const handle = await makeUniqueHandle(supa, productName)

    // Insert. Only include columns we KNOW exist (Step 1 SQL must be run first).
    const insertPayload = {
      handle,
      title: productName,
      description,
      price_cents: priceCents,
      capacity,
      launch_at: launchAt,
      status: 'draft',
      creator_id: creatorId,                  // may be null — owner will resolve in admin
      cover_url: coverUrl,
      // New columns added in Step 1
      pickup_details: pickupDetails,
      photo_urls: photoUrls.length ? photoUrls : null,
      collection_mode: collectionMode,
      venmo_handle: venmoHandle,
      // Scheduled notifications (2026-06-launches-notify-schedule.sql)
      notify_at: notifyAt,
      // Phase A lifecycle (2026-06-drop-lifecycle.sql)
      closes_at: closesAt,
    }

    let { data: inserted, error: insErr } = await supa.from('launches').insert(insertPayload).select('*').single()
    if (insErr) {
      // If Step 1 SQL hasn't been run yet, some columns will be missing. Retry
      // with just the core legacy columns so the submission still lands somewhere.
      // PostgREST error formats vary: "column X does not exist" (Postgres) or
      // "Could not find the 'X' column" (PostgREST schema cache).
      if (/column .* does not exist|could not find the .* column|schema cache/i.test(insErr.message)) {
        console.warn('[tally-direct-drop] new columns missing — retrying with legacy schema only. RUN supabase/markets_schema.sql STEP 1 ALTER TABLE statements.')
        const minimal = {
          handle, title: productName, description, price_cents: priceCents, capacity,
          launch_at: launchAt, status: 'draft', creator_id: creatorId, cover_url: coverUrl,
        }
        const retry = await supa.from('launches').insert(minimal).select('*').single()
        inserted = retry.data; insErr = retry.error
      }
    }
    if (insErr) {
      console.error('[tally-direct-drop] insert failed:', insErr.message)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    // === Multi-product seeding ===========================================
    // Two parsing modes (priority order):
    //   1. CSV/spreadsheet upload → parse rows into launch_products.
    //   2. Manual repeating fields (`product_1_name`, `product_1_price`, …).
    // If neither produced rows, the public /l/[handle] page falls back to the
    // existing single-product behaviour driven by launches.price_cents.
    let productsSource = 'none'
    let productsInserted = 0
    try {
      const { products, source } = await extractLaunchProducts(fields)
      productsSource = source
      if (products.length) {
        const payload = products.map((p, i) => ({
          launch_id: inserted.id,
          name: p.name,
          description: p.description,
          price_cents: p.price_cents,
          quantity: p.quantity,
          photo_url: p.photo_url,
          sort_order: typeof p.sort_order === 'number' ? p.sort_order : i,
        }))
        const { data: ins, error: pErr } = await supa.from('launch_products').insert(payload).select('id')
        if (pErr) {
          // Migration not run yet — log + continue. Admin can re-seed manually
          // from the Preview page once the table exists.
          if (/could not find the table|relation .* does not exist|schema cache/i.test(pErr.message)) {
            console.warn('[tally-direct-drop] launch_products table missing — run supabase/migrations/2026-06-multi-product.sql')
          } else {
            console.warn('[tally-direct-drop] launch_products insert failed (non-fatal):', pErr.message)
          }
        } else {
          productsInserted = ins?.length || 0
        }
      }
    } catch (e) {
      console.warn('[tally-direct-drop] product extraction failed (non-fatal):', e?.message || e)
    }

    // === Phase A: contact list ingestion ================================
    // If a Tally CSV (label: contacts / audience / subscribers / mailing list)
    // OR a pasted email block is present, insert rows into launch_subscribers
    // for downstream fan-out by the lifecycle cron.
    let subscribersIngested = 0
    let subscribersSource = 'none'
    try {
      const { rows: subRows, source: subSource } = await extractLaunchSubscribers(fields)
      subscribersSource = subSource
      if (subRows.length) {
        const ingest = await ingestLaunchSubscribers({ supa, launch_id: inserted.id, rows: subRows })
        if (ingest.ok) subscribersIngested = ingest.inserted
        else if (ingest.error === 'migration_pending') {
          console.warn('[tally-direct-drop] launch_subscribers migration pending — contacts not persisted')
        }
      }
    } catch (e) {
      console.warn('[tally-direct-drop] contacts ingest failed (non-fatal):', e?.message || e)
    }

    // === Phase A: lifecycle email cadence ===============================
    // Pre-compute open / +5d / pre-close / close-summary rows in email_schedules.
    // The cron at /api/cron/drop-lifecycle picks them up when due.
    let cadenceScheduled = null
    try {
      const schedule = await scheduleDropLifecycle({ supa, launch: inserted })
      if (schedule.ok) cadenceScheduled = schedule.plan || {}
      else if (schedule.error === 'migration_pending') {
        console.warn('[tally-direct-drop] email_schedules migration pending — cadence not scheduled')
      }
    } catch (e) {
      console.warn('[tally-direct-drop] cadence schedule failed (non-fatal):', e?.message || e)
    }

    // Notify the platform owner (fire-and-forget — never blocks)
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const previewUrl = `${baseUrl}/admin/drops/${inserted.id}/preview`
    const ownerEmail = process.env.PLATFORM_OWNER_EMAIL
    if (ownerEmail) {
      try {
        await sendDraftDropReview({
          launch: inserted,
          vendorName: vendorName || vendorEmail,
          vendorEmail: vendorEmail || '—',
          previewUrl,
          to: ownerEmail,
        })
      } catch (e) {
        console.warn('[tally-direct-drop] owner email failed (non-fatal):', e?.message || e)
      }
    } else {
      console.warn('[tally-direct-drop] PLATFORM_OWNER_EMAIL not set; skipping notification')
    }

    return NextResponse.json({
      ok: true,
      launch: { id: inserted.id, handle: inserted.handle, status: inserted.status },
      preview_url: previewUrl,
      placeholder: !!verify.placeholder || !isSecretConfigured(),
      creator_matched: !!creatorId,
      products: { source: productsSource, inserted: productsInserted },
      subscribers: { source: subscribersSource, inserted: subscribersIngested },
      lifecycle: cadenceScheduled,
    })
  } catch (e) {
    console.error('[tally-direct-drop] unexpected:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}

// Healthcheck for Tally's webhook connection test step
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'tally-direct-drop',
    secret_configured: isSecretConfigured(),
    owner_email_configured: !!process.env.PLATFORM_OWNER_EMAIL,
  })
}
