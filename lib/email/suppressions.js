// Email suppression list (public.email_suppressions). Marketing sends call
// filterSuppressed before sending; the unsubscribe endpoints call
// recordSuppression. Transactional emails never touch this.

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { normalizeEmail } from './unsubscribe'

const MISSING_TABLE_RE = /could not find the table|relation .* does not exist|schema cache/i
// Keeps the PostgREST `email=in.(...)` query string a sane length.
const LOOKUP_CHUNK = 100

// Splits recipients into those we may email and a count of the suppressed
// ones: anyone with a scope='all' row, or a scope='vendor' row for vendorId
// (the drop's creator_id).
//
// Returns { allowed, suppressed, error? }. If the lookup fails, `allowed` is
// empty: we'd rather miss a marketing email than send one to someone who
// unsubscribed. If the table doesn't exist yet nobody can have unsubscribed,
// so everyone is allowed (with a warning).
export async function filterSuppressed(recipients, vendorId) {
  const list = recipients || []
  const emails = [...new Set(list.map((r) => normalizeEmail(r?.email)).filter(Boolean))]
  if (!emails.length) return { allowed: list, suppressed: 0 }

  const supa = getSupabaseAdmin()
  if (!supa) return { allowed: [], suppressed: 0, error: 'suppression lookup failed: supabase not configured' }

  const blocked = new Set()
  for (let i = 0; i < emails.length; i += LOOKUP_CHUNK) {
    const { data, error } = await supa
      .from('email_suppressions')
      .select('email, scope, vendor_id')
      .in('email', emails.slice(i, i + LOOKUP_CHUNK))
    if (error) {
      if (MISSING_TABLE_RE.test(error.message)) {
        console.warn('[suppressions] email_suppressions table missing — run supabase/migrations/2026-10-email-suppressions.sql')
        return { allowed: list, suppressed: 0 }
      }
      return { allowed: [], suppressed: 0, error: `suppression lookup failed: ${error.message}` }
    }
    for (const row of data || []) {
      if (row.scope === 'all' || (vendorId && row.scope === 'vendor' && row.vendor_id === vendorId)) {
        blocked.add(row.email)
      }
    }
  }

  const allowed = list.filter((r) => !blocked.has(normalizeEmail(r?.email)))
  return { allowed, suppressed: list.length - allowed.length }
}

// Records one opt-out. Already-suppressed is success (clicking twice is
// harmless). scope 'vendor' needs vendorId; scope 'all' ignores it.
export async function recordSuppression({ email, scope, vendorId, source }) {
  const normalized = normalizeEmail(email)
  if (!normalized) return { ok: false, error: 'missing email' }
  if (scope !== 'vendor' && scope !== 'all') return { ok: false, error: 'invalid scope' }
  if (scope === 'vendor' && !vendorId) return { ok: false, error: 'vendor scope needs a vendor' }

  const supa = getSupabaseAdmin()
  if (!supa) return { ok: false, error: 'supabase not configured' }

  const { error } = await supa.from('email_suppressions').insert({
    email: normalized,
    scope,
    vendor_id: scope === 'vendor' ? vendorId : null,
    source,
  })
  if (error) {
    if (String(error.code) === '23505') return { ok: true, already: true }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
