// Creates a signed-in vendor's direct_vendors row when it's missing.
//
// Rows are meant to come from the handle_new_user_direct_vendor() trigger on
// auth.users (supabase/migrations/2026-10-vendor-trials.sql), but that trigger
// swallows its own errors, and vendors exist with no row. GET /api/direct/me
// calls this so the dashboard and /dashboard/settings work for them, using the
// trigger's rules:
//   • business_name: signup metadata display_name → full_name → name → email
//     prefix → 'Studio'
//   • slug: public.unique_direct_vendor_slug(), the trigger's own function
//   • tier 'shop', active, trial_ends_at 30 days out
// Category and location are then copied from signup metadata by
// copySignupProfile in /api/direct/me, as for trigger-made rows.

const TRIAL_DAYS = 30

function metaText(v) {
  const s = String(v ?? '').trim()
  return s || null
}

export function deriveBusinessName(user) {
  const meta = user?.user_metadata || {}
  return metaText(meta.display_name)
    || metaText(meta.full_name)
    || metaText(meta.name)
    || metaText(String(user?.email || '').split('@')[0])
    || 'Studio'
}

// Returns { vendor, error }. `select` is the column list to return.
export async function createVendorRow(supa, user, select) {
  const businessName = deriveBusinessName(user)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: slug, error: slugError } = await supa.rpc('unique_direct_vendor_slug', { base: businessName })
    if (slugError || !slug) {
      return { vendor: null, error: `could not choose a slug: ${slugError?.message || 'no slug returned'}` }
    }
    const { data, error } = await supa.from('direct_vendors')
      .insert({
        creator_id: user.id,
        business_name: businessName,
        slug,
        tier: 'shop',
        active: true,
        trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
      })
      .select(select)
      .single()
    if (!error) return { vendor: data, error: null }
    if (error.code !== '23505') return { vendor: null, error: error.message }
    // Unique violation: either another request created this vendor's row
    // first (use it), or the slug was taken since it was chosen (choose again).
    const { data: existing } = await supa.from('direct_vendors')
      .select(select).eq('creator_id', user.id).maybeSingle()
    if (existing) return { vendor: existing, error: null }
  }
  return { vendor: null, error: 'could not choose a unique slug' }
}
