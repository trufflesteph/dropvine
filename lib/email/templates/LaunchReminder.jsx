import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic, Divider, shopperFooter, waitlistReason } from './_shared'
import { formatEmailDateTime } from '../format'

export function LaunchReminder({ launch, viewUrl, hoursUntil, planTier, vendorName, unsubscribeUrl }) {
  const opensAt = formatEmailDateTime(launch?.launch_at) || ''
  const headline = hoursUntil && hoursUntil <= 1 ? 'Opening shortly.' : (hoursUntil && hoursUntil < 24 ? 'Opening today.' : 'Opening soon.')
  return (
    <EmailShell
      preview={`${launch?.title || 'A launch'} opens ${opensAt ? `on ${opensAt}` : 'soon'}.`}
      planTier={planTier}
      footerLines={shopperFooter(waitlistReason(launch?.title || 'this drop'))}
      unsubscribeUrl={unsubscribeUrl}
      businessName={vendorName}
    >
      <Eyebrow>A reminder</Eyebrow>
      <H1>{headline}</H1>
      <P>
        <strong>{launch?.title}</strong> opens on <Italic>{opensAt}</Italic>. Your spot on the waitlist is
        ready — we’ll send one final note when the doors are live.
      </P>
      {launch?.tagline && <P muted>“{launch.tagline}”</P>}
      {viewUrl && <CTA href={viewUrl} ghost>Open the launch page</CTA>}
    </EmailShell>
  )
}
export default LaunchReminder
