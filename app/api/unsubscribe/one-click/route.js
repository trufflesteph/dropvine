// POST /api/unsubscribe/one-click?t={token}
//
// RFC 8058 one-click target named in every marketing email's
// List-Unsubscribe header. Mail apps POST here (body
// "List-Unsubscribe=One-Click", ignored) when the reader taps their own
// Unsubscribe button. Records a vendor-scope suppression immediately; a
// token without a vendor records scope 'all' instead.
//
// GET (someone opening the URL directly) changes nothing and redirects to
// the /unsubscribe page, which asks first.

import { NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'
import { recordSuppression } from '@/lib/email/suppressions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const token = verifyUnsubscribeToken(new URL(request.url).searchParams.get('t'))
  if (!token) return NextResponse.json({ ok: false, error: 'invalid link' }, { status: 400 })

  const scope = token.vendorId ? 'vendor' : 'all'
  const result = await recordSuppression({ email: token.email, scope, vendorId: token.vendorId, source: 'one_click' })
  if (!result.ok) {
    console.error('[unsubscribe/one-click] record failed:', result.error)
    return NextResponse.json({ ok: false, error: 'could not unsubscribe' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, scope })
}

export async function GET(request) {
  const t = new URL(request.url).searchParams.get('t') || ''
  return NextResponse.redirect(new URL(`/unsubscribe?t=${encodeURIComponent(t)}`, request.url), { status: 303 })
}
