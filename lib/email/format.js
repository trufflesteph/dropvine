// Shared date/time formatting for every Dropvine email.
//
// All times display in Pacific time with a "PT" label, regardless of the
// server's time zone (Vercel runs in UTC). There's no vendor time zone field,
// so Pacific is used for every vendor. Example: "Thursday, Oct 1, 5:00 AM PT".
//
// Built from formatToParts rather than format() because newer ICU versions
// join date and time with " at " and put a narrow no-break space before AM/PM.

export const EMAIL_TIME_ZONE = 'America/Los_Angeles'
export const EMAIL_TIME_ZONE_LABEL = 'PT'

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: EMAIL_TIME_ZONE,
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

// Timestamp (ISO string, Date or ms) → "Thursday, Oct 1, 5:00 AM PT".
// Returns null for empty or invalid input so callers can fall back.
export function formatEmailDateTime(value) {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const p = Object.fromEntries(dateTimeFormat.formatToParts(date).map((part) => [part.type, part.value]))
  return `${p.weekday}, ${p.month} ${p.day}, ${p.hour}:${p.minute} ${p.dayPeriod} ${EMAIL_TIME_ZONE_LABEL}`
}

const calendarDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

// Calendar date with no time ("2026-10-07" → "Wednesday, October 7").
// Shown as the same calendar day everywhere: no time zone shift, no label.
export function formatEmailDate(ymd) {
  if (!ymd) return null
  const date = new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return calendarDateFormat.format(date)
}
