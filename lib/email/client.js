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
  return process.env.RESEND_FROM || 'Dropvine <onboarding@resend.dev>'
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}
