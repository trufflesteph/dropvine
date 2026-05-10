import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/vendors/[slug]
export async function GET(_request, { params }) {
  try {
    const slug = params?.slug
    if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 })
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase_not_configured' }, { status: 500 })

    const { data: vendor, error } = await supa
      .from('vendors')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!vendor) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const [productsRes, postsRes] = await Promise.all([
      supa.from('products').select('*').eq('vendor_id', vendor.id).eq('is_available', true).order('display_order'),
      supa.from('vendor_posts').select('*').eq('vendor_id', vendor.id).eq('is_published', true).order('posted_at', { ascending: false }).limit(10),
    ])

    return NextResponse.json({
      vendor,
      products: productsRes.data || [],
      posts: postsRes.data || [],
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
