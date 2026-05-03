import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic } from './_shared'

export function LaunchLive({ launch, viewUrl }) {
  return (
    <EmailShell preview={`${launch?.title || 'A launch'} is live.`}>
      <Eyebrow>Now open</Eyebrow>
      <H1>The doors are open.</H1>
      <P>
        <strong>{launch?.title}</strong> is now live. Step in while it lasts.
      </P>
      {launch?.tagline && <P muted><Italic>{launch.tagline}</Italic></P>}
      {viewUrl && <CTA href={viewUrl}>Enter the drop</CTA>}
    </EmailShell>
  )
}
export default LaunchLive
