// Shared city/state normalization for vendor locations.
//
// Used on write (POST /api/direct/me, from /signup) so new rows land in one
// canonical form, and on read (/drops location filter) so rows written before
// normalization still compare equal: "west linn" / "West Linn, OR" / "Or" /
// "oregon" all become { city: 'West Linn', state: 'OR' }.
//
// Non-US state values that don't match a known name or code are kept as typed
// (whitespace collapsed), so nothing is silently dropped.

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico',
}

// lower-cased full name or code → code
const STATE_LOOKUP = new Map()
for (const [code, name] of Object.entries(US_STATES)) {
  STATE_LOOKUP.set(code.toLowerCase(), code)
  STATE_LOOKUP.set(name.toLowerCase(), code)
}

function clean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

// Two-letter code for a US state name or code (any case), else null.
function toStateCode(s) {
  return STATE_LOOKUP.get(clean(s).replace(/\./g, '').toLowerCase()) || null
}

// "west linn" → "West Linn", "winston-salem" → "Winston-Salem".
function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
}

// Returns { city, state }, each '' when blank. A trailing ", OR" or
// ", Oregon" on the city is stripped (and used as the state if none given).
export function normalizeLocation(city, state) {
  let c = clean(city)
  let st = clean(state)

  const m = c.match(/^(.*?),\s*([^,]+)$/)
  if (m) {
    const code = toStateCode(m[2])
    if (code) {
      c = clean(m[1])
      if (!st) st = code
    }
  }

  return {
    city: c ? titleCase(c) : '',
    state: st ? (toStateCode(st) || st) : '',
  }
}

// Lower-cased "city|state" for equality checks between normalized locations.
export function locationKey(city, state) {
  const n = normalizeLocation(city, state)
  return `${n.city}|${n.state}`.toLowerCase()
}

// "West Linn, OR" — for labels and chips.
export function formatLocation(city, state) {
  const n = normalizeLocation(city, state)
  return [n.city, n.state].filter(Boolean).join(', ')
}
