// Signed unsubscribe tokens + links for marketing emails.
//
// Token = base64url(JSON { e: email, v: vendor creator_id | null }) + '.' +
// base64url(HMAC-SHA256). The HMAC key is UNSUBSCRIBE_SECRET and the signed
// text is prefixed with a fixed purpose string, so a token can't be reused as
// any other kind of signature. No expiry: links in old emails keep working
// as long as UNSUBSCRIBE_SECRET doesn't change.
//
// In production, if UNSUBSCRIBE_SECRET is missing, createUnsubscribeToken
// returns null and marketing emails go out without unsubscribe links or
// headers (logged once). Outside production a fixed dev secret is used.

import crypto from 'crypto'

const PURPOSE = 'unsubscribe-v1'

// Links always point at production, even from preview deploys, so a link
// in a sent email never goes stale.
export const UNSUBSCRIBE_ORIGIN = 'https://www.dropvine.pro'

const DEV_SECRET = 'dropvine-dev-unsubscribe-secret'

let warnedMissingSecret = false

function getSecret({ warn }) {
  if (process.env.UNSUBSCRIBE_SECRET) return process.env.UNSUBSCRIBE_SECRET
  if (process.env.NODE_ENV !== 'production') return DEV_SECRET
  if (warn && !warnedMissingSecret) {
    warnedMissingSecret = true
    console.warn('[unsubscribe] UNSUBSCRIBE_SECRET is not set; marketing emails are sent without unsubscribe links')
  }
  return null
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(`${PURPOSE}.${payload}`).digest('base64url')
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function createUnsubscribeToken({ email, vendorId }) {
  const secret = getSecret({ warn: true })
  if (!secret) return null
  const e = normalizeEmail(email)
  if (!e) return null
  const payload = Buffer.from(JSON.stringify({ e, v: vendorId || null })).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

// Returns { email, vendorId } for a valid token, or null if it is missing,
// malformed or tampered with.
export function verifyUnsubscribeToken(token) {
  const secret = getSecret({ warn: false })
  if (!secret || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [payload, signature] = parts
  const given = Buffer.from(signature)
  const expected = Buffer.from(sign(payload, secret))
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null
  try {
    const { e, v } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const email = normalizeEmail(e)
    if (!email) return null
    return { email, vendorId: typeof v === 'string' && v ? v : null }
  } catch {
    return null
  }
}

// { pageUrl, oneClickUrl } for one recipient, or null without a secret.
export function unsubscribeLinks({ email, vendorId }) {
  const token = createUnsubscribeToken({ email, vendorId })
  if (!token) return null
  const t = encodeURIComponent(token)
  return {
    pageUrl: `${UNSUBSCRIBE_ORIGIN}/unsubscribe?t=${t}`,
    oneClickUrl: `${UNSUBSCRIBE_ORIGIN}/api/unsubscribe/one-click?t=${t}`,
  }
}

// RFC 8058 one-click headers. Undefined when there are no links.
export function unsubscribeHeaders(links) {
  if (!links) return undefined
  return {
    'List-Unsubscribe': `<${links.oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
