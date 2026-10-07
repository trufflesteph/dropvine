import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/market/admin/direct/trials
// Vendors with a trial_ends_at (active or ended), soonest end first, with the
// linked creator's email. Signup date = direct_vendors.created_at (the row is
// created by the signup trigger).
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data: vendors, error } = await supa.from('direct_vendors')
    .select('id, business_name, creator_id, created_at, trial_ends_at')
    .not('trial_ends_at', 'is', null)
    .order('trial_ends_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const creatorIds = Array.from(new Set((vendors || []).map((v) => v.creator_id).filter(Boolean)))
  let emailMap = new Map()
  if (creatorIds.length) {
    const { data: profiles } = await supa.from('profiles')
      .select('id, email').in('id', creatorIds)
    emailMap = new Map((profiles || []).map((p) => [p.id, p.email]))
  }
  const trials = (vendors || []).map(({ creator_id, ...v }) => ({ ...v, email: emailMap.get(creator_id) || null }))
  return NextResponse.json({ trials })
}
