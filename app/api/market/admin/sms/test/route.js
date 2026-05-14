// POST /api/market/admin/sms/test  (admin only)
// Body: { to: "+1...", body: "Test message" }
//
// Helper to verify the Twilio integration is wired up from the admin UI.
// Allowed for both platform and organiser roles.

import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { notifyGeneric, channelStatus } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const role = requireAdminRole(request)
  if (!role.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true, status: channelStatus() })
}

export async function POST(request) {
  const role = requireAdminRole(request)
  if (!role.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const to = body?.to
  const text = body?.body || 'Dropvine Markets — Twilio SMS test ✓'
  if (!to) return NextResponse.json({ error: 'missing `to` phone' }, { status: 400 })

  const results = await notifyGeneric({ to, body: text }, ['sms'])
  const r = (results || [])[0] || {}
  if (r.error) return NextResponse.json({ ok: false, ...r }, { status: 502 })
  if (r.skipped) return NextResponse.json({ ok: false, skipped: r.skipped }, { status: 200 })
  return NextResponse.json({ ok: true, sid: r.sid })
}
