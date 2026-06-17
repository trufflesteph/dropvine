import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, CTA, TextLink, Detail, Divider, Italic, BRAND } from './_shared'
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
    : 'Notifications are rolling out to your followers and the drop link is ready for you to share everywhere!'

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
        <strong>{title}</strong> is now published on Dropvine. {audienceLine}
      </P>
      {liveUrl ? (
        <Section style={{ margin: '16px 0 24px', padding: '14px 16px', backgroundColor: '#F0F0EC', border: `1px solid ${BRAND.border}` }}>
          <Text style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: BRAND.muted, fontWeight: 600, margin: '0 0 8px' }}>Drop link</Text>
          <a href={liveUrl} style={{ fontSize: '13px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', color: BRAND.fg, wordBreak: 'break-all', textDecoration: 'none', display: 'block' }}>{liveUrl}</a>
        </Section>
      ) : null}

      <Divider />
      <Eyebrow>Drop details</Eyebrow>
      <Detail label="Title" value={title} />
      {mode ? <Detail label="Mode" value={mode} /> : null}
      {closesAtLabel ? <Detail label="Closes" value={closesAtLabel} /> : null}
      <Divider />

      <CTA href={liveUrl}>View my live drop →</CTA>
      {dashboardUrl ? <TextLink href={dashboardUrl} style={{ margin: '24px 0 16px' }}>Open dashboard →</TextLink> : null}

      <P muted>
        <Italic>Orders, waitlist sign-ups, and reservations all show up in your dashboard in real time.</Italic>
      </P>

      <Divider />
      <P muted>Questions? Email <a href="mailto:hello@dropvine.pro" style={{ color: 'inherit' }}>hello@dropvine.pro</a></P>
    </EmailShell>
  )
}

export default DropPublishConfirmation
