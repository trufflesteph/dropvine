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
  // Tally sends single file uploads as arrays, but guard against object shape too.
  const arr = Array.isArray(v) ? v
    : (v && typeof v === 'object' && (v.url || v.uploadedUrl || v.uploaded_url) ? [v] : null)
  if (!arr) return []
  return arr.filter((x) => x && (x.url || x.uploadedUrl || x.uploaded_url)).map((x) => ({
    url: x.url || x.uploadedUrl || x.uploaded_url,
    name: x.name || null,
    mimeType: x.mimeType || x.mime_type || null,
  }))
}

// ============================================================================
// Tally multiple-choice resolution (June 2026)
// ----------------------------------------------------------------------------
// Tally's dropdown / radio / checkbox webhook payloads send the OPTION ID
// as `value` (e.g. "978cb1c0-f47d-4358-90cb-4e922cce103d") and the human-
// readable label lives in `field.options[].text`. The original webhook
// handler was storing the raw UUID into `drops.collection_mode`, breaking
// every downstream check that branched on the string label.
//
// `getTallyOptionLabel(fields, labelContains)` returns the resolved option
// label (or array of labels for multi-select). Falls back to the raw value
// when the field has no `options` array (e.g. text fields).
// ============================================================================
function _resolveOptionLabels(field) {
  if (!field) return null
  const opts = Array.isArray(field.options) ? field.options : null
  const v = field.value
  if (Array.isArray(v)) {
    if (!opts) return v.map((x) => String(x)).join(', ')
    const mapped = v.map((id) => {
      const o = opts.find((o) => String(o?.id) === String(id))
      return o?.text ?? o?.label ?? id
    })
    return mapped.length === 1 ? mapped[0] : mapped.join(', ')
  }
  if (!opts) return v == null ? null : String(v)
  const o = opts.find((o) => String(o?.id) === String(v))
  return o?.text ?? o?.label ?? (v == null ? null : String(v))
}

export function getTallyOptionLabel(fields, labelContains) {
  if (!Array.isArray(fields)) return null
  const lc = String(labelContains || '').toLowerCase()
  const f = fields.find((x) => String(x?.label || '').toLowerCase().includes(lc))
  if (!f) return null
  return _resolveOptionLabels(f)
}

// Map any Tally collection-mode label string to one of the 4 canonical
// values the rest of the app branches on: waitlist | pre-order | reservation | deposit.
// Accepts the Tally option text (e.g. "Pre-order", "Pre Order", "Waitlist")
// and returns the canonical kebab-case label.
export function normaliseCollectionMode(raw) {
  if (!raw) return 'pre-order'
  const s = String(raw).toLowerCase().replace(/[_\s]+/g, '-').trim()
  if (s.startsWith('pre')) return 'pre-order'   // pre-order, preorder, pre order
  if (s.startsWith('wait')) return 'waitlist'   // waitlist, wait list, waiting list
  if (s.startsWith('res')) return 'reservation' // reservation, reserve, reserve-a-slot
  if (s.startsWith('dep')) return 'deposit'     // deposit, deposit-only
  return 'pre-order'
}

// Title-case a canonical collection_mode label for display in emails / UI.
// e.g. "pre-order" → "Pre-order", "waitlist" → "Waitlist".
export function formatCollectionMode(raw) {
  const v = normaliseCollectionMode(raw)
  switch (v) {
    case 'pre-order': return 'Pre-order'
    case 'waitlist': return 'Waitlist'
    case 'reservation': return 'Reservation'
    case 'deposit': return 'Deposit'
    default: return 'Pre-order'
  }
}
