import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { store, uuidv4 } from '@/lib/mock-store'
import { getSupabaseServer, getSupabaseAdmin, getServerSupabaseConfig } from '@/lib/supabase/server'
import { notifyWaitlistConfirmed } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_API_KEY || 'sk_test_emergent', { apiVersion: '2024-06-20' })

const json = (data, init = {}) => NextResponse.json(data, init)
const err = (msg, status = 400) => NextResponse.json({ error: msg }, { status })

async function getLaunch(id) {
  const sb = getSupabaseAdmin() || getSupabaseServer()
  if (sb) {
    const { data } = await sb.from('drops').select('*').eq('id', id).maybeSingle()
    return data
  }
  return store.drops.get(id) || null
}

async function insertReservation(row) {
  const sb = getSupabaseAdmin()
  if (sb) {
    const id = uuidv4()
    const full = { id, ...row }
    const { error } = await sb.from('reservations').insert(full)
    if (error) throw new Error(error.message)
    return { ...full, created_at: new Date().toISOString() }
  }
  if (getServerSupabaseConfig().configured) {
    // Real Supabase configured but no admin key — should never happen if .env is set right
    throw new Error('Supabase admin client unavailable; SUPABASE_SERVICE_ROLE_KEY not set')
  }
  const full = { id: uuidv4(), created_at: new Date().toISOString(), ...row }
  store.reservations.push(full)
  return full
}

async function getReservationBySession(sessionId) {
  const sb = getSupabaseAdmin()
  if (sb) {
    const { data } = await sb.from('reservations').select('*').eq('stripe_session_id', sessionId).maybeSingle()
    return data
  }
  return store.reservations.find(x => x.stripe_session_id === sessionId) || null
}

async function updateReservationStatusIfPending(sessionId, newStatus) {
  const sb = getSupabaseAdmin()
  if (sb) {
    const existing = await getReservationBySession(sessionId)
    if (!existing || existing.status !== 'pending') return existing
    const { data } = await sb.from('reservations').update({ status: newStatus }).eq('stripe_session_id', sessionId).select().maybeSingle()
    return data
  }
  const r = store.reservations.find(x => x.stripe_session_id === sessionId)
  if (!r) return null
  if (r.status !== 'pending') return r
  r.status = newStatus
  return r
}

function getUserIdFromHeaders(req) {
  // For mock mode: client passes X-User-Id header (we don't enforce real auth in mock)
  return req.headers.get('x-user-id') || null
}

async function getCurrentUserId(req) {
  const { configured } = getServerSupabaseConfig()
  if (configured) {
    const sb = getSupabaseServer()
    if (sb) {
      const { data } = await sb.auth.getUser()
      return data?.user?.id || null
    }
  }
  return getUserIdFromHeaders(req)
}

