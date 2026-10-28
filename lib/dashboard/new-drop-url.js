// Base Tally form URLs for each vendor tier.
// Used by the dashboard "New drop" button after a submission token is
// generated — the token is appended as ?token=... by the click handler.
// Keep in sync with direct_vendors.tier check constraint values.
export const TALLY_NEW_DROP_URLS = {
  free:  'https://tally.so/r/VLbkW6',
  maker: 'https://tally.so/r/RGbXG9',
  shop:  'https://tally.so/r/EkZp8l',
}

// Sends `tab` (opened by the caller inside the click, so popup blockers allow
// it) to the vendor's Tally new-drop form with a fresh submission token — the
// same steps as the dashboard's New drop button. Used by the welcome version
// of /dashboard/settings. Throws with a message for the vendor on failure.
export async function openNewDropForm(tab, { tier, headers }) {
  if (!tab) throw new Error('Your browser blocked the drop form from opening. Allow pop-ups for this site and try again.')
  const r = await fetch('/api/submission-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  const d = await r.json()
  if (!r.ok || !d.token) throw new Error(d.error || 'Could not generate submission token')
  const base = TALLY_NEW_DROP_URLS[tier] || TALLY_NEW_DROP_URLS.free
  tab.location.href = `${base}?token=${d.token}`
}
