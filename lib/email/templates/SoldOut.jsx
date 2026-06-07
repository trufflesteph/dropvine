import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, Detail, Divider, CTA, Italic } from './_shared'

export function SoldOut({ launch, capacity, dashboardUrl, planTier }) {
  return (
    <EmailShell preview={`${launch?.title || 'A launch'} is fully reserved.`} planTier={planTier}>
      <Eyebrow>Studio update</Eyebrow>
      <H1><Italic>Sold out.</Italic></H1>
      <P>
        All <strong>{capacity}</strong> reserved slots for <strong>{launch?.title}</strong> are now held.
        New visitors will see the page in sold-out state until you adjust capacity or release holds.
      </P>
      <Divider />
      <Detail label="Launch" value={launch?.title || '—'} />
      <Detail label="Capacity" value={String(capacity)} />
      <Detail label="Held" value={`${capacity} of ${capacity}`} />
      {dashboardUrl && <CTA href={dashboardUrl}>Open studio</CTA>}
    </EmailShell>
  )
}
export default SoldOut
