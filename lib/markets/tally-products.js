// Parse Dropvine Direct product fields out of a Tally webhook payload.
//
// Two product entry modes are supported (in priority order):
//
//   1. CSV / spreadsheet upload — file field labelled like "spreadsheet",
//      "products csv", or "product list". When present, parses each row as
//      a product. Expected header (case-insensitive, any order):
//        name | description | price | quantity | photo_url
//      A row without a `name` is skipped. Price is treated like the legacy
//      single-product field: values ≥ 1000 are taken as cents, otherwise
//      multiplied by 100 (so "8" → 800 cents, "850" → 850 cents).
//
//   2. Manual repeating-group fields — `product_1_name`, `product_1_price`,
//      `product_1_quantity`, `product_1_description`, `product_1_photo`,
//      …up to product_10_*.  Any product whose name is empty is skipped.
//
// Returns an array of objects shaped for INSERT INTO drop_products
// (excluding drop_id, which the caller stamps on). If neither mode produced
// rows, returns an empty array — the caller is expected to fall back to the
// legacy single-product behaviour.
//
// Notes:
//   - Tally's CSV upload field type returns the same `[{ url, name, mimeType }]`
//     shape as photo uploads. We fetch the URL server-side, parse text/CSV
//     with a tolerant parser (RFC-4180-ish: quoted fields, doubled quotes).
//   - All numbers are parseFloat-tolerant and capped to non-negative integers.

import { getTallyField, getTallyFiles, getTallyText, getTallyNumber } from './tally'

const MAX_MANUAL_PRODUCTS = 10

function toCents(rawPrice) {
  if (rawPrice == null || rawPrice === '') return 0
  const n = Number(String(rawPrice).replace(/[^0-9.\-]/g, ''))
  if (!Number.isFinite(n) || n < 0) return 0
  // Treat large values as already-cents (matches the existing single-price
  // heuristic in tally-direct-drop/route.js so makers can enter either format).
  return n >= 1000 ? Math.round(n) : Math.round(n * 100)
}

function toQuantity(raw) {
  if (raw == null || raw === '') return null
  const n = parseInt(String(raw).replace(/[^0-9\-]/g, ''), 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function cleanText(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  return s ? s : null
}

// Minimal RFC-4180-ish CSV parser. Handles quoted fields, doubled-quote escape,
// CRLF/LF line endings. Returns 2D array of strings.
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\r') { /* swallow */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += ch
    }
  }
  // Flush
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c && c.trim().length))
}

// Map header → column index. Tolerant of whitespace + casing + a couple of
// synonyms ("photo" ↔ "photo_url" ↔ "image").
//
// Round 2.2 — the production CSV header is
//   product_name,variant,description,price,quantity,notes
// which normalises to `productname`. Added it (plus `productprice`,
// `productqty`, `productquantity`, `productdescription`, `productdesc`,
// `productimage`, `productphoto`) so the existing header normaliser
// recognises the production template verbatim.
function buildHeaderMap(headerRow) {
  const map = {}
  headerRow.forEach((h, i) => {
    const key = String(h || '').toLowerCase().trim().replace(/[_\s-]+/g, '')
    if (!key) return
    if (key === 'name' || key === 'product' || key === 'productname' || key === 'title' || key === 'item') map.name = i
    else if (key === 'description' || key === 'desc' || key === 'productdescription' || key === 'productdesc') map.description = i
    else if (key === 'price' || key === 'pricecents' || key === 'cost' || key === 'productprice') map.price = i
    else if (key === 'quantity' || key === 'qty' || key === 'productqty' || key === 'productquantity' || key === 'capacity' || key === 'stock') map.quantity = i
    else if (key === 'photourl' || key === 'photo' || key === 'image' || key === 'imageurl' || key === 'photolink' || key === 'productimage' || key === 'productphoto') map.photo_url = i
    // `variant` and `notes` columns from the production template are
    // intentionally ignored — they're informational only.
  })
  return map
}

function rowsToProducts(rows) {
  if (!rows.length) return []
  const headerMap = buildHeaderMap(rows[0])
  if (headerMap.name == null) return []  // no recognisable header → bail
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = cleanText(r[headerMap.name])
    if (!name) continue
    out.push({
      name,
      description: headerMap.description != null ? cleanText(r[headerMap.description]) : null,
      price_cents: headerMap.price != null ? toCents(r[headerMap.price]) : 0,
      quantity: headerMap.quantity != null ? toQuantity(r[headerMap.quantity]) : null,
      photo_url: headerMap.photo_url != null ? cleanText(r[headerMap.photo_url]) : null,
      sort_order: out.length,
    })
  }
  return out
}

// Fetch the CSV file URL Tally hosts the upload at, with a 5s timeout.
// Returns null on any error (caller falls through to manual-fields mode).
async function fetchCsvText(url) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    return await res.text()
  } catch (e) {
    console.warn('[tally-products] CSV fetch failed:', e?.message || e)
    return null
  }
}

