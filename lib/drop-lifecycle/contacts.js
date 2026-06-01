// Helper for ingesting a Tally CSV/manual contact upload into drop_subscribers.
//
// Two input modes (matches drop_products):
//   1. CSV file field labelled 'contacts', 'audience', 'subscribers',
//      or 'mailing list'. Expected headers (case-insensitive, any order):
//        email | name | phone
//      Rows without `email` are skipped.
//   2. Inline pasted block of email,name,phone lines in a long-text field
//      labelled 'contacts' (one address per line; commas optional).
//
// Returns { rows: [{email, name, phone, source}], source: 'csv' | 'paste' | 'none' }.
//
// Caller is responsible for stamping drop_id and inserting (using
// upsert(onConflict: drop_id,lower(email)) to dedupe).

import { getTallyFiles, getTallyText } from '@/lib/markets/tally'
import { parseCsv } from '@/lib/markets/tally-products'

const CSV_FIELD_KEYS = ['contacts', 'audience', 'subscribers', 'mailing list', 'contact list', 'customer list']
const PASTE_FIELD_KEYS = ['contacts paste', 'paste contacts', 'contact emails', 'email list']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function cleanEmail(raw) {
  if (!raw) return null
  const s = String(raw).trim().toLowerCase()
  return EMAIL_RE.test(s) ? s : null
}

function cleanText(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  return s ? s : null
}

// Best-effort phone normalisation. Returns digits-only with optional leading +.
function cleanPhone(raw) {
  if (!raw) return null
  const s = String(raw).trim().replace(/[^0-9+]/g, '')
  return s.length >= 7 ? s : null
}

function findCsvFile(fields) {
  for (const key of CSV_FIELD_KEYS) {
    const files = getTallyFiles(fields, key)
    if (Array.isArray(files) && files.length) {
      const csv = files.find(f => /\.csv$|text\/csv|application\/csv|text\/plain/i.test(`${f.mimeType || ''} ${f.name || ''}`))
      if (csv?.url) return csv
      return files[0]
    }
  }
  return null
}

function findPasteBlock(fields) {
  for (const key of PASTE_FIELD_KEYS) {
    const v = getTallyText(fields, key)
    if (v && String(v).trim().length) return v
  }
  return null
}

function normaliseRows(records) {
  // De-dupe within the upload itself by lower-cased email — the DB UNIQUE will
  // also dedupe across uploads / sources.
  const seen = new Map()
  for (const r of records) {
    const email = cleanEmail(r.email)
    if (!email) continue
    if (seen.has(email)) continue
    seen.set(email, {
      email,
      name: cleanText(r.name),
      phone: cleanPhone(r.phone),
    })
  }
  return Array.from(seen.values())
}

async function fetchCsvText(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`csv fetch ${res.status}`)
  return res.text()
}

function csvRowsToRecords(rows) {
  if (!rows.length) return []
  const headers = rows[0].map(h => String(h || '').trim().toLowerCase())
  const idx = (...candidates) => {
    for (const c of candidates) {
      const i = headers.indexOf(c)
      if (i !== -1) return i
    }
    return -1
  }
  const iEmail = idx('email', 'email_address', 'e-mail')
  const iName = idx('name', 'full_name', 'first_name', 'customer')
  const iPhone = idx('phone', 'mobile', 'sms', 'phone_number')
  if (iEmail === -1) return []
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    out.push({
      email: row[iEmail],
      name: iName !== -1 ? row[iName] : null,
      phone: iPhone !== -1 ? row[iPhone] : null,
    })
  }
  return out
}

function pasteToRecords(text) {
  // Each non-empty line is one record. Accepts `email`, `email,name`,
  // `email,name,phone`, or any common separator (comma/tab/semicolon/pipe).
  return String(text).split(/\r?\n/).map((line) => {
    const parts = line.split(/[,;\t|]/).map(s => s.trim()).filter(Boolean)
    if (!parts.length) return null
    return { email: parts[0], name: parts[1] || null, phone: parts[2] || null }
  }).filter(Boolean)
}

export async function extractLaunchSubscribers(fields) {
  // 1. CSV upload mode
  try {
    const file = findCsvFile(fields)
    if (file?.url) {
      const text = await fetchCsvText(file.url)
      const rows = parseCsv(text)
      const records = csvRowsToRecords(rows)
      const clean = normaliseRows(records)
      if (clean.length) return { rows: clean.map(r => ({ ...r, source: 'csv' })), source: 'csv' }
    }
  } catch (e) {
    console.warn('[lifecycle/contacts] csv parse failed (non-fatal):', e?.message || e)
  }
  // 2. Pasted block mode
  const block = findPasteBlock(fields)
  if (block) {
    const clean = normaliseRows(pasteToRecords(block))
    if (clean.length) return { rows: clean.map(r => ({ ...r, source: 'paste' })), source: 'paste' }
  }
  return { rows: [], source: 'none' }
}

// Bulk insert into drop_subscribers. Idempotent via UNIQUE (drop_id, lower(email)).
// Tolerates the table being missing (Phase A migration not yet applied).
export async function ingestLaunchSubscribers({ supa, drop_id, rows }) {
  if (!Array.isArray(rows) || !rows.length) return { ok: true, inserted: 0 }
  const payload = rows.map(r => ({
    drop_id,
    email: r.email,
    name: r.name || null,
    phone: r.phone || null,
    source: r.source || 'csv',
  }))
  // The UNIQUE constraint is on (drop_id, lower(email)), but Supabase's upsert
  // doesn't support expressions in onConflict. We use insert with ignoreDuplicates
  // which will skip rows that violate the constraint.
  const { data, error } = await supa
    .from('drop_subscribers')
    .insert(payload, { ignoreDuplicates: true })
    .select('id')
  if (error) {
    if (/could not find the table|relation .* does not exist|schema cache/i.test(error.message)) {
      console.warn('[lifecycle/contacts] drop_subscribers table missing — run supabase/migrations/2026-06-drop-lifecycle.sql')
      return { ok: false, error: 'migration_pending' }
    }
    console.warn('[lifecycle/contacts] insert failed (non-fatal):', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, inserted: data?.length || 0 }
}
