// GET / PATCH /api/market/profile/notifications
//
// Lets a signed-in shopper view and update their SMS opt-in + phone number.
// Used by /market/profile UI. Phone is normalised before write.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalisePhone(raw) {
  if (!raw) return null
  const cleaned = String(raw).replace(/[^\d+]/g, '')
  if (!cleaned) return null
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.length === 10) return `+1${cleaned}`
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`
  return `+${cleaned}`
}

function isValidPhone(p) {
  if (!p) return false
  // E.164: '+' followed by 8–15 digits (most carriers accept 10–15)
  return /^\+\d{8,15}$/.test(p)
}

async function getUser() {
  const sb = getSupabaseServer()
  if (!sb) return null
  try {
    const { data } = await sb.auth.getUser()
    return data?.user || null
  } catch { return null }
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase admin not configured' }, { status: 500 })

  const { data, error } = await supa.from('shopper_profiles')
    .select('id, phone, sms_opt_in, notification_opt_in').eq('id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    profile: data || { id: user.id, phone: null, sms_opt_in: false, notification_opt_in: true },
  })
}

export async function PATCH(request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase admin not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const update = {}

  if ('phone' in body) {
    if (body.phone === null || body.phone === '') {
      update.phone = null
    } else {
      const phone = normalisePhone(body.phone)
      if (!isValidPhone(phone)) {
        return NextResponse.json({ error: 'invalid phone (use E.164, e.g. +14155551234)' }, { status: 400 })
      }
      update.phone = phone
    }
  }
  if ('sms_opt_in' in body) update.sms_opt_in = !!body.sms_opt_in

  // Guard: cannot opt-in without a phone on file (post-update).
  if (update.sms_opt_in === true) {
    const phoneAfter = 'phone' in update
      ? update.phone
      : (await supa.from('shopper_profiles').select('phone').eq('id', user.id).maybeSingle()).data?.phone
    if (!phoneAfter) {
      return NextResponse.json({ error: 'add a phone number before enabling SMS' }, { status: 400 })
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 })
  }
  update.updated_at = new Date().toISOString()

  // Upsert (profile row may not exist yet on a brand-new account).
  const { data: existing } = await supa.from('shopper_profiles')
    .select('id').eq('id', user.id).maybeSingle()

  let row
  if (existing) {
    const { data, error } = await supa.from('shopper_profiles')
      .update(update).eq('id', user.id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    row = data
  } else {
    const { data, error } = await supa.from('shopper_profiles')
      .insert({ id: user.id, email: user.email, ...update }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    row = data
  }

  return NextResponse.json({ ok: true, profile: row })
}
