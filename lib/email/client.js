import { Resend } from 'resend'

let _resend = null

export function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (_resend) return _resend
  _resend = new Resend(key)
  return _resend
}

export function getDefaultFrom() {
  // Always send from a verified Dropvine address. RESEND_FROM env (set in
  // /app/.env) typically resolves to "Dropvine <hello@dropvine.pro>".
  // The fallback intentionally points at the same Dropvine address rather
  // than Resend's onboarding sandbox so production never silently falls
  // back to onboarding@resend.dev if the env var is missing.
  return process.env.RESEND_FROM || 'Dropvine <hello@dropvine.pro>'
}

// Shopper-facing emails come from a no-reply address under the maker's name,
// e.g. "Not 4 Kittys via Dropvine" <noreply@dropvine.pro>. No Reply-To is set;
// shopper copy points people to the maker instead. Vendor- and owner-facing
// emails keep getDefaultFrom().
export const SHOPPER_FROM_ADDRESS = 'noreply@dropvine.pro'

export function getShopperFrom(businessName) {
  // Quoted display name; drop characters that would break the header.
  const clean = String(businessName || '').replace(/["<>\\\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
  const name = clean ? `${clean} via Dropvine` : 'Dropvine'
  return `"${name}" <${SHOPPER_FROM_ADDRESS}>`
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}
