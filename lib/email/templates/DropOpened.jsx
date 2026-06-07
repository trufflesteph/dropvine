import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic } from './_shared'

// Fan-out email when a drop opens. Sent once per (launch, subscriber).
export function DropOpened({ launch, subscriberName, viewUrl, planTier }) {
  const title = launch?.title || 'A drop'
  return (
    <EmailShell preview={`${title} is open.`} planTier={planTier}>
      <Eyebrow>Now open</Eyebrow>
      <H1>The doors are open.</H1>
      <P>
        {subscriberName ? <>Hi {subscriberName} — </> : null}
        <strong>{title}</strong> is now live. Step in while it lasts.
      </P>
      {launch?.tagline && <P muted><Italic>{launch.tagline}</Italic></P>}
      {viewUrl && <CTA href={viewUrl}>Enter the drop</CTA>}
    </EmailShell>
  )
}
export default DropOpened
