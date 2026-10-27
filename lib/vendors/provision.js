// Creates a signed-in vendor's direct_vendors row when it's missing.
//
// Rows are meant to come from the handle_new_user_direct_vendor() trigger on
// auth.users (supabase/migrations/2026-10-vendor-trials.sql), but that trigger
// swallows its own errors, and vendors exist with no row. GET /api/direct/me
// calls this so /dashboard, /dashboard/settings and /dashboard/orders work for
// them, using the trigger's rules:
//   • business_name: signup metadata display_name → full_name → name → email
//     prefix → 'Studio'
//   • slug: public.unique_direct_vendor_slug(), the trigger's own function
//   • tier 'shop', active, trial_ends_at 30 days after the user signed up
//     (auth created_at), as if the trigger had run at signup
// Category and location are then copied from signup metadata by
// copySignupProfile in /api/direct/me, as for trigger-made rows.
//
// In production direct_vendors.creator_id references public.profiles, so the
// user's profiles row is made first if it's missing (see ensureProfileRow).

const TRIAL_DAYS = 30

// The profiles row the handle_new_user() trigger (supabase/schema.sql) makes
// at signup: `insert into profiles (id, email) values (new.id, new.email)
// on conflict (id) do nothing` — every other column takes its default. An
// existing row is never changed, including one another request creates at the
// same moment. Returns an error message, or null.
async function ensureProfileRow(supa, user) {
  const { data, error } = await supa.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (error) return `could not check your account profile: ${error.message}`
  if (data) return null
  const { error: insertError } = await supa.from('profiles')
    .upsert({ id: user.id, email: user.email ?? null }, { onConflict: 'id', ignoreDuplicates: true })
  return insertError ? `could not create your account profile: ${insertError.message}` : null
}

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
  const signedUpMs = Date.parse(user.created_at)
  if (!Number.isFinite(signedUpMs)) return { vendor: null, error: 'the signed-in user has no signup date' }
  const trialEndsAt = new Date(signedUpMs + TRIAL_DAYS * 86400000).toISOString()
  const profileError = await ensureProfileRow(supa, user)
  if (profileError) return { vendor: null, error: profileError }
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
        trial_ends_at: trialEndsAt,
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
