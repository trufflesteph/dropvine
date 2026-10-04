import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic, shopperFooter, customerListReason } from './_shared'

// +5 day mid-window reminder. Sent to subscribers who haven't ordered yet.
export function DropStillOpen({ launch, subscriberName, viewUrl, closesAtLabel, vendorName, planTier, unsubscribeUrl }) {
  const title = launch?.title || 'A drop'
  return (
    <EmailShell
      preview={`Still time — ${title}`}
      planTier={planTier}
      footerLines={shopperFooter(customerListReason(vendorName || 'this maker'))}
      unsubscribeUrl={unsubscribeUrl}
      businessName={vendorName}
    >
      <Eyebrow>Still open</Eyebrow>
      <H1>Still time to order.</H1>
      <P>
        {subscriberName ? <>Hey {subscriberName} — </> : null}
        <strong>{title}</strong> is still open.
        {closesAtLabel ? <> Orders close {closesAtLabel}.</> : null}
      </P>
      {launch?.tagline && <P muted><Italic>{launch.tagline}</Italic></P>}
      {viewUrl && <CTA href={viewUrl}>Place your order</CTA>}
    </EmailShell>
  )
}
export default DropStillOpen
