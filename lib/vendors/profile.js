// Vendor profile fields a vendor edits on /dashboard/settings.
//
// Used on write by POST /api/direct/me, which stores what these return, and by
// the settings page for the bio limit. Pure functions — safe on the server and
// the client.
//
// Each normalizer returns { value, error }: `value` is what to store (null
// clears the field), `error` is a message for the vendor, or null when valid.

export const BIO_MAX = 600

function clean(s) {
  return String(s ?? '').trim()
}

const ok = (value) => ({ value: value || null, error: null })
const fail = (error) => ({ value: null, error })

// Line breaks are kept (the public page shows them).
export function normalizeBio(input) {
  const s = clean(String(input ?? '').replace(/\r\n?/g, '\n'))
  if (s.length > BIO_MAX) return fail(`Your bio is ${s.length} characters. Please keep it to ${BIO_MAX}.`)
  return ok(s)
}

// US numbers only: "503.555.1234", "+1 503 555 1234" → "(503) 555-1234".
export function normalizePhone(input) {
  const s = clean(input)
  if (!s) return ok(null)
  let digits = s.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  if (digits.length !== 10) return fail('Enter a 10-digit US phone number, like (503) 555-1234.')
  return ok(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`)
}

// "@yourshop", "yourshop" or "instagram.com/yourshop/?hl=en" →
// "https://instagram.com/yourshop".
export function normalizeInstagram(input) {
  const s = clean(input)
  if (!s) return ok(null)
  const fromUrl = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/@?([^/?#\s]+)/i)
  if (!fromUrl && /[/:\s]/.test(s)) {
    return fail('Enter your Instagram handle, like @yourshop, or a link to instagram.com/yourshop.')
  }
  const handle = fromUrl ? fromUrl[1] : s.replace(/^@/, '')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
    return fail('Instagram handles use only letters, numbers, periods and underscores (up to 30).')
  }
  return ok(`https://instagram.com/${handle}`)
}

// http or https only; "yourshop.com" → "https://yourshop.com".
export function normalizeWebsite(input) {
  const s = clean(input)
  if (!s) return ok(null)
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) {
    return fail('Your website address must start with http:// or https://.')
  }
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  let url
  try { url = new URL(withScheme) } catch { url = null }
  if (!url || /\s/.test(s) || withScheme.length > 2048 || url.username || url.password
      || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) {
    return fail('Enter a website address like yourshop.com.')
  }
  return ok(withScheme)
}

// Stored without the leading @, like the admin editor.
export function normalizeVenmo(input) {
  const s = clean(input).replace(/^@+/, '')
  if (!s) return ok(null)
  if (!/^[A-Za-z0-9_-]{1,30}$/.test(s)) {
    return fail('Enter your Venmo username, like @yourshop (letters, numbers, - and _ only).')
  }
  return ok(s)
}

// True for the Supabase error from writing or selecting direct_vendors.phone
// before supabase/migrations/2026-10-direct-vendors-phone.sql is applied.
export function isMissingPhoneColumn(error) {
  const msg = String(error?.message || '')
  return /phone/i.test(msg) && /does not exist|schema cache|could not find/i.test(msg)
}

// direct_vendors column → normalizer.
export const PROFILE_FIELDS = {
  bio: normalizeBio,
  phone: normalizePhone,
  instagram_url: normalizeInstagram,
  website_url: normalizeWebsite,
  venmo_handle: normalizeVenmo,
}
