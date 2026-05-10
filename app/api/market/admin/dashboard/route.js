import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/admin/dashboard — counts + recent activity
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const [vendorCount, activeVendorCount, productsCount, ordersCount, pendingPaymentCount, fulfilledCount, postSubsCount, productSubsCount, recentOrdersRes, marketRes] = await Promise.all([
    supa.from('vendors').select('id', { count: 'exact', head: true }),
    supa.from('vendors').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supa.from('products').select('id', { count: 'exact', head: true }),
    supa.from('orders').select('id', { count: 'exact', head: true }),
    supa.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_payment'),
    supa.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'fulfilled'),
    supa.from('post_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supa.from('product_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supa.from('orders').select('id, short_code, status, total_cents, shopper_email, created_at, vendors:vendor_id(name)').order('created_at', { ascending: false }).limit(8),
    supa.from('market_config').select('id, name, season').eq('is_active', true).maybeSingle(),
  ])

  return NextResponse.json({
    role: a.role,
    market: marketRes.data || null,
    counts: {
      vendors_total: vendorCount.count || 0,
      vendors_active: activeVendorCount.count || 0,
      products_total: productsCount.count || 0,
      orders_total: ordersCount.count || 0,
      orders_pending_payment: pendingPaymentCount.count || 0,
      orders_fulfilled: fulfilledCount.count || 0,
      submissions_pending: (postSubsCount.count || 0) + (productSubsCount.count || 0),
    },
    recent_orders: recentOrdersRes.data || [],
  })
}
