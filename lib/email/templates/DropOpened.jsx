import * as React from 'react'
import { Img, Section } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, Italic, shopperFooter, customerListReason } from './_shared'
import { formatEmailDateTime } from '../format'

// Shopper-facing fan-out email when a drop opens. Sent by the cron at
// `notify_at` to every drop_subscriber. NEVER sent directly from the
// publish endpoint (Round 2 Fix 8).
//
// Props:
//   launch          — the drop row (title, closes_at, pickup_details, collection_mode, etc.)
//   subscriberName  — string | null (used for greeting)
//   viewUrl         — absolute URL to /l/[handle]
//   vendorName      — vendor business_name from direct_vendors (used in copy + footer)
//   planTier        — passed through for watermark gating
//   unsubscribeUrl  — signed /unsubscribe link for this recipient (footer)

// Button label by collection mode. Unknown or missing modes fall back to
// waitlist, matching the drop page's own default.
const CTA_LABELS = {
  'pre-order': 'Pre-order now →',
  deposit: 'Pre-order now →',
  waitlist: 'Join the waitlist →',
  reservation: 'Reserve your spot →',
  announcement: 'See the update →',
}
export function dropOpenedCtaLabel(collectionMode) {
  return CTA_LABELS[String(collectionMode || '').toLowerCase().trim()] || CTA_LABELS.waitlist
}

// Preview (preheader): close time + pickup, or the "won't last" line when
// the drop has no close time.
export function dropOpenedPreview(launch) {
  const closesAtLabel = formatEmailDateTime(launch?.closes_at)
  const lead = closesAtLabel ? `Orders close ${closesAtLabel}.` : 'This one won’t last long.'
  const pickup = launch?.pickup_details ? String(launch.pickup_details).trim() : ''
  return pickup ? `${lead} Pickup: ${pickup}` : lead
}

export function DropOpened({ launch, subscriberName, viewUrl, vendorName, planTier, unsubscribeUrl }) {
  const title = launch?.title || 'A drop'
  const business = vendorName || 'this maker'
  const closesAtLabel = formatEmailDateTime(launch?.closes_at)
  const pickup = launch?.pickup_details ? String(launch.pickup_details).trim() : ''
  return (
    <EmailShell
      preview={dropOpenedPreview(launch)}
      planTier={planTier}
      footerLines={shopperFooter(customerListReason(business))}
      unsubscribeUrl={unsubscribeUrl}
      businessName={vendorName}
    >
      {/* Eyebrow style uppercases this: "NOW OPEN · {BUSINESS NAME}". */}
      <Eyebrow>{vendorName ? `Now open · ${vendorName}` : 'Now open'}</Eyebrow>
      <H1>{title}</H1>
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
      {pickup ? <P muted style={{ whiteSpace: 'pre-line' }}>Pickup: {pickup}</P> : null}
      {viewUrl && (
        <Section style={{ margin: '40px 0 48px' }}>
          {/* Background on a table cell so the button's left edge sits on the
              content edge in every client, not just where inline-block
              anchors are laid out consistently. */}
          <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td bgcolor="#2D4A2A" style={{ backgroundColor: '#2D4A2A', borderRadius: '2px', padding: 0 }}>
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
                    {dropOpenedCtaLabel(launch?.collection_mode)}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}
    </EmailShell>
  )
}
export default DropOpened
