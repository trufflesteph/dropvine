// Tally webhook helpers.
// Tally sends a `tally-signature` header which is the base64-encoded HMAC-SHA256
// of the RAW request body using your TALLY_WEBHOOK_SECRET as the key.
//
// Reference: https://tally.so/help/webhooks
//
// If TALLY_WEBHOOK_SECRET is not set we run in INSECURE PLACEHOLDER MODE — we
// still accept the webhook but log a warning. This lets us scaffold and test
// without the real secret. Once you fill the secret, signature verification
// becomes mandatory.

import crypto from 'crypto'

export function isTallySecretConfigured() {
  return !!process.env.TALLY_WEBHOOK_SECRET && process.env.TALLY_WEBHOOK_SECRET.trim().length > 0
}

/**
 * Verify the signature header against the raw payload string.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifyTallySignature({ rawBody, signature }) {
  if (!isTallySecretConfigured()) {
    // Placeholder mode — accept everything, but flag so callers can log.
    return { ok: true, placeholder: true }
  }
  if (!signature) return { ok: false, reason: 'missing tally-signature header' }
  const secret = process.env.TALLY_WEBHOOK_SECRET
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  // Constant-time compare
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return { ok: false, reason: 'signature length mismatch' }
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' }
  return { ok: true }
}

/**
 * Pluck a field value out of a Tally `data.fields[]` array.
 * Match is case-insensitive and tolerant of small label variations — uses
 * `includes` against the lowercased label.
 */
export function getTallyField(fields, labelContains) {
  if (!Array.isArray(fields)) return null
  const lc = String(labelContains || '').toLowerCase()
  const f = fields.find((x) => String(x?.label || '').toLowerCase().includes(lc))
  if (!f) return null
  // Tally sometimes nests value under `value` directly, sometimes as { id, value }
  // and for files: array of { url, name, mimeType }.
  return f.value
}

export function getTallyEmail(fields) {
  return getTallyField(fields, 'email') || null
}

export function getTallyText(fields, label) {
  const v = getTallyField(fields, label)
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v.length && typeof v[0] === 'string') return v.join(', ')
  return v != null ? String(v) : null
}

export function getTallyNumber(fields, label) {
  const v = getTallyField(fields, label)
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

export function getTallyFiles(fields, label) {
  const v = getTallyField(fields, label)
  if (Array.isArray(v)) {
    return v.filter((x) => x && (x.url || x.uploadedUrl || x.uploaded_url)).map((x) => ({
      url: x.url || x.uploadedUrl || x.uploaded_url,
      name: x.name || null,
      mimeType: x.mimeType || x.mime_type || null,
    }))
  }
  return []
}