export async function GET(request, { params }) {
  const path = (params?.path || []).join('/')
  const url = new URL(request.url)

  // GET /api/drops?creator=me  -> list current user's drops
  if (path === 'drops') {
    const creatorMe = url.searchParams.get('creator') === 'me'
    const userId = await getCurrentUserId(request)
    const sb = getSupabaseServer()
    if (sb) {
      let q = sb.from('drops').select('*').order('created_at', { ascending: false })
      if (creatorMe && userId) q = q.eq('creator_id', userId)
      const { data, error } = await q
      if (error) return err(error.message, 500)
      return json({ drops: data || [] })
    }
    const all = Array.from(store.drops.values()).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    const filtered = creatorMe && userId ? all.filter(l => l.creator_id === userId) : all
    return json({ drops: filtered })
  }

  // GET /api/launches/by-handle/[handle]
  // Hides drafts from the public — only published / live-bound drops are returned.
  // Also resolves the multi-product catalogue (drop_products) when present.
  // Falls back gracefully if the table hasn't been migrated yet.
  //
  // `?preview=true` lets a draft through AND attaches the active publish_token
  // (the vendor's email link includes ?preview=true → they can review the page
  // before clicking Publish/Schedule).
  if (path.startsWith('drops/by-handle/')) {
    const handle = path.replace('drops/by-handle/', '')
    const preview = url.searchParams.get('preview') === 'true'
    // Use admin client for preview mode to bypass RLS (drafts are not public)
    const sb = preview ? getSupabaseAdmin() : getSupabaseServer()
    if (sb) {
      const { data, error } = await sb.from('drops').select('*').eq('handle', handle).maybeSingle()
      if (error) return err(error.message, 500)
      if (!data) return err('not found', 404)
      if (data.status === 'draft' && !preview) return err('not found', 404)
      // Phase C: hide auto-archived (free-tier 5-day-after-close) drops from
      // the public. The vendor's own preview mode still sees them.
      if (data.status === 'archived' && !preview) return err('not found', 404)
      // Phase C: resolve the vendor's plan_tier so the UI can hide the
      // "Powered by Dropvine" watermark for Shop-tier creators.
      // Also (June 2026 directory update) pull category + location from
      // direct_vendors so the drop page can surface a category pill +
      // "City, State" line under the headline.
      let creatorPlanTier = 'free'
      let vendorCategory = null
      let vendorLocationCity = null
      let vendorLocationState = null
      let vendorBusinessName = null
      let vendorSlug = null
      if (data.creator_id) {
        try {
          const { data: prof } = await sb
            .from('profiles')
            .select('plan_tier')
            .eq('id', data.creator_id)
            .maybeSingle()
          if (prof?.plan_tier) creatorPlanTier = prof.plan_tier
        } catch {}
        try {
          const { data: dv } = await sb
            .from('direct_vendors')
            .select('slug, business_name, category, location_city, location_state')
            .eq('creator_id', data.creator_id)
            .maybeSingle()
          if (dv) {
            vendorCategory = dv.category || null
            vendorLocationCity = dv.location_city || null
            vendorLocationState = dv.location_state || null
            vendorBusinessName = dv.business_name || null
            vendorSlug = dv.slug || null
          }
        } catch {}
      }
      // Resolve products (best-effort — empty list ⇒ legacy single-price UI).
      let products = []
      try {
        const { data: prods, error: pErr } = await sb
          .from('drop_products')
          .select('id, name, description, price_cents, quantity, photo_url, sort_order')
          .eq('drop_id', data.id)
          .order('sort_order', { ascending: true })
        if (!pErr && Array.isArray(prods)) products = prods
      } catch {}
      // Attach the active publish_token (only relevant for drafts in preview).
      // Skipped silently if the table doesn't exist yet.
      let publishToken = null
      if (data.status === 'draft' && preview) {
        try {
          const { data: tok } = await sb
            .from('publish_tokens')
            .select('token, publish_action, expires_at, used_at')
            .eq('drop_id', data.id)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (tok) publishToken = tok
        } catch {}
      }
      return json({ drop: {
        ...data,
        creator_plan_tier: creatorPlanTier,
        vendor_category: vendorCategory,
        vendor_location_city: vendorLocationCity,
        vendor_location_state: vendorLocationState,
        vendor_business_name: vendorBusinessName,
        vendor_slug: vendorSlug,
      }, products, publish_token: publishToken })
    }
    const found = Array.from(store.drops.values()).find(l => l.handle === handle)
    if (!found) return err('not found', 404)
    if (found.status === 'draft' && !preview) return err('not found', 404)
    if (found.status === 'archived' && !preview) return err('not found', 404)
    return json({ drop: { ...found, creator_plan_tier: 'free', vendor_category: null, vendor_location_city: null, vendor_location_state: null, vendor_business_name: null, vendor_slug: null }, products: [], publish_token: null })
  }

  // GET /api/launches/[id]/reservations  (creator-scoped via RLS)
  if (path.match(/^drops\/[^/]+\/reservations$/)) {
    const id = path.split('/')[1]
    const sb = getSupabaseServer()
    if (sb) {
      // RLS ensures only the drop's creator can read these rows
      const { data, error } = await sb
        .from('reservations')
        .select('id,email,amount_cents,status,stripe_session_id,created_at,drop_id')
        .eq('drop_id', id)
        .order('created_at', { ascending: false })
      if (error) return err(error.message, 500)
      return json({ reservations: data || [] })
    }
    // Mock-mode fallback
    const userId = await getCurrentUserId(request)
    const drop = store.drops.get(id)
    if (!drop || drop.creator_id !== userId) return err('forbidden', 403)
    const reservations = store.reservations.filter(r => r.drop_id === id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    return json({ reservations })
  }

  // GET /api/launches/[id]/waitlist
  if (path.match(/^drops\/[^/]+\/waitlist$/)) {
    const id = path.split('/')[1]
    const sb = getSupabaseServer()
    if (sb) {
      const { data, error } = await sb.from('waitlist_entries').select('*').eq('drop_id', id).order('created_at', { ascending: false })
      if (error) return err(error.message, 500)
      return json({ entries: data || [], count: (data || []).length })
    }
    const entries = store.waitlist.filter(w => w.drop_id === id)
    return json({ entries, count: entries.length })
  }

  // GET /api/payments/checkout/status/[session_id]
  if (path.startsWith('payments/checkout/status/')) {
    const sessionId = path.replace('payments/checkout/status/', '')
    if (!sessionId) return err('session_id required')
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      // Update reservation if paid (idempotent)
      if (session.payment_status === 'paid') {
        await updateReservationStatusIfPending(sessionId, 'held')
      } else if (session.status === 'expired') {
        await updateReservationStatusIfPending(sessionId, 'cancelled')
      }
      const reservation = await getReservationBySession(sessionId)
      return json({
        status: session.status,                  // open | complete | expired
        payment_status: session.payment_status,  // unpaid | paid | no_payment_required
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata || {},
        reservation,
      })
    } catch (e) {
      return err(e.message || 'stripe error', 500)
    }
  }

  return err('not found', 404)
}

