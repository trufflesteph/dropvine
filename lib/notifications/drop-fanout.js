// Shared fan-out helper for Dropvine Direct drops.
//
// Sends email + (tier-gated) SMS to every waitlist entry for a drop, then
// stamps `notified_at` so we never double-fire. Used by:
//   • POST /api/market/admin/drops/[id]/publish  (when notify_at ≤ now)
//   • POST /api/market/admin/drops/[id]/notify-now (manual “Send now”)
//   • GET  /api/cron/send-drop-notifications     (every 10 min)
//
// Returns { ok, sent: {email, sms}, total, skipped, alreadyNotified, error? }.
// NEVER throws upstream — failures are captured in the return value so the
// caller can decide whether to surface them.

import { notifyLaunchLive } from '@/lib/notifications'

// Plans that may send SMS as part of fan-out. Free tier = email only.
const SMS_PLAN_TIERS = new Set(['maker', 'studio'])

// Idempotent: noop + returns alreadyNotified=true if notified_at is already set.
export async function fanoutDropNotifications({ supa, drop, baseUrl, force = false }) {
  if (!drop) return { ok: false, error: 'missing drop' }

  // Re-read freshly to avoid TOCTOU on notified_at.
  const fresh = await supa.from('drops').select('*').eq('id', drop.id).maybeSingle()
  const current = fresh.data || drop
  if (current.notified_at && !force) {
    return { ok: true, alreadyNotified: true, sent: { email: 0, sms: 0 }, total: 0 }
  }

  // Look up creator + tier — gates whether SMS is fanned out.
  let plan_tier = 'free'
  if (current.creator_id) {
    const { data: profile } = await supa
      .from('profiles').select('plan_tier').eq('id', current.creator_id).maybeSingle()
    if (profile?.plan_tier) plan_tier = String(profile.plan_tier).toLowerCase()
  }
  const smsAllowed = SMS_PLAN_TIERS.has(plan_tier)

  // Recipients = waitlist entries for this drop.
  // Defensively select * so we tolerate the migration not having added `phone`
  // yet (the SMS sender will simply skip rows with no phone).
  const { data: entries, error: lErr } = await supa
    .from('waitlist_entries').select('*').eq('drop_id', current.id)
  if (lErr) return { ok: false, error: `waitlist read failed: ${lErr.message}` }
  const recipients = (entries || []).map((e) => ({
    email: e.email,
    phone: e.phone || null,
    // Presence of a phone on a waitlist entry implies opt-in for that drop.
    sms_opt_in: smsAllowed && !!e.phone,
  }))

  if (!recipients.length) {
    const stamp = await supa.from('drops').update({ notified_at: new Date().toISOString() }).eq('id', current.id).select('notified_at').maybeSingle()
    return { ok: true, sent: { email: 0, sms: 0 }, total: 0, skipped: 'no recipients', notified_at: stamp.data?.notified_at }
  }

  const channels = smsAllowed ? ['email', 'sms'] : ['email']
  let emailSent = 0, smsSent = 0
  const errors = []
  try {
    const results = await notifyLaunchLive({ drop: current, recipients, baseUrl }, channels)
    for (const r of results || []) {
      if (r.channel === 'email') {
        emailSent += (r.sent || 0)
      } else if (r.channel === 'sms') {
        for (const x of r.results || []) {
          if (x?.sid) smsSent += 1
          else if (x?.error) errors.push({ channel: 'sms', error: x.error })
        }
      }
      if (r.error) errors.push({ channel: r.channel, error: r.error })
    }
  } catch (e) {
    return { ok: false, error: e?.message || 'fanout failed' }
  }

  // Stamp notified_at — even if some sends failed (don’t retry the whole batch).
  const stamp = await supa.from('drops')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', current.id)
    .select('notified_at').maybeSingle()
  if (stamp.error) errors.push({ channel: 'db', error: stamp.error.message })

  return {
    ok: true,
    plan_tier,
    sms_allowed: smsAllowed,
    sent: { email: emailSent, sms: smsSent },
    total: recipients.length,
    errors: errors.length ? errors : undefined,
    notified_at: stamp.data?.notified_at,
  }
}
