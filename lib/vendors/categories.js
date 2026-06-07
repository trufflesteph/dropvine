// Shared list of vendor categories used by the /creators directory filter
// pills and the category badge on /direct/[slug] + /l/[handle].
//
// Keep this list in lockstep with the (optional) Postgres enum / check
// constraint on direct_vendors.category. Order matters — the directory
// renders pills in the same order they appear here, with "All" prepended.

export const VENDOR_CATEGORIES = [
  'Bakery',
  'Produce & Farm',
  'Hot Sauce & Condiments',
  'Honey & Preserves',
  'Flowers & Plants',
  'Ceramics & Pottery',
  'Candles & Home',
  'Clothing & Textiles',
  'Art & Prints',
  'Food & Snacks',
  'Beverages',
  'Workshops & Classes',
  'Other',
]

export const ALL_PILL = 'All'

export function isKnownCategory(c) {
  if (!c) return false
  return VENDOR_CATEGORIES.includes(c)
}
