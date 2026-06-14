import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic } from './_shared'

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
        {subscriberName ? <>Hi {subscriberName} — </> : null}
        <strong>{business}</strong> just dropped something new. Check it out while it&rsquo;s fresh!
      </P>
      {closesAtLabel ? <P muted><Italic>Drop closes on {closesAtLabel}.</Italic></P> : null}
      {viewUrl && <CTA href={viewUrl}>View the drop →</CTA>}
    </EmailShell>
  )
}
export default DropOpened
