// Notification orchestrator — modular layer so SMS / push can be added later
// without touching call sites. Each lifecycle event calls one or more channels.
//
// To add a new channel (e.g. Twilio SMS):
//   1. Create lib/notifications/channels/sms.js with the same 5 named functions
//   2. Import + register it below in `channels`
//   3. (Optional) add per-recipient channel preferences from a `profiles.notification_channels` field
//
// All functions are SAFE to await or fire-and-forget — never throw upstream.

import {
  sendWaitlistConfirmation as emailWaitlist,
  sendReservationConfirmation as emailReservation,
  sendLaunchReminder as emailReminder,
  sendLaunchLiveNotification as emailLive,
  sendSoldOutNotification as emailSoldOut,
} from '@/lib/email/notifications'

// Channel registry — drop in another channel object with same surface area
const channels = {
  email: {
    waitlistConfirmation: emailWaitlist,
    reservationConfirmation: emailReservation,
    launchReminder: emailReminder,
    launchLive: emailLive,
    soldOut: emailSoldOut,
  },
  // sms:  { ... },  // Twilio later
  // push: { ... },  // Web Push / FCM later
}

const DEFAULT_CHANNELS = ['email']

async function dispatch(kind, payload, channelList = DEFAULT_CHANNELS) {
  const results = []
  for (const ch of channelList) {
    const fn = channels[ch]?.[kind]
    if (!fn) continue
    try {
      const r = await fn(payload)
      results.push({ channel: ch, ...(r || {}) })
    } catch (e) {
      results.push({ channel: ch, error: e?.message || String(e) })
    }
  }
  return results
}

// Public lifecycle functions
export const notifyWaitlistConfirmed     = (payload, ch) => dispatch('waitlistConfirmation',     payload, ch)
export const notifyReservationConfirmed  = (payload, ch) => dispatch('reservationConfirmation',  payload, ch)
export const notifyLaunchReminder        = (payload, ch) => dispatch('launchReminder',           payload, ch)
export const notifyLaunchLive            = (payload, ch) => dispatch('launchLive',               payload, ch)
export const notifySoldOut               = (payload, ch) => dispatch('soldOut',                  payload, ch)
