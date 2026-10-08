import * as React from 'react'
import { EmailShell, P, vendorFooter } from './_shared'

// Sent once to someone who joins the Premium Shop Annual waitlist on the
// homepage (POST /api/premium-waitlist), only for a new sign-up. Transactional:
// no unsubscribe link; EmailShell adds the mailing address. planTier='shop'
// hides the "Powered by Dropvine" watermark on this Dropvine-to-vendor email.
export function PremiumWaitlistConfirmation({ firstName, price }) {
  const body = `Thanks, ${firstName}. You're on the waitlist for Premium Shop Annual. We'll email you when spots open, with launch pricing of ${price} a year through December 31.`
  return (
    <EmailShell
      preview={body}
      planTier="shop"
      footerLines={vendorFooter("You're getting this because you joined the Premium Shop Annual waitlist on Dropvine.")}
    >
      <P>{body}</P>
    </EmailShell>
  )
}
export default PremiumWaitlistConfirmation
