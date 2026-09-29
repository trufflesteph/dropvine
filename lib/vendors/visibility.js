// Shared drop-state and vendor-page visibility rules.
//
// Used by /api/direct/vendors (Fresh Drops), /api/direct/[slug] (vendor page)
// and the by-handle drop API (the "by {vendor}" link), so the rules live in
// one place. Pure functions — safe on the server and the client.
//
// Tier comes from direct_vendors.tier ('free' | 'maker' | 'shop'). A missing
// tier is treated as free.

// Open: published, launched, and closes_at empty or in the future.
export function isOpenDrop(drop, now = Date.now()) {
  if (drop?.status !== 'published') return false
  const launchMs = Date.parse(drop.launch_at)
  if (!Number.isFinite(launchMs) || launchMs > now) return false
  return !drop.closes_at || Date.parse(drop.closes_at) > now
}

// Upcoming: published or scheduled, launch_at in the future.
export function isUpcomingDrop(drop, now = Date.now()) {
  if (drop?.status !== 'published' && drop?.status !== 'scheduled') return false
  const launchMs = Date.parse(drop.launch_at)
  return Number.isFinite(launchMs) && launchMs > now
}

export function normalizeTier(tier) {
  return String(tier || '').toLowerCase().trim() || 'free'
}

// A vendor page is available when the vendor is Shop tier, or has at least
// one open or upcoming drop. `drops` is that vendor's drops (any statuses).
export function isVendorPageAvailable({ tier, drops }, now = Date.now()) {
  if (normalizeTier(tier) === 'shop') return true
  return (drops || []).some((d) => isOpenDrop(d, now) || isUpcomingDrop(d, now))
}
