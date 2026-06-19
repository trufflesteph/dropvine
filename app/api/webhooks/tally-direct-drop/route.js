// Tally webhook for Dropvine DIRECT drop submissions.
//
// A vendor fills out a Tally form, Tally POSTs the response here, we extract
// the product fields, look up the creator via vendor_email, generate a unique
// handle, insert a DRAFT row into `drops`, and email the platform owner a
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
import {
  getTallyText,
  getTallyNumber,
  getTallyFiles,
  getTallyOptionLabel,
  normaliseCollectionMode,
} from '@/lib/markets/tally'
import { extractLaunchProducts } from '@/lib/markets/tally-products'
import { extractLaunchSubscribers, ingestLaunchSubscribers } from '@/lib/drop-lifecycle/contacts'
import { scheduleDropLifecycle } from '@/lib/drop-lifecycle/cadence'
import { sendDraftDropReview, sendDropSubmissionConfirmation } from '@/lib/email/notifications'
import { proxyTallyImages } from '@/lib/markets/tally-images'

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
    const { data } = await supa.from('drops').select('id').eq('handle', candidate).maybeSingle()
    if (!data) return candidate
  }
  return `${root}-${randomSuffix(8)}`
}

function extractFirstUrl(arr) {
  if (!Array.isArray(arr) || !arr.length) return null
  const first = arr[0]
  return first?.url || null
}

