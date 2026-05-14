// Notification orchestrator — modular layer so SMS / push can be added later
// without touching call sites. Each lifecycle event calls one or more channels.
//
// To add a new channel:
//   1. Create lib/notifications/channels/<name>.js exporting the same named
//      lifecycle functions (or a subset — missing functions are no-ops).
//   2. Import + register it below in `channels`.
//   3. (Optional) add per-recipient channel preferences via the caller
//      passing an explicit `channelList` (e.g. ['email','sms']) to the
//      lifecycle helper.
//
// All functions are SAFE to await or fire-and-forget — never throw upstream.

import {
  sendWaitlistConfirmation as emailWaitlist,
  sendReservationConfirmation as emailReservation,
  sendLaunchReminder as emailReminder,
  sendLaunchLiveNotification as emailLive,
  sendSoldOutNotification as emailSoldOut,
  sendMarketOrderConfirmation as emailMarketOrder,
  sendMarketFulfillmentMagicLink as emailMarketFulfillment,
} from '@/lib/email/notifications'

import {
  sendWaitlistConfirmation as smsWaitlist,
  sendReservationConfirmation as smsReservation,
  sendLaunchReminder as smsReminder,
  sendLaunchLiveNotification as smsLive,
  sendSoldOutNotification as smsSoldOut,
  sendMarketOrderConfirmation as smsMarketOrder,
  sendMarketFulfillmentMagicLink as smsMarketFulfillment,
  sendMarketDayReminder as smsMarketDayReminder,
  sendGeneric as smsGeneric,
  smsEnabled,
} from '@/lib/notifications/channels/sms'

// Channel registry — drop in another channel object with same surface area
const channels = {
  email: {
    waitlistConfirmation: emailWaitlist,
    reservationConfirmation: emailReservation,
    launchReminder: emailReminder,
    launchLive: emailLive,
    soldOut: emailSoldOut,
    marketOrderConfirmation: emailMarketOrder,
    marketFulfillmentMagicLink: emailMarketFulfillment,
  },
  sms: {
    waitlistConfirmation: smsWaitlist,
    reservationConfirmation: smsReservation,
    launchReminder: smsReminder,
    launchLive: smsLive,
    soldOut: smsSoldOut,
    marketOrderConfirmation: smsMarketOrder,
    marketFulfillmentMagicLink: smsMarketFulfillment,
    marketDayReminder: smsMarketDayReminder,
    generic: smsGeneric,
  },
  // push: { ... },  // Web Push handled inline by lib/markets/web-push-server for now
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
export const notifyMarketOrderPlaced     = (payload, ch) => dispatch('marketOrderConfirmation',  payload, ch)
export const notifyMarketVendorOrderArrived = (payload, ch) => dispatch('marketFulfillmentMagicLink', payload, ch)
export const notifyMarketDayReminder     = (payload, ch) => dispatch('marketDayReminder',        payload, ch ?? ['sms'])
export const notifyGeneric               = (payload, ch) => dispatch('generic',                  payload, ch ?? ['sms'])

// Channel feature flags (used by UI / cron to decide whether to bother)
export const channelStatus = () => ({
  email: true,
  sms: smsEnabled(),
})
