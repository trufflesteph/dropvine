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

// Build the per-tier "create a drop" URL with the vendor's email appended
// as a hidden URL param so the Tally submission can be reconciled back to
// the right vendor row. Unknown / null tier → free.
export function buildNewDropUrl(tier, email) {
  const safeTier = (tier && TALLY_NEW_DROP_URLS[tier]) ? tier : 'free'
  const base = TALLY_NEW_DROP_URLS[safeTier]
  if (!email) return base
  try {
    const url = new URL(base)
    url.searchParams.set('vendor_email', email)
    return url.toString()
  } catch {
    return base
  }
}
