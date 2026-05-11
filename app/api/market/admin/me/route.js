import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'

// GET /api/market/admin/me — returns the role for a valid token, used by the
// admin layout to greet the user and gate UI.
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  return NextResponse.json({ role: a.role })
}
