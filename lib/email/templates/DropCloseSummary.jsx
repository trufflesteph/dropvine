import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic } from './_shared'

// Vendor recap email sent after a drop closes. Summarises orders + revenue.
export function DropCloseSummary({ launch, totalOrders, totalCents, paidOrders, dashboardUrl }) {
  const title = launch?.title || 'Your drop'
  const totalDollars = ((totalCents || 0) / 100).toFixed(2)
  return (
    <EmailShell preview={`${title} — drop summary`}>
      <Eyebrow>Drop closed</Eyebrow>
      <H1>Your drop is wrapped.</H1>
      <P><strong>{title}</strong> just closed. Here’s the recap:</P>
      <P>
        <strong>{totalOrders || 0}</strong> total order{totalOrders === 1 ? '' : 's'}<br />
        <strong>{paidOrders || 0}</strong> paid<br />
        <strong>${totalDollars}</strong> in committed revenue
      </P>
      <P muted><Italic>Detailed line items and fulfilment status live in your dashboard.</Italic></P>
      {dashboardUrl && <CTA href={dashboardUrl}>Open dashboard</CTA>}
    </EmailShell>
  )
}
export default DropCloseSummary
