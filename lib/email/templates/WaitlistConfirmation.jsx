import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Divider, Italic } from './_shared'

export function WaitlistConfirmation({ launch, name, viewUrl }) {
  const greeting = name ? `${name},` : 'You’re on the list.'
  const opensAt = launch?.launch_at ? new Date(launch.launch_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : ''
  return (
    <EmailShell preview={`You're on the waitlist for ${launch?.title || 'this launch'}.`}>
      <Eyebrow>Waitlist confirmed</Eyebrow>
      <H1>{greeting}</H1>
      <P>
        You’re on the list for <strong>{launch?.title}</strong>. We’ll notify you the moment the doors open
        {opensAt ? <> on <Italic>{opensAt}</Italic>.</> : '.'}
      </P>
      {launch?.tagline && <P muted>“{launch.tagline}”</P>}
      {viewUrl && <CTA href={viewUrl} ghost>View the launch page</CTA>}
      <Divider />
      <P muted>
        We’ll send a single reminder before the drop, then notify you when it’s live. No marketing.
      </P>
    </EmailShell>
  )
}
export default WaitlistConfirmation
