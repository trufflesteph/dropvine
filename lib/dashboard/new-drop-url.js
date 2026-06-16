// Base Tally form URLs for each vendor tier.
// Used by the dashboard "New drop" button after a submission token is
// generated — the token is appended as ?token=... by the click handler.
// Keep in sync with direct_vendors.tier check constraint values.
export const TALLY_NEW_DROP_URLS = {
  free:  'https://tally.so/r/VLbkW6',
  maker: 'https://tally.so/r/RGbXG9',
  shop:  'https://tally.so/r/EkZp8l',
}
