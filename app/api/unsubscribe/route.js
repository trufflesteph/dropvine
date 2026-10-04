// POST /api/unsubscribe
//
// Called by the buttons on /unsubscribe. Records a suppression for the
// signed token's email.
//
// Body: { t: token, scope: 'vendor' | 'all' }
//   vendor — stop emails from the vendor in the token (vendor_id = creator_id)
//   all    — stop all Dropvine marketing emails
// Returns { ok, scope }. Repeating a request is harmless.

import { NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'
import { recordSuppression } from '@/lib/email/suppressions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid json body' }, { status: 400 }) }

  const token = verifyUnsubscribeToken(body?.t)
  if (!token) return NextResponse.json({ ok: false, error: 'invalid link' }, { status: 400 })

  const scope = body?.scope
  if (scope !== 'vendor' && scope !== 'all') {
    return NextResponse.json({ ok: false, error: 'scope must be vendor or all' }, { status: 400 })
  }
  if (scope === 'vendor' && !token.vendorId) {
    return NextResponse.json({ ok: false, error: 'this link has no vendor' }, { status: 400 })
  }

  const result = await recordSuppression({ email: token.email, scope, vendorId: token.vendorId, source: 'link' })
  if (!result.ok) {
    console.error('[unsubscribe] record failed:', result.error)
    return NextResponse.json({ ok: false, error: 'could not unsubscribe, please try again' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, scope })
}
