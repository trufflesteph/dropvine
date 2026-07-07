import * as React from 'react'
import { Img, Section } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, Italic } from './_shared'

// Shopper-facing fan-out email when a drop opens. Sent by the cron at
// `notify_at` to every drop_subscriber. NEVER sent directly from the
// publish endpoint (Round 2 Fix 8).
//
// Props:
//   launch          — the drop row (title, closes_at, etc.)
//   subscriberName  — string | null (used for greeting)
//   viewUrl         — absolute URL to /l/[handle]
//   vendorName      — vendor business_name from direct_vendors (used in copy + footer)
//   planTier        — passed through for watermark gating
export function DropOpened({ launch, subscriberName, viewUrl, vendorName, planTier }) {
  const title = launch?.title || 'A drop'
  const business = vendorName || 'this maker'
  const closesAtLabel = launch?.closes_at
    ? new Date(launch.closes_at).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null
  return (
    <EmailShell
      preview={`Just dropped — ${title}`}
      planTier={planTier}
      footerLines={[
        `You're receiving this email because you follow ${business} on Dropvine.`,
        'Dropvine — fresh drops daily',
      ]}
    >
      <Eyebrow>Now open</Eyebrow>
      <H1>Just dropped — {title}</H1>
      <P>
        {subscriberName ? <>Hi {subscriberName}, </> : null}
        <strong>{business}</strong> just dropped something new.
      </P>
      <P>This one won&apos;t last long.</P>
      {launch?.cover_url ? (
        <Img
          src={launch.cover_url}
          alt={title}
          width="560"
          style={{ width: '100%', maxWidth: '560px', height: 'auto', display: 'block', margin: '24px 0 0', border: '1px solid #E5E5E0' }}
        />
      ) : null}
      {launch?.description ? (
        <P style={{ marginTop: '16px', whiteSpace: 'pre-line' }}>{launch.description}</P>
      ) : null}
      {closesAtLabel ? <P muted><Italic>Drop closes on {closesAtLabel}.</Italic></P> : null}
      {viewUrl && (
        <Section style={{ margin: '40px 0 48px' }}>
          <a
            href={viewUrl}
            style={{
              backgroundColor: '#2D4A2A',
              color: '#ffffff',
              border: '14px solid #2D4A2A',
              borderRadius: '2px',
              textDecoration: 'none',
              fontSize: '14px',
              fontFamily: 'sans-serif',
              fontWeight: 500,
              display: 'inline-block',
            }}
          >
            View the drop →
          </a>
        </Section>
      )}
    </EmailShell>
  )
}
export default DropOpened
