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

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}
