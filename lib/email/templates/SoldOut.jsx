import * as React from 'react'
import { EmailShell, H1, P, CTA, Italic, vendorFooter } from './_shared'

// Vendor-facing: sent once when a pre-order / deposit drop sells out (see
// lib/orders/sold-out.js). orders / paid / unpaid are the drop's current
// order counts (cancelled and refunded orders excluded).
export function SoldOut({ launch, orders, paid, unpaid, dashboardUrl, planTier }) {
  const title = launch?.title || 'Your drop'
  return (
    <EmailShell
      preview={`Sold out: ${title}`}
      planTier={planTier}
      footerLines={vendorFooter("You're receiving this email because your drop on Dropvine sold out.")}
    >
      <H1><Italic>Sold out.</Italic></H1>
      <P>
        Every item in <strong>{title}</strong> is spoken for. {orders} {orders === 1 ? 'order' : 'orders'}, {paid} paid, {unpaid} waiting on payment.
      </P>
      {dashboardUrl && <CTA href={dashboardUrl}>See your orders →</CTA>}
    </EmailShell>
  )
}
export default SoldOut
