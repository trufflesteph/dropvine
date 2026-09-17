// Shared list of vendor categories used by the /creators directory filter
// pills and the category badge on /direct/[slug] + /l/[handle].
//
// Keep this list in lockstep with the (optional) Postgres enum / check
// constraint on direct_vendors.category. Order matters — the directory
// renders pills in the same order they appear here, with "All" prepended.

export const VENDOR_CATEGORIES = [
  'Baked Goods',
  'Candles',
  'Bath & Beauty',
  'Hot Sauce/Condiments',
  'Jam/Preserves',
  'Fashion/Textiles',
  'Fiber Arts',
  'Art',
  'Ceramics/Pottery',
  'Jewelry',
  'Woodworking',
  'Leather Goods',
  'Paper Products/Stationery',
  'Pet Products',
  'Food & Drink',
  'Classes & Coaching',
  'Other',
]

export const ALL_PILL = 'All'

export function isKnownCategory(c) {
  if (!c) return false
  return VENDOR_CATEGORIES.includes(c)
}
