import { NextResponse } from 'next/server'
import { passwordToRole, issueAdminToken, isAdminSecretConfigured } from '@/lib/markets/admin-auth'

// POST /api/market/admin/login  body: { password }
// Returns: { token, role } or 401
export async function POST(request) {
  try {
    if (!isAdminSecretConfigured()) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
    }
    const { password } = await request.json().catch(() => ({}))
    const role = passwordToRole(password)
    if (!role) return NextResponse.json({ error: 'invalid password' }, { status: 401 })
    const token = issueAdminToken(role)
    return NextResponse.json({ ok: true, token, role })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
