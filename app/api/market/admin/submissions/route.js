import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/admin/submissions?status=pending — list submissions (posts + products combined)
//
// We do the vendor lookup as a separate step rather than as a Supabase embed
// because rows where vendor_id is NULL (Tally submissions that we couldn't
// auto-match to an existing vendor by email) can disappear with the embed
// syntax depending on PostgREST FK introspection.
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'pending'
  const supa = getSupabaseAdmin()

  const [postsRes, productsRes] = await Promise.all([
    supa.from('post_submissions').select('*').eq('status', status).order('created_at', { ascending: false }).limit(50),
    supa.from('product_submissions').select('*').eq('status', status).order('created_at', { ascending: false }).limit(50),
  ])

  const posts = postsRes.data || []
  const products = productsRes.data || []
  const vendorIds = Array.from(new Set([
    ...posts.map((p) => p.vendor_id).filter(Boolean),
    ...products.map((p) => p.vendor_id).filter(Boolean),
  ]))

  let vendorMap = new Map()
  if (vendorIds.length) {
    const { data: vs } = await supa.from('vendors').select('id, name, slug').in('id', vendorIds)
    vendorMap = new Map((vs || []).map((v) => [v.id, v]))
  }

  const enrich = (row) => ({ ...row, vendors: row.vendor_id ? (vendorMap.get(row.vendor_id) || null) : null })

  return NextResponse.json({
    posts: posts.map(enrich),
    products: products.map(enrich),
    errors: {
      posts: postsRes.error?.message || null,
      products: productsRes.error?.message || null,
    },
  })
}
