import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, TextLink, Detail, Divider, Italic } from './_shared'
import { formatCollectionMode } from '@/lib/markets/tally'

// Vendor-facing "Your drop is live" confirmation sent the moment the vendor
// clicks "Publish my drop →" in the preview email. Fires from
// /api/launches/publish/[token] right after the drop row flips to
// status='published'.
//
// Props:
//   launch          — the drop row (title, handle, price_cents, capacity,
//                     collection_mode, launch_at, closes_at)
//   liveUrl         — absolute https URL to /l/[handle]
//   dashboardUrl    — absolute https URL to /dashboard
//   audienceCount   — number of contacts the announcement was fanned out to
export function DropPublishConfirmation({ launch, liveUrl, dashboardUrl, audienceCount, planTier }) {
  const title = launch?.title || 'Your drop'
  const mode = launch?.collection_mode ? formatCollectionMode(launch.collection_mode) : null
  const closesAtLabel = launch?.closes_at
    ? new Date(launch.closes_at).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null
  const audienceLine = audienceCount > 0
    ? `We've sent the launch announcement to ${audienceCount} ${audienceCount === 1 ? 'contact' : 'contacts'} on your list.`
    : 'Your drop page is now public. Share the link with your audience to start collecting orders.'

  return (
    <EmailShell
      preview={`Your drop is live — ${title}`}
      planTier={planTier}
      footerLines={[
        "You're receiving this email because you submitted a drop on Dropvine.",
        'Dropvine — your sales engine',
      ]}
    >
      <Eyebrow>Drop published</Eyebrow>
      <H1>Your drop is live.</H1>
      <P>
        <strong>{title}</strong> is now public on Dropvine. {audienceLine}
      </P>

      <Divider />
      <Eyebrow>Drop details</Eyebrow>
      <Detail label="Title" value={title} />
      {mode ? <Detail label="Mode" value={mode} /> : null}
      {closesAtLabel ? <Detail label="Closes" value={closesAtLabel} /> : null}
      <Divider />

      <CTA href={liveUrl}>View my live drop →</CTA>
      {dashboardUrl ? <TextLink href={dashboardUrl}>Open dashboard →</TextLink> : null}

      <P muted>
        <Italic>Orders, waitlist sign-ups, and reservations all show up in your dashboard in real time.</Italic>
      </P>

      <Divider />
      <P muted>Questions? Email <a href="mailto:hello@dropvine.pro" style={{ color: 'inherit' }}>hello@dropvine.pro</a></P>
    </EmailShell>
  )
}

export default DropPublishConfirmation
