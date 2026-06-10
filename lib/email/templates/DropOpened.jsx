import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Italic } from './_shared'

// Shopper-facing fan-out email when a drop opens. Sent by the cron at
// `notify_at` to every drop_subscriber. NEVER sent directly from the
// publish endpoint (Round 2 Fix 8).
//
// Round 2 changes:
//   • Fix 10 — footer line 1 references the vendor's business name
//   • Fix 11 — body copy now reads "This one won't last long."
//   • Fix 16 — footer line 2 is "Dropvine — your sales engine"
//
// Props:
//   launch          — the drop row
//   subscriberName  — string | null (used for greeting)
//   viewUrl         — absolute URL to /l/[handle]
//   vendorName      — vendor business_name from direct_vendors (used in footer)
//   planTier        — passed through for watermark gating
export function DropOpened({ launch, subscriberName, viewUrl, vendorName, planTier }) {
  const title = launch?.title || 'A drop'
  const business = vendorName || 'this maker'
  return (
    <EmailShell
      preview={`${title} is open.`}
      planTier={planTier}
      footerLines={[
        `You're receiving this email because you follow ${business} on Dropvine.`,
        'Dropvine — your sales engine',
      ]}
    >
      <Eyebrow>Now open</Eyebrow>
      <H1>The doors are open.</H1>
      <P>
        {subscriberName ? <>Hi {subscriberName} — </> : null}
        <strong>{title}</strong> is now live. This one won&rsquo;t last long.
      </P>
      {launch?.tagline && <P muted><Italic>{launch.tagline}</Italic></P>}
      {viewUrl && <CTA href={viewUrl}>View the drop →</CTA>}
    </EmailShell>
  )
}
export default DropOpened
