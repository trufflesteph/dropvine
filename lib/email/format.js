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

const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' }
const dateFormat = new Intl.DateTimeFormat('en-US', { ...dateOptions, timeZone: EMAIL_TIME_ZONE })
const calendarDateFormat = new Intl.DateTimeFormat('en-US', { ...dateOptions, timeZone: 'UTC' })

// Date only, no time → "Friday, Nov 6". A timestamp (ISO string, Date or ms)
// shows its Pacific day. A bare calendar date ("2026-11-06") shows that same
// day everywhere, with no time zone shift. Returns null for empty or invalid
// input so callers can fall back.
export function formatEmailDate(value) {
  if (value == null || value === '') return null
  const isCalendarDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = isCalendarDate ? new Date(`${value}T12:00:00Z`)
    : value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const format = isCalendarDate ? calendarDateFormat : dateFormat
  const p = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]))
  return `${p.weekday}, ${p.month} ${p.day}`
}