// Round 2.1 — production Tally form uses SINGLE fields for manual mode:
//   Product Name, Product Description, Price, Quantity Available
// (not `product_1_name`, etc.). When the vendor adds multiple manual
// products Tally repeats those same labels, so we group by index.
function extractManualProducts(fields) {
  // Exact-ish label matchers — picked to NOT collide with the CSV field
  // "Product and Pricing (CSV file)" or the drop-level "Drop Title" / etc.
  const isProductName  = (l) => /^product name\b/i.test(String(l || '').trim())
  const isProductDesc  = (l) => /^product description\b/i.test(String(l || '').trim())
  const isProductPrice = (l) => /^price$/i.test(String(l || '').trim()) || /^product price$/i.test(String(l || '').trim())
  const isProductQty   = (l) => /^quantity available\b/i.test(String(l || '').trim()) || /^product quantity\b/i.test(String(l || '').trim())
  const isProductPhoto = (l) => /^product photo\b/i.test(String(l || '').trim()) || /^product image\b/i.test(String(l || '').trim())

  const names  = fields.filter((f) => isProductName(f?.label))
  const descs  = fields.filter((f) => isProductDesc(f?.label))
  const prices = fields.filter((f) => isProductPrice(f?.label))
  const qtys   = fields.filter((f) => isProductQty(f?.label))
  const photos = fields.filter((f) => isProductPhoto(f?.label))

  // Also support the legacy explicit-index labels ("product 1 name", etc.)
  // for any older Tally forms still in flight.
  const out = []
  for (let i = 0; i < names.length; i++) {
    const name = cleanText(names[i]?.value)
    if (!name) continue
    const photoVal = photos[i]?.value
    let photoUrl = null
    if (Array.isArray(photoVal)) {
      photoUrl = photoVal?.[0]?.url || null
    } else if (typeof photoVal === 'string') {
      photoUrl = photoVal
    }
    out.push({
      name,
      description: cleanText(descs[i]?.value),
      price_cents: toCents(prices[i]?.value),
      quantity: toQuantity(qtys[i]?.value),
      photo_url: photoUrl,
      sort_order: out.length,
    })
  }
  if (out.length) return out

  // Legacy fall-through: product_1_name / product_1_price / …
  const legacy = []
  for (let i = 1; i <= MAX_MANUAL_PRODUCTS; i++) {
    const name = cleanText(getTallyText(fields, `product ${i} name`))
      || cleanText(getTallyText(fields, `product_${i}_name`))
    if (!name) continue
    const priceRaw = getTallyNumber(fields, `product ${i} price`)
      ?? getTallyNumber(fields, `product_${i}_price`)
    const description = cleanText(getTallyText(fields, `product ${i} description`))
      || cleanText(getTallyText(fields, `product_${i}_description`))
    const quantity = toQuantity(getTallyNumber(fields, `product ${i} quantity`)
      ?? getTallyNumber(fields, `product_${i}_quantity`))
    const photoText = cleanText(getTallyText(fields, `product ${i} photo`))
      || cleanText(getTallyText(fields, `product_${i}_photo`))
    const photoFiles = getTallyFiles(fields, `product ${i} photo`)
    const photo_url = photoFiles?.[0]?.url || photoText || null

    legacy.push({
      name,
      description,
      price_cents: toCents(priceRaw),
      quantity,
      photo_url,
      sort_order: legacy.length,
    })
  }
  return legacy
}

/**
 * Resolve the list of products to seed into drop_products for a freshly
 * submitted drop.
 *
 * @param {Array} fields  Tally `data.fields[]`
 * @returns {Promise<{products: Array, source: 'csv'|'manual'|'none'}>}
 */
export async function extractLaunchProducts(fields) {
  // 1. CSV first — most flexible, also implicitly the spreadsheet-upload path.
  //
  // Round 2.1 — the production Tally form label is "Product and Pricing
  // (CSV file)". We add it to the substring matchers AND, critically,
  // EXCLUDE any field whose label looks like a contact / audience CSV so
  // we never accidentally treat "Contact List (CSV file)" as the product
  // catalogue when both files are uploaded on the same submission.
  const csvLabels = [
    'product and pricing',  // production label (highest priority)
    'product and prices',
    'pricing (csv',
    'product pricing',
    'products csv',
    'product csv',
    'product list',
    'products file',
    'spreadsheet',
    'csv',                  // generic fallback (filtered for non-contact below)
  ]
  let csvFiles = []
  for (const label of csvLabels) {
    csvFiles = getTallyFiles(fields, label)
    if (csvFiles.length) {
      // Filter out files that came from a contact/audience CSV field by
      // inspecting the field LABEL we matched against. The `getTallyFiles`
      // helper returns the files but not the label; we re-scan fields to
      // make sure the matched label isn't a contact-list one.
      const matchedLabel = fields.find((f) =>
        String(f?.label || '').toLowerCase().includes(label)
      )?.label || ''
      const isContactList = /contact|audience|subscriber|recipient|mailing/i.test(matchedLabel)
      if (isContactList) {
        // Keep looking — the next matcher might find the real product CSV.
        csvFiles = []
        continue
      }
      break
    }
  }
  // Only treat as CSV when the uploaded file looks like a spreadsheet.
  const first = csvFiles?.[0]
  if (first?.url) {
    const isCsv = /\.csv($|\?)/i.test(first.url)
      || /\.csv($|\?)/i.test(first.name || '')
      || /csv|spreadsheet|excel/i.test(first.mimeType || '')
    if (isCsv) {
      const txt = await fetchCsvText(first.url)
      if (txt && txt.trim()) {
        const rows = parseCsv(txt)
        const products = rowsToProducts(rows)
        if (products.length) {
          console.log('[tally-products] CSV parsed:', products.length, 'products from', first.name || first.url)
          return { products, source: 'csv' }
        }
        console.warn('[tally-products] CSV fetched but yielded 0 products. Header row:', JSON.stringify(rows[0] || []))
      } else {
        console.warn('[tally-products] CSV fetch returned empty body — Tally URL:', first.url)
      }
    } else {
      console.warn('[tally-products] matched a non-CSV file (will skip parsing):', first.name, first.mimeType)
    }
  } else {
    console.log('[tally-products] no product CSV field found in payload')
  }

  // 2. Manual repeating groups.
  const manual = extractManualProducts(fields)
  if (manual.length) return { products: manual, source: 'manual' }

  // 3. Caller falls back to single-product behaviour.
  return { products: [], source: 'none' }
}
