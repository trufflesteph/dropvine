// Shared fan-out helper for Dropvine Direct drops.
//
// Sends email + (tier-gated) SMS to every waitlist entry for a drop, then
// stamps `notified_at` so we never double-fire. Used by:
//   • POST /api/market/admin/drops/[id]/publish  (when notify_at ≤ now)
//   • POST /api/market/admin/drops/[id]/notify-now (manual “Send now”)
//   • GET  /api/cron/send-drop-notifications     (every 10 min)
//
// Returns { ok, sent: {email, sms}, total, skipped, alreadyNotified, error? }.
// If the email suppression lookup fails, returns { ok: false, retry: true }
// with nothing sent and notified_at left null, so the cron retries.
// NEVER throws upstream — failures are captured in the return value so the
// caller can decide whether to surface them.

import { notifyLaunchLive } from '@/lib/notifications'
import { normalizeTier } from '@/lib/vendors/visibility'
import { isDemoDrop } from '@/lib/drops/demo'

// Tiers (direct_vendors.tier) that may send SMS as part of fan-out. Free
// tier = email only.
const SMS_PLAN_TIERS = new Set(['maker', 'shop'])

// Idempotent: noop + returns alreadyNotified=true if notified_at is already set.
// Demo drops (lib/drops/demo.js): noop, returns skipped='demo drop'.
export async function fanoutDropNotifications({ supa, drop, baseUrl, force = false }) {
  if (!drop) return { ok: false, error: 'missing drop' }

  // Re-read freshly to avoid TOCTOU on notified_at.
  const fresh = await supa.from('drops').select('*').eq('id', drop.id).maybeSingle()
  const current = fresh.data || drop
  // Demo drops never send anything. notified_at is left untouched.
  if (await isDemoDrop(supa, current)) {
    return { ok: true, skipped: 'demo drop', sent: { email: 0, sms: 0 }, total: 0 }
  }
  if (current.notified_at && !force) {
    return { ok: true, alreadyNotified: true, sent: { email: 0, sms: 0 }, total: 0 }
  }

  // Look up the vendor's tier (direct_vendors.tier) — gates whether SMS is
  // fanned out. No direct_vendors row = free. Still reported as `plan_tier`
  // so the send-drop-notifications cron log keeps its shape.
  let plan_tier = 'free'
  if (current.creator_id) {
    const { data: vendor } = await supa
      .from('direct_vendors').select('tier').eq('creator_id', current.creator_id).maybeSingle()
    plan_tier = normalizeTier(vendor?.tier)
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

  let emailSent = 0, smsSent = 0, emailSuppressed = 0
  const errors = []
  try {
    // Email first, on its own: if the suppression lookup fails nothing has
    // gone out yet, so we stop before SMS and leave notified_at null. The
    // send-drop-notifications cron then retries the whole fan-out once.
    const [email] = await notifyLaunchLive({ drop: current, recipients, baseUrl }, ['email'])
    if (email?.lookupFailed) {
      // The cron only picks up drops with notify_at <= now. An immediate
      // publish leaves notify_at null, so set it to now to queue the retry.
      if (!current.notify_at) {
        await supa.from('drops')
          .update({ notify_at: new Date().toISOString() })
          .eq('id', current.id)
          .is('notify_at', null)
      }
      return { ok: false, retry: true, plan_tier, sms_allowed: smsAllowed, total: recipients.length, error: email.error }
    }
    emailSent += (email?.sent || 0)
    emailSuppressed += (email?.suppressed || 0)
    if (email?.error) errors.push({ channel: 'email', error: email.error })

    if (smsAllowed) {
      const [sms] = await notifyLaunchLive({ drop: current, recipients, baseUrl }, ['sms'])
      for (const x of sms?.results || []) {
        if (x?.sid) smsSent += 1
        else if (x?.error) errors.push({ channel: 'sms', error: x.error })
      }
      if (sms?.error) errors.push({ channel: 'sms', error: sms.error })
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
    // Email recipients skipped because they unsubscribed (SMS unaffected).
    suppressed: { email: emailSuppressed },
    errors: errors.length ? errors : undefined,
    notified_at: stamp.data?.notified_at,
  }
}
