// Helper for the Phase A vendor lifecycle cadence.
//
// When a drop is created (Tally webhook or admin form) we PRE-COMPUTE and
// INSERT all four email_schedules rows in one go. The cron then just scans
// for `sent_at IS NULL AND scheduled_for <= now()` and fires the right email.
//
// This keeps the cron simple and idempotent: UNIQUE (drop_id, kind) prevents
// double scheduling, and ON CONFLICT DO NOTHING means we can safely call this
// helper from multiple places (webhook + admin reschedule API + future migration).
//
// Returned shape:
//   { ok, scheduled: { open, reminder_5d?, pre_close_24h?, close_summary? }, errors[] }
//
// Notes:
//   - All times are stored as ISO strings (tz-aware).
//   - reminder_5d / pre_close_24h / close_summary are only scheduled if
//     closes_at is set AND the computed timestamp falls strictly between
//     launch_at and closes_at (so we never schedule a reminder for a date
//     that's already in the past or after the drop has closed).

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function computeSchedule({ launchAt, closesAt }) {
  const drop = launchAt ? new Date(launchAt) : null
  const close = closesAt ? new Date(closesAt) : null
  if (!drop || Number.isNaN(drop.getTime())) return null

  const plan = { open: drop.toISOString() }

  // Mid-window reminder (+5 days from open). Only if there's still ≥1 day
  // between the reminder and close.
  const reminderAt = new Date(drop.getTime() + FIVE_DAYS_MS)
  if (close && reminderAt < new Date(close.getTime() - ONE_DAY_MS)) {
    plan.reminder_5d = reminderAt.toISOString()
  }

  // 24h-pre-close + close summary — both require closes_at.
  if (close && !Number.isNaN(close.getTime())) {
    const preClose = new Date(close.getTime() - ONE_DAY_MS)
    // Only schedule pre-close if it's AFTER drop (a 2-day drop should still
    // get a 24h reminder — but a 12-hour drop shouldn't).
    if (preClose > drop) {
      plan.pre_close_24h = preClose.toISOString()
    }
    plan.close_summary = close.toISOString()
  }

  return plan
}

// Insert email_schedules rows for a drop. Idempotent via ON CONFLICT DO NOTHING.
// Tolerates the table being missing (Phase A migration not yet applied) by
// logging + returning a soft failure so the caller (webhook) doesn't 500.
//
// `hold`: when true, rows are inserted with hold=true so the lifecycle cron
// skips them. The /api/launches/publish/[token] endpoint releases the hold
// when the vendor publishes / schedules. Default false for callers (admin,
// existing scripts) that haven't been updated yet.
export async function scheduleDropLifecycle({ supa, drop, hold = false }) {
  const plan = computeSchedule({ launchAt: drop.launch_at, closesAt: drop.closes_at })
  if (!plan) return { ok: false, error: 'no launch_at' }

  const rows = Object.entries(plan).map(([kind, scheduled_for]) => ({
    drop_id: drop.id,
    kind,
    scheduled_for,
    hold,
  }))
  if (!rows.length) return { ok: true, scheduled: {} }

  // Supabase doesn't support ON CONFLICT DO NOTHING via the JS client without
  // upsert. We use upsert with ignoreDuplicates so existing rows are untouched.
  const { data, error } = await supa
    .from('email_schedules')
    .upsert(rows, { onConflict: 'drop_id,kind', ignoreDuplicates: true })
    .select('kind, scheduled_for')

  if (error) {
    // Two compat-failure modes:
    //   1. `hold` column missing — phase-Draft migration not applied yet.
    //      Retry once without the column so the webhook keeps working.
    //   2. Table missing entirely — phase A migration not applied yet.
    if (/could not find the .*column.*hold|hold.*does not exist/i.test(error.message)) {
      const rowsNoHold = rows.map(({ hold: _h, ...rest }) => rest)
      const retry = await supa
        .from('email_schedules')
        .upsert(rowsNoHold, { onConflict: 'drop_id,kind', ignoreDuplicates: true })
        .select('kind, scheduled_for')
      if (!retry.error) {
        return { ok: true, scheduled: Object.fromEntries((retry.data || []).map(r => [r.kind, r.scheduled_for])), plan, holdSkipped: true }
      }
    }
    if (/could not find the table|relation .* does not exist|schema cache/i.test(error.message)) {
      console.warn('[drop-lifecycle] email_schedules table missing — run supabase/migrations/2026-06-drop-lifecycle.sql')
      return { ok: false, error: 'migration_pending', migration: '2026-06-drop-lifecycle.sql' }
    }
    console.warn('[drop-lifecycle] upsert failed (non-fatal):', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true, scheduled: Object.fromEntries((data || []).map(r => [r.kind, r.scheduled_for])), plan }
}

// Release the publish-hold on every email_schedules row for a drop. Called
// by /api/launches/publish/[token] right after flipping the drop to
// published or scheduled. Tolerates the column being missing (no-op).
export async function releaseDropLifecycleHolds({ supa, launchId }) {
  const { error } = await supa
    .from('email_schedules')
    .update({ hold: false })
    .eq('drop_id', launchId)
    .eq('hold', true)
  if (error) {
    if (/could not find the .*column.*hold|hold.*does not exist/i.test(error.message)) {
      // Phase-Draft migration not applied — nothing to release.
      return { ok: true, releaseSkipped: true }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
