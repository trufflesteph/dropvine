import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// POST /api/market/admin/submissions/[type]/[id]/[action]
// type: 'post' | 'product', action: 'approve' | 'reject'
export async function POST(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const { type, id, action } = params || {}
  if (!['post', 'product'].includes(type)) return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  const supa = getSupabaseAdmin()
  const table = type === 'post' ? 'post_submissions' : 'product_submissions'
  const status = action === 'approve' ? 'approved' : 'rejected'
  const { data, error } = await supa.from(table)
    .update({ status, processed_at: new Date().toISOString(), processed_by_role: a.role })
    .eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submission: data })
}
