import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic, Divider } from './_shared'

export function LaunchReminder({ launch, viewUrl, hoursUntil }) {
  const opensAt = launch?.launch_at ? new Date(launch.launch_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : ''
  const headline = hoursUntil && hoursUntil <= 1 ? 'Opening shortly.' : (hoursUntil && hoursUntil < 24 ? 'Opening today.' : 'Opening soon.')
  return (
    <EmailShell preview={`${launch?.title || 'A launch'} opens ${opensAt ? `on ${opensAt}` : 'soon'}.`}>
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
