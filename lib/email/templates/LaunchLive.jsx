import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic, shopperFooter, waitlistReason } from './_shared'

export function LaunchLive({ launch, drop, viewUrl, planTier, vendorName, unsubscribeUrl }) {
  const source = launch || drop
  const isAnnouncement = source?.collection_mode === 'announcement'
  return (
    <EmailShell
      preview={`${source?.title || 'A launch'} is live.`}
      planTier={planTier}
      footerLines={shopperFooter(waitlistReason(source?.title || 'this drop'))}
      unsubscribeUrl={unsubscribeUrl}
      businessName={vendorName}
    >
      <Eyebrow>{isAnnouncement ? 'Hey there' : 'Open now'}</Eyebrow>
      <H1>{isAnnouncement ? 'This message is for you.' : 'Take a look below.'}</H1>
      <P>
        <strong>{source?.title}</strong> is now live. Step in while it lasts.
      </P>
      {source?.tagline && <P muted><Italic>{source.tagline}</Italic></P>}
      {viewUrl && <CTA href={viewUrl}>Enter the drop</CTA>}
    </EmailShell>
  )
}
export default LaunchLive
