import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic, shopperFooter, customerListReason } from './_shared'

// 24h-pre-close last-call.
export function DropClosingSoon({ launch, subscriberName, viewUrl, closesAtLabel, vendorName, planTier, unsubscribeUrl }) {
  const title = launch?.title || 'A drop'
  return (
    <EmailShell
      preview={`Closes soon — ${title}`}
      planTier={planTier}
      footerLines={shopperFooter(customerListReason(vendorName || 'this maker'))}
      unsubscribeUrl={unsubscribeUrl}
      businessName={vendorName}
    >
      <Eyebrow>Last call</Eyebrow>
      <H1>Closes in 24 hours.</H1>
      <P>
        {subscriberName ? <>{subscriberName}, </> : null}
        <strong>{title}</strong> closes {closesAtLabel || 'tomorrow'}.
      </P>
      {launch?.tagline && <P muted><Italic>{launch.tagline}</Italic></P>}
      {viewUrl && <CTA href={viewUrl}>Order before it closes</CTA>}
    </EmailShell>
  )
}
export default DropClosingSoon
