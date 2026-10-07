// Demo drops: platform-seeded example drops shown on the homepage.
//
// A drop is a demo when drops.is_demo is true OR its vendor's
// direct_vendors.is_demo is true. Demo drops never take orders or signups
// (preorder / waitlist / reserve return 400 DEMO_ORDER_ERROR) and every
// notification path skips them, so nothing is ever sent for one.

export const DEMO_ORDER_ERROR = "demo drops don't take orders"

// `drop` needs is_demo and creator_id. Never throws: a failed vendor lookup
// falls back to drops.is_demo alone.
export async function isDemoDrop(supa, drop) {
  if (!drop) return false
  if (drop.is_demo) return true
  if (!supa || !drop.creator_id) return false
  try {
    const { data, error } = await supa
      .from('direct_vendors').select('is_demo').eq('creator_id', drop.creator_id).maybeSingle()
    if (error) {
      console.warn('[demo] vendor is_demo lookup failed:', error.message)
      return false
    }
    return !!data?.is_demo
  } catch (e) {
    console.warn('[demo] vendor is_demo lookup threw:', e?.message)
    return false
  }
}
