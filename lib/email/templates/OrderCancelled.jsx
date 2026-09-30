import * as React from 'react'
import { EmailShell, H1, Eyebrow, P } from './_shared'

// Sent to the shopper when the vendor cancels their pre-order / deposit order
// from the dashboard Orders page. Dropvine never holds the money, so any
// refund is between the shopper and the maker.
export function OrderCancelled({ order, launch, vendorName, planTier }) {
  const title = launch?.title || 'your drop'
  const business = vendorName || 'The maker'
  return (
    <EmailShell preview={`Order #${order.short_code} cancelled: ${title}`} planTier={planTier}>
      <Eyebrow>{[vendorName, `Order #${order.short_code}`].filter(Boolean).join(' · ')}</Eyebrow>
      <H1>Order cancelled.</H1>
      <P>
        {business} cancelled your order #{order.short_code} for {title}. If you already paid,
        contact {vendorName || 'the maker'} directly about a refund.
      </P>
    </EmailShell>
  )
}

export default OrderCancelled
