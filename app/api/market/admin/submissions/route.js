import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/admin/submissions — list pending submissions (posts + products combined)
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'pending'
  const supa = getSupabaseAdmin()
  const [postsRes, productsRes] = await Promise.all([
    supa.from('post_submissions').select('*, vendors:vendor_id(name, slug)').eq('status', status).order('created_at', { ascending: false }).limit(50),
    supa.from('product_submissions').select('*, vendors:vendor_id(name, slug)').eq('status', status).order('created_at', { ascending: false }).limit(50),
  ])
  return NextResponse.json({
    posts: postsRes.data || [],
    products: productsRes.data || [],
  })
}