// Round 2 helpers for the Tally date+time pair fields.
// "Open on" / "Drop closes on" are date-only; "Open at" / "Drop closes at"
// are time-only. We combine them into a single UTC ISO timestamp.
//
//   combineDateTime('2026-07-04', '18:00')    -> '2026-07-04T18:00:00.000Z'
//   combineDateTime('2026-07-04', null)       -> '2026-07-04T23:59:59.000Z'  (default end of day)
//   combineDateTime(null, '18:00')            -> null
//   combineDateTime(null, null)               -> null
function tryDate(s) {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null
  // Strip any time portion the date field accidentally carries.
  const datePart = String(dateStr).trim().slice(0, 10) // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    // Try parsing as a full datetime instead.
    const d = tryDate(dateStr)
    return d || null
  }
  let time = '23:59:59' // default to end-of-day if no time given
  if (timeStr) {
    const t = String(timeStr).trim()
    // Accept "18:00", "18:00:00", "6:00 PM", "6 PM". Normalise to 24h.
    const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
    if (ampm) {
      let h = parseInt(ampm[1], 10)
      const m = ampm[2] ? parseInt(ampm[2], 10) : 0
      const isPm = ampm[3].toUpperCase() === 'PM'
      if (isPm && h < 12) h += 12
      if (!isPm && h === 12) h = 0
      time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
      const parts = t.split(':').map((x) => x.padStart(2, '0'))
      while (parts.length < 3) parts.push('00')
      time = parts.join(':')
    }
  }
  const d = new Date(`${datePart}T${time}Z`)
  return Number.isNaN(d.getTime()) ? null : d
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

    // DIAGNOSTIC — log the full raw payload so we can find where (if anywhere)
    // the ?token=... URL param appears. Check Vercel function logs for
    // "[tally-direct-drop] FULL PAYLOAD:" and scan the output for the token
    // value, formUrl, respondentUrl, redirectUrl, referrer, or any key that
    // carries the original query string.
    try {
      // Also capture request headers that might carry the referrer/origin.
      const headerDump = {}
      for (const [k, v] of request.headers.entries()) {
        headerDump[k] = v
      }
      console.log('[tally-direct-drop] FULL PAYLOAD:', JSON.stringify(body))
      console.log('[tally-direct-drop] REQUEST HEADERS:', JSON.stringify(headerDump))
    } catch (e) {
      console.warn('[tally-direct-drop] full payload dump failed:', e?.message || e)
    }

    const fields = body?.data?.fields || []

    // Verbose field dump — labels, types, values, options.
    try {
      const dump = fields.map((f) => ({
        label: f?.label,
        type: f?.type,
        value: f?.value,
        options: Array.isArray(f?.options) ? f.options.map((o) => ({ id: o?.id, text: o?.text ?? o?.label })) : undefined,
      }))
      console.log('[tally-direct-drop] FIELDS:', JSON.stringify(dump))
    } catch (e) {
      console.warn('[tally-direct-drop] field dump failed:', e?.message || e)
    }

    // Extract every field. Labels are tolerant — we match by substring.
    // Round 2 — substring matchers updated to align with the live
    // tally.so/r/VLbkW6 form (labels supplied by the platform owner):
    //   Drop Title, Drop Subtitle/Tagline, When should your drop open?,
    //   Open on, Open at, Drop closes on, Drop closes at, Fulfillment Details,
    //   Collection Mode, Venmo Handle, Display Photo, token.
    // Token is echoed back from the hidden Tally field populated via ?token=...
    const token = (getTallyText(fields, 'token') || '').trim() || null
    console.log('[tally-direct-drop] token field value:', token ? token.slice(0, 16) + '…' : null)
    // Drop Title — check `drop title` first, otherwise fall through to the
    // legacy substring matchers. The old order matched `product name` first
    // which was hitting per-product fields in manual-upload mode.
    const productName = getTallyText(fields, 'drop title')
      || getTallyText(fields, 'title')
      || getTallyText(fields, 'product name')
      || 'Untitled drop'
    // Tagline → Drop Subtitle/Tagline
    const tagline = getTallyText(fields, 'subtitle/tagline')
      || getTallyText(fields, 'subtitle')
      || getTallyText(fields, 'tagline')
      || null
    // Description → "Drop Description" (current form field name), then
    // legacy fallbacks for older form revisions. NOTE: "Fulfillment Details"
    // is a SEPARATE Tally question (captured into pickupDetails below) — it
    // must not be folded in here, or its answer gets silently discarded
    // whenever a "Drop Description" answer is also present.
    const description = getTallyText(fields, 'drop description')
      || getTallyText(fields, 'about this drop')
      || getTallyText(fields, 'description')
      || null
    const priceCents = (() => {
      const dollars = getTallyNumber(fields, 'price')
      if (dollars == null) return 0
      return dollars >= 1000 ? Math.round(dollars) : Math.round(dollars * 100)
    })()
    const capacity = getTallyNumber(fields, 'quantity available')
      || getTallyNumber(fields, 'capacity')
      || getTallyNumber(fields, 'quantity')
      || null
    // Open mode — Tally form label is "When should your drop open?".
    const openModeRaw = getTallyOptionLabel(fields, 'when should your drop open')
      || getTallyOptionLabel(fields, 'when should')
      || getTallyOptionLabel(fields, 'open mode')
      || getTallyText(fields, 'when should your drop open')
      || getTallyText(fields, 'open mode')
      || 'now'
    const openMode = String(openModeRaw || 'now').toLowerCase()
    // Open on (date) + Open at (time) — combine to a single ISO timestamp.
    const openOnRaw = getTallyText(fields, 'open on')
    const openAtRaw = getTallyText(fields, 'open at')
    const countdownAt = combineDateTime(openOnRaw, openAtRaw)
      || tryDate(getTallyText(fields, 'countdown'))
      || tryDate(getTallyText(fields, 'specific date'))
      || tryDate(getTallyText(fields, 'launch date'))
    // Pickup / Fulfillment Details — the live form's question is labeled
    // "Fulfillment Details". This is what shoppers see verbatim under
    // "Pickup" in their order confirmation email, so it must land in its
    // own column rather than being absorbed into `description` above.
    const pickupDetails = getTallyText(fields, 'fulfillment details')
      || getTallyText(fields, 'fulfillment')
      || getTallyText(fields, 'pickup')
      || null
    const venmoHandle = (getTallyText(fields, 'venmo') || '').replace(/^@/, '').trim() || null
    // Collection mode — resolve option label and normalise to one of the
    // 4 canonical kebab-case values.
    const collectionModeRaw = getTallyOptionLabel(fields, 'collection mode')
      || getTallyOptionLabel(fields, 'collection')
      || getTallyText(fields, 'collection')
      || 'pre-order'
    const collectionMode = normaliseCollectionMode(collectionModeRaw)
    // Deposit Percentage — only meaningful when collection_mode is 'deposit'.
    // This is now the AUTHORITATIVE deposit calculation for deposit-mode
    // drops (page totals, Venmo amount, order creation, emails). Kept as a
    // separate column from reservation_hold_cents / drop_orders.deposit_cents
    // — those are untouched by this field.
    const depositPercentRaw = getTallyNumber(fields, 'deposit percentage')
    const depositPercent = (collectionMode === 'deposit' && depositPercentRaw != null)
      ? Math.max(0, Math.min(100, Math.round(depositPercentRaw)))
      : null
    // Display Photo is the form's single image upload field.
    // Primary: label-based matching.
    let coverFiles = getTallyFiles(fields, 'display photo')
      .concat(getTallyFiles(fields, 'cover'))
    // Fallback: if label matching found nothing, grab the first FILE_UPLOAD field
    // regardless of its label. Guards against label changes in the Tally form.
    if (!coverFiles.length) {
      const anyUpload = fields.find((f) => f?.type === 'FILE_UPLOAD' && f?.value != null)
      if (anyUpload) {
        const raw = Array.isArray(anyUpload.value) ? anyUpload.value : [anyUpload.value]
        coverFiles = raw
          .filter((x) => x && (x.url || x.uploadedUrl || x.uploaded_url))
          .map((x) => ({ url: x.url || x.uploadedUrl || x.uploaded_url, name: x.name || null, mimeType: x.mimeType || x.mime_type || null }))
      }
    }
    const galleryFiles = getTallyFiles(fields, 'photo').filter((f) => !coverFiles.some((c) => c.url === f.url))
    const coverUrl = extractFirstUrl(coverFiles) || extractFirstUrl(galleryFiles) || null
    const photoUrls = galleryFiles.map((f) => f.url).filter(Boolean)
    // Diagnostic: log image capture result. Check Vercel function logs after a
    // form submission to see whether files were found and which URL was captured.
    console.log('[tally-direct-drop] image capture:', {
      coverFiles: coverFiles.length,
      galleryFiles: galleryFiles.length,
      coverUrl: coverUrl ? coverUrl.slice(0, 60) + '…' : null,
      allFieldTypes: fields.map((f) => ({ label: f?.label, type: f?.type })),
    })

    // notify_at — when to fan-out to the waitlist via cron. The current
    // Tally form doesn't have a separate notify field, so we default to
    // launch_at below (Fix 6 R2).
    const notifyRaw = getTallyText(fields, 'notify')
      || getTallyText(fields, 'send notification')
      || getTallyText(fields, 'announce')
    let notifyAt = null
    if (notifyRaw) {
      const d = new Date(notifyRaw)
      if (!Number.isNaN(d.getTime())) notifyAt = d.toISOString()
    }

    // closes_at — combine "Drop closes on" (date) + "Drop closes at" (time)
    // into a single ISO timestamp. Round 2 Fix 5.
    const closeOnRaw = getTallyText(fields, 'drop closes on')
      || getTallyText(fields, 'closes on')
      || getTallyText(fields, 'close on')
      || getTallyText(fields, 'closes')
      || getTallyText(fields, 'close')
      || getTallyText(fields, 'order deadline')
      || getTallyText(fields, 'cutoff')
    const closeAtRaw = getTallyText(fields, 'drop closes at')
      || getTallyText(fields, 'closes at')
      || getTallyText(fields, 'close at')
    let closesAt = null
    const combinedClose = combineDateTime(closeOnRaw, closeAtRaw)
    if (combinedClose) {
      closesAt = combinedClose.toISOString()
    } else if (closeOnRaw) {
      // Fallback: parse the close-on string directly if it's already a full
      // datetime (Tally legacy single-field date pickers).
      const d = new Date(String(closeOnRaw).trim())
      if (!Number.isNaN(d.getTime())) closesAt = d.toISOString()
    }

    // publish_action — driven by the Tally "When should orders open?" field.
    //
    //   • "Immediately when published" → publish_action = 'publish'
    //     The vendor still has to click Publish in the email; the drop is
    //     created as a draft and goes live the moment they confirm.
    //
    //   • "At a specific date and time"  → publish_action = 'schedule'
    //     Launch is created as a draft; vendor confirms → status='scheduled';
    //     lifecycle cron auto-publishes when launch_at <= now.
    //
    // Fix 5 — "immediately" is the strongest signal. If the label parses to
    // 'immediately' we always use the publish path regardless of any stray
    // date strings; otherwise fall back to the previous heuristic.
    const now = new Date()
    const publishAction = (() => {
      const t = (openMode || '').toLowerCase()
      if (t.includes('immediately') || t.includes('right away') || t === 'now') return 'publish'
      if (t.includes('specific') || t.includes('date') || t.includes('schedule')) return 'schedule'
      // countdownAt is a Date instance (or null) — check it's in the future.
      if (countdownAt && countdownAt.getTime && countdownAt > now) {
        return 'schedule'
      }
      return 'publish'
    })()

    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

    // Look up the pending_submissions row by token — this is the canonical
    // way to identify the submitting vendor. No token = no drop.
    if (!token) {
      console.error('[tally-direct-drop] token missing — submission rejected')
      return NextResponse.json({ error: 'token missing' }, { status: 422 })
    }
    const { data: pendingRow, error: pendingErr } = await supa
      .from('pending_submissions')
      .select('id, vendor_id, vendor_email, business_name, expires_at, used_at')
      .eq('token', token)
      .maybeSingle()
    if (pendingErr) {
      console.error('[tally-direct-drop] pending_submissions lookup error:', pendingErr.message)
      return NextResponse.json({ error: pendingErr.message }, { status: 500 })
    }
    if (!pendingRow) {
      console.error('[tally-direct-drop] token not found — submission rejected', { token: token.slice(0, 16) })
      return NextResponse.json({ error: 'invalid or expired token' }, { status: 422 })
    }
    if (pendingRow.used_at) {
      console.error('[tally-direct-drop] token already used — submission rejected', { token: token.slice(0, 16) })
      return NextResponse.json({ error: 'token already used' }, { status: 422 })
    }
    if (new Date(pendingRow.expires_at) < new Date()) {
      console.error('[tally-direct-drop] token expired — submission rejected', { token: token.slice(0, 16), expires_at: pendingRow.expires_at })
      return NextResponse.json({ error: 'token expired' }, { status: 422 })
    }

    // Resolve creator_id from the vendor_id stored in the pending row.
    const { data: vendorRow } = await supa
      .from('direct_vendors')
      .select('creator_id')
      .eq('id', pendingRow.vendor_id)
      .maybeSingle()
    const creatorId = vendorRow?.creator_id || null
    if (!creatorId) {
      console.error('[tally-direct-drop] vendor not found for pending row — submission rejected', { vendor_id: pendingRow.vendor_id })
      return NextResponse.json({ error: 'vendor not found' }, { status: 422 })
    }
    const vendorEmail = pendingRow.vendor_email
    const vendorName = pendingRow.business_name || null

    // Decide launch_at
    // Round 2 — countdownAt is now a Date object (from combineDateTime) when
    // the schedule path is selected. publishAction='publish' → launch_at = now.
    let launchAt = now.toISOString()
    if (publishAction === 'schedule' && countdownAt && !Number.isNaN(countdownAt.getTime?.() ?? countdownAt.getTime())) {
      launchAt = countdownAt.toISOString()
    }

    // Round 2 Fix 6 — notify_at defaults to launchAt so the open fan-out
    // cron actually fires. The current Tally form has no separate notify
    // field, so this is the production default.
    if (!notifyAt) notifyAt = launchAt

    // Unique handle
    const handle = await makeUniqueHandle(supa, productName)

    // Insert. Only include columns we KNOW exist (Step 1 SQL must be run first).
    const insertPayload = {
      handle,
      title: productName,
      tagline,
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
      deposit_percent: depositPercent,
      // Scheduled notifications (2026-06-drops-notify-schedule.sql)
      notify_at: notifyAt,
      // Phase A lifecycle (2026-06-drop-lifecycle.sql)
      closes_at: closesAt,
    }

    let { data: inserted, error: insErr } = await supa.from('drops').insert(insertPayload).select('*').single()
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
        const retry = await supa.from('drops').insert(minimal).select('*').single()
        inserted = retry.data; insErr = retry.error
      }
    }
    if (insErr) {
      console.error('[tally-direct-drop] insert failed:', insErr.message)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    // Mark the submission token as consumed so it can't be replayed.
    supa.from('pending_submissions').update({ used_at: new Date().toISOString() }).eq('id', pendingRow.id)
      .then(({ error: uErr }) => { if (uErr) console.warn('[tally-direct-drop] used_at stamp failed (non-fatal):', uErr.message) })

    // === Multi-product seeding ===========================================
    // Two parsing modes (priority order):
    //   1. CSV/spreadsheet upload → parse rows into drop_products.
    //   2. Manual repeating fields (`product_1_name`, `product_1_price`, …).
    // If neither produced rows, the public /l/[handle] page falls back to the
    // existing single-product behaviour driven by drops.price_cents.
    //
    // Fix 2 — when products land via CSV or manual mode, also derive
    // drops.price_cents from the catalogue so the dashboard / Resend preview
    // emails don't show "$0.00". We use the MINIMUM positive price across
    // all products (matches how shoppers see "from $X" listings).
    let productsSource = 'none'
    let productsInserted = 0
    // Round 2 — keep a copy of the extracted product list so we can embed
    // them inline in the vendor submission confirmation email (Fix 15).
    let extractedProducts = []
    try {
      const { products, source } = await extractLaunchProducts(fields)
      productsSource = source
      extractedProducts = products || []
      if (products.length) {
        const payload = products.map((p, i) => ({
          drop_id: inserted.id,
          name: p.name,
          description: p.description,
          price_cents: p.price_cents,
          quantity: p.quantity,
          photo_url: p.photo_url,
          sort_order: typeof p.sort_order === 'number' ? p.sort_order : i,
        }))
        const { data: ins, error: pErr } = await supa.from('drop_products').insert(payload).select('id')
        if (pErr) {
          // Migration not run yet — log + continue. Admin can re-seed manually
          // from the Preview page once the table exists.
          if (/could not find the table|relation .* does not exist|schema cache/i.test(pErr.message)) {
            console.warn('[tally-direct-drop] drop_products table missing — run supabase/migrations/2026-06-multi-product.sql')
          } else {
            console.warn('[tally-direct-drop] drop_products insert failed (non-fatal):', pErr.message)
          }
        } else {
          productsInserted = ins?.length || 0
          // Derive drops.price_cents from the catalogue (Fix 2).
          const positivePrices = products
            .map((p) => Number(p.price_cents || 0))
            .filter((n) => Number.isFinite(n) && n > 0)
          if (positivePrices.length && (!priceCents || priceCents === 0)) {
            const minPrice = Math.min(...positivePrices)
            const { error: upErr } = await supa
              .from('drops')
              .update({ price_cents: minPrice })
              .eq('id', inserted.id)
            if (!upErr) inserted.price_cents = minPrice
          }
        }
      }
    } catch (e) {
      console.warn('[tally-direct-drop] product extraction failed (non-fatal):', e?.message || e)
    }

    // === Fix 3 — proxy Tally images into Supabase storage ===============
    // Tally hosts uploaded images behind short-lived JWTs. Re-host them in
    // the public `vendor-photos` bucket so the URLs survive after the
    // token expires. Best-effort: on failure we keep the original Tally
    // URL (which still works for the first few hours).
    try {
      let newCover = null
      let newPhotos = []
      if (coverFiles.length) {
        const out = await proxyTallyImages({ supa, dropId: inserted.id, prefix: 'cover', files: coverFiles })
        if (out.length) newCover = out[0]
      }
      if (galleryFiles.length) {
        newPhotos = await proxyTallyImages({ supa, dropId: inserted.id, prefix: 'photo', files: galleryFiles })
        // If no dedicated cover image was uploaded, promote the first gallery
        // shot to drops.cover_url so the public page still has a hero.
        if (!newCover && newPhotos.length) newCover = newPhotos[0]
      }
      console.log('[tally-direct-drop] image proxy result:', {
        newCover: newCover ? newCover.slice(0, 60) + '…' : null,
        newPhotos: newPhotos.length,
      })
      if (newCover || newPhotos.length) {
        const patch = {}
        if (newCover) patch.cover_url = newCover
        if (newPhotos.length) patch.photo_urls = newPhotos
        const { error: pErr } = await supa.from('drops').update(patch).eq('id', inserted.id)
        if (pErr) {
          console.warn('[tally-direct-drop] image URL patch failed (non-fatal):', pErr.message)
        } else {
          if (newCover) inserted.cover_url = newCover
          if (newPhotos.length) inserted.photo_urls = newPhotos
        }
      }
    } catch (e) {
      console.warn('[tally-direct-drop] image proxy crashed (non-fatal):', e?.message || e)
    }

    // === Phase A: contact list ingestion ================================
    // If a Tally CSV (label: contacts / audience / subscribers / mailing list)
    // OR a pasted email block is present, insert rows into drop_subscribers
    // for downstream fan-out by the lifecycle cron.
    let subscribersIngested = 0
    let subscribersSource = 'none'
    try {
      const { rows: subRows, source: subSource } = await extractLaunchSubscribers(fields)
      subscribersSource = subSource
      if (subRows.length) {
        const ingest = await ingestLaunchSubscribers({ supa, drop_id: inserted.id, rows: subRows })
        if (ingest.ok) subscribersIngested = ingest.inserted
        else if (ingest.error === 'migration_pending') {
          console.warn('[tally-direct-drop] drop_subscribers migration pending — contacts not persisted')
        }
      }
    } catch (e) {
      console.warn('[tally-direct-drop] contacts ingest failed (non-fatal):', e?.message || e)
    }

    // === Phase A: lifecycle email cadence ===============================
    // Pre-compute open / +5d / pre-close / close-summary rows in email_schedules.
    // Rows are inserted with hold=true so the lifecycle cron skips them until
    // the vendor confirms publish/schedule via /api/launches/publish/[token].
    let cadenceScheduled = null
    try {
      const schedule = await scheduleDropLifecycle({ supa, drop: inserted, hold: true })
      if (schedule.ok) cadenceScheduled = schedule.plan || {}
      else if (schedule.error === 'migration_pending') {
        console.warn('[tally-direct-drop] email_schedules migration pending — cadence not scheduled')
      }
    } catch (e) {
      console.warn('[tally-direct-drop] cadence schedule failed (non-fatal):', e?.message || e)
    }

    // === Draft → Preview → Publish flow =================================
    // Mint a one-shot publish_tokens row. The vendor receives the token URL
    // in the DropSubmissionConfirmation email and clicks it to flip the
    // drop from `draft` to `published` (or `scheduled`).
    let publishToken = null
    try {
      const { data: tok, error: tokErr } = await supa
        .from('publish_tokens')
        .insert({ drop_id: inserted.id, publish_action: publishAction })
        .select('token')
        .single()
      if (tokErr) {
        if (/could not find the table|relation .* does not exist|schema cache/i.test(tokErr.message)) {
          console.warn('[tally-direct-drop] publish_tokens table missing — run supabase/migrations/2026-06-publish-tokens-and-holds.sql')
        } else {
          console.warn('[tally-direct-drop] publish_tokens insert failed (non-fatal):', tokErr.message)
        }
      } else {
        publishToken = tok?.token || null
      }
    } catch (e) {
      console.warn('[tally-direct-drop] publish_tokens insert crashed (non-fatal):', e?.message || e)
    }

    // Notify the platform owner (fire-and-forget — never blocks)
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const previewUrl = `${baseUrl}/admin/drops/${inserted.id}/preview`
    const ownerEmail = process.env.PLATFORM_OWNER_EMAIL
    if (ownerEmail) {
      try {
        await sendDraftDropReview({
          drop: inserted,
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

    // Vendor-facing confirmation with preview + publish/schedule links.
    // Skipped silently if we couldn't mint a token (migration pending) or if
    // there's no vendor email to send to.
    if (publishToken && vendorEmail) {
      try {
        await sendDropSubmissionConfirmation({
          drop: inserted,
          vendorEmail,
          publishAction,
          token: publishToken,
          baseUrl,
          // Round 2 Fix 15 — pass the parsed catalogue + description so
          // the email itemises the drop instead of showing just title + price.
          products: extractedProducts,
          description,
        })
      } catch (e) {
        console.warn('[tally-direct-drop] vendor confirmation failed (non-fatal):', e?.message || e)
      }
    }

    return NextResponse.json({
      ok: true,
      drop: { id: inserted.id, handle: inserted.handle, status: inserted.status },
      preview_url: previewUrl,
      // Public vendor-facing preview URL (?preview=true gate).
      vendor_preview_url: `${baseUrl}/l/${inserted.handle}?preview=true`,
      placeholder: !!verify.placeholder || !isSecretConfigured(),
      creator_matched: !!creatorId,
      products: { source: productsSource, inserted: productsInserted },
      subscribers: { source: subscribersSource, inserted: subscribersIngested },
      lifecycle: cadenceScheduled,
      publish: { action: publishAction, token_issued: !!publishToken },
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
