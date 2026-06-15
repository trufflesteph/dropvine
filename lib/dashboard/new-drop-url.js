// Shared helper for routing the dashboard "New drop" / "Compose a drop" /
// "Create one →" CTAs to the right Tally form for the signed-in vendor.
//
// Picked up by both `/app/dashboard/page.js` and `/app/dashboard/reservations/page.js`.
// Keep this file in lockstep with the SQL whitelist on direct_vendors.tier
// (and direct_vendors.tier_intent — the check constraint is the same).

export const TALLY_NEW_DROP_URLS = {
  free:  'https://tally.so/r/VLbkW6',
  maker: 'https://tally.so/r/RGbXG9',
  shop:  'https://tally.so/r/EkZp8l',
}

// Build the per-tier "create a drop" URL with vendor profile fields appended
// as hidden URL params so Tally can pre-fill them and the webhook can
// reconcile the submission back to the right vendor row.
// URLSearchParams.set() handles percent-encoding automatically.
export function buildNewDropUrl(tier, email, { businessName, category, cityState } = {}) {
  const safeTier = (tier && TALLY_NEW_DROP_URLS[tier]) ? tier : 'free'
  const base = TALLY_NEW_DROP_URLS[safeTier]
  try {
    const url = new URL(base)
    if (email) url.searchParams.set('vendor_email', email)
    if (businessName) url.searchParams.set('business_name', businessName)
    if (category) url.searchParams.set('business_category', category)
    if (cityState) url.searchParams.set('city_state', cityState)
    return url.toString()
  } catch {
    return base
  }
}