export async function POST(request, { params }) {
  const path = (params?.path || []).join('/')
  const body = await request.json().catch(() => ({}))

  // Mock auth (only used when Supabase isn't configured)
  if (path === 'auth/mock-signup') {
    const { email, password, display_name } = body
    if (!email || !password) return err('email & password required')
    if (store.users.has(email)) return err('email already registered', 409)
    const u = { id: uuidv4(), email, password, display_name: display_name || email.split('@')[0] }
    store.users.set(email, u)
    return json({ id: u.id, email: u.email, display_name: u.display_name })
  }
  if (path === 'auth/mock-signin') {
    const { email, password } = body
    const u = store.users.get(email)
    if (!u || u.password !== password) return err('invalid credentials', 401)
    return json({ id: u.id, email: u.email, display_name: u.display_name })
  }

  // POST /api/drops  -> create drop
  if (path === 'drops') {
    const userId = await getCurrentUserId(request)
    if (!userId) return err('not authenticated', 401)
    const required = ['handle', 'title', 'launch_at']
    for (const f of required) if (!body[f]) return err(`${f} required`)
    const sb = getSupabaseServer()
    const drop = {
      creator_id: userId,
      handle: String(body.handle).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      title: body.title,
      tagline: body.tagline || '',
      description: body.description || '',
      cover_url: body.cover_url || '',
      launch_at: body.launch_at,
      price_cents: Number(body.price_cents) || 0,
      reservation_enabled: !!body.reservation_enabled,
      reservation_hold_cents: Number(body.reservation_hold_cents) || 0,
      status: body.status || 'published',
    }
    // capacity is optional and may not exist as a column yet (graceful migration)
    if (body.capacity != null && body.capacity !== '' && !isNaN(Number(body.capacity))) {
      drop.capacity = Number(body.capacity)
    }
    if (sb) {
      const { data, error } = await sb.from('drops').insert(drop).select().single()
      if (error) return err(error.message, 500)
      return json({ drop: data })
    }
    const id = uuidv4()
    const created_at = new Date().toISOString()
    const full = { id, created_at, ...drop }
    if (Array.from(store.drops.values()).some(l => l.handle === drop.handle)) return err('handle taken', 409)
    store.drops.set(id, full)
    return json({ drop: full })
  }

  // POST /api/launches/[id]/waitlist  -> join waitlist
  if (path.match(/^drops\/[^/]+\/waitlist$/)) {
    const id = path.split('/')[1]
    const { email, name } = body
    if (!email) return err('email required')
    const drop = await getLaunch(id)
    if (!drop) return err('drop not found', 404)
    const sb = getSupabaseServer()
    const baseUrl = new URL(request.url).origin
    if (sb) {
      // No .select() — anon visitors can't read back their own row (RLS), but the insert still commits.
      const { error: insertError } = await sb.from('waitlist_entries').insert({ drop_id: id, email, name })
      if (insertError) {
        if (String(insertError.code) === '23505') return json({ ok: true, dedup: true })
        return err(insertError.message, 500)
      }
      // Fire-and-forget email
      notifyWaitlistConfirmed({ drop, entry: { email, name }, baseUrl }).catch(() => {})
      return json({ ok: true })
    }
    if (store.waitlist.find(w => w.drop_id === id && w.email === email)) return json({ ok: true, dedup: true })
    const entry = { id: uuidv4(), drop_id: id, email, name: name || '', created_at: new Date().toISOString() }
    store.waitlist.push(entry)
    notifyWaitlistConfirmed({ drop, entry, baseUrl }).catch(() => {})
    return json({ entry })
  }

  // POST /api/launches/[id]/reserve  -> Real Stripe Checkout Session
  // body: { email, origin_url }
  if (path.match(/^drops\/[^/]+\/reserve$/)) {
    const id = path.split('/')[1]
    const { email, origin_url } = body
    if (!email) return err('email required')
    if (!origin_url) return err('origin_url required')

    const drop = await getLaunch(id)
    if (!drop) return err('drop not found', 404)
    if (!drop.reservation_enabled) return err('reservations not enabled for this drop', 400)
    const amountCents = Number(drop.reservation_hold_cents) || 0
    if (amountCents < 50) return err('reservation amount too low', 400)

    // Build URLs from frontend's origin (never hardcode)
    const success_url = `${origin_url}/l/${drop.handle}?session_id={CHECKOUT_SESSION_ID}`
    const cancel_url = `${origin_url}/l/${drop.handle}?cancelled=1`

    let session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Reservation hold — ${drop.title}`,
              description: `Refundable hold to reserve your slot for ${drop.title}.`,
            },
            unit_amount: amountCents, // server-defined, never trust client
          },
          quantity: 1,
        }],
        customer_email: email,
        success_url,
        cancel_url,
        metadata: {
          drop_id: String(drop.id),
          drop_handle: drop.handle,
          email,
          source: 'dropvine_reservation',
        },
      })
    } catch (e) {
      console.error('[stripe] create session failed:', e.message)
      return err('stripe error: ' + e.message, 500)
    }

    // Persist reservation BEFORE redirecting (mandatory per playbook)
    const reservation = await insertReservation({
      drop_id: drop.id,
      email,
      amount_cents: amountCents,
      stripe_session_id: session.id,
      status: 'pending',
    })

    return json({ url: session.url, session_id: session.id, reservation })
  }

  return err('not found', 404)
}
