/**
 * Two-tier admin auth helpers for Dropvine Markets.
 *
 * - The actual passwords are stored server-side as VITE_ADMIN_PASSWORD
 *   (platform owner) and VITE_ORGANISER_PASSWORD (market organiser).
 * - The browser POSTs the entered password to /api/market/admin/login,
 *   the server compares it, and if it matches we return an opaque
 *   role token. The client stores that token in sessionStorage as
 *   `dropvine_market_admin`.
 * - Every privileged admin API route validates the role token via
 *   `requireAdminRole()` (or `requireRole('platform' | 'organiser')`).
 */
import crypto from 'crypto'

const PLATFORM_ROLE = 'platform'
const ORGANISER_ROLE = 'organiser'

export const ADMIN_ROLES = { PLATFORM: PLATFORM_ROLE, ORGANISER: ORGANISER_ROLE }

// In production CRON_SECRET is mandatory: with no secret, no admin token can
// be issued or accepted. The hard-coded fallback exists only for local dev.
function getSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production') return null
  return 'dropvine-admin-secret-fallback'
}

export function isAdminSecretConfigured() {
  return getSecret() !== null
}

function sign(payload) {
  const secret = getSecret()
  if (!secret) throw new Error('CRON_SECRET is not configured')
  const json = JSON.stringify(payload)
  const b64 = Buffer.from(json, 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

function verify(token) {
  const secret = getSecret()
  if (!secret) return null
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [b64, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', secret).update(b64).digest('base64url')
  if (sig !== expected) return null
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
    if (payload?.exp && Date.now() > payload.exp) return null
    return payload
  } catch { return null }
}

export function passwordToRole(password) {
  if (!password) return null
  if (password === process.env.VITE_ADMIN_PASSWORD) return PLATFORM_ROLE
  if (password === process.env.VITE_ORGANISER_PASSWORD) return ORGANISER_ROLE
  return null
}

export function issueAdminToken(role, ttlMs = 1000 * 60 * 60 * 12) {
  return sign({ role, exp: Date.now() + ttlMs, iat: Date.now() })
}

export function readAdminTokenFromRequest(request) {
  // Accept either Authorization: Bearer <token> or X-Admin-Token header
  const auth = request.headers.get('authorization') || ''
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null
  const header = request.headers.get('x-admin-token')
  return bearer || header || null
}

export function requireAdminRole(request, allowed = [PLATFORM_ROLE, ORGANISER_ROLE]) {
  const token = readAdminTokenFromRequest(request)
  const payload = verify(token)
  if (!payload || !allowed.includes(payload.role)) {
    return { ok: false, status: 401, error: 'unauthorized' }
  }
  return { ok: true, role: payload.role, payload }
}
