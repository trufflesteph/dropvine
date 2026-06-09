import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Detail, Divider, Italic } from './_shared'
import { formatCollectionMode } from '@/lib/markets/tally'

// Vendor-facing email sent immediately after a Tally submission lands. Two
// variants depending on publish_action:
//
//   • 'publish'  — the drop will go live as soon as the vendor confirms.
//                  Banner copy + secondary CTA say "Publish my drop".
//   • 'schedule' — the drop will publish automatically at launch_at, but the
//                  vendor must still confirm the schedule (so they have a
//                  preview gate before broadcast). Secondary CTA says
//                  "Schedule my drop".
//
// Props:
//   launch          — the launch row (title, handle, price_cents, capacity,
//                     collection_mode, launch_at, closes_at)
//   publishAction   — 'publish' | 'schedule'
//   previewUrl      — absolute https URL to /l/[handle]?preview=true
//   confirmUrl      — absolute https URL to /api/launches/publish/[token]
export function DropSubmissionConfirmation({ launch, publishAction, previewUrl, confirmUrl, launchAtLabel, closesAtLabel, planTier }) {
  const isSchedule = publishAction === 'schedule'
  const title = launch?.title || 'Your drop'
  // Fix 21 — render the collection mode as a human-readable title-case label
  // ("Pre-order", "Waitlist", "Reservation", "Deposit") instead of the raw
  // Tally option UUID. Safe even when the value already happens to be a
  // label thanks to the normalisation done inside formatCollectionMode().
  const mode = launch?.collection_mode ? formatCollectionMode(launch.collection_mode) : null
  const price = launch?.price_cents != null ? `$${(Number(launch.price_cents) / 100).toFixed(2)}` : null
  const capacity = launch?.capacity || null
  const previewSubject = isSchedule
    ? `Your drop is ready to preview — goes live ${launchAtLabel || 'on schedule'}`
    : `Your drop is ready to preview — ${title}`

  return (
    <EmailShell preview={previewSubject} planTier={planTier}>
      <Eyebrow>Submission received</Eyebrow>
      <H1>Your drop is ready to preview.</H1>
      <P>
        Your drop has been submitted successfully. {isSchedule
          ? <>It will go live automatically on <strong>{launchAtLabel}</strong> once you schedule it below.</>
          : <>Review your drop page carefully before publishing. Once live, customers can place orders immediately.</>}
      </P>

      <Divider />
      <Eyebrow>Drop details</Eyebrow>
      <Detail label="Title" value={title} />
      {mode ? <Detail label="Collection mode" value={mode} /> : null}
      {price ? <Detail label="Price" value={price} /> : null}
      {capacity ? <Detail label="Capacity" value={String(capacity)} /> : null}
      {launchAtLabel ? <Detail label="Opens" value={launchAtLabel} /> : null}
      {closesAtLabel ? <Detail label="Closes" value={closesAtLabel} /> : null}
      <Divider />

      <CTA href={previewUrl}>Preview your drop →</CTA>
      {/* Secondary CTA — same destination URL, label depends on action. */}
      <CTA href={confirmUrl} ghost>{isSchedule ? 'Schedule my drop →' : 'Publish my drop →'}</CTA>

      {isSchedule ? (
        <P muted>
          <Italic>Once scheduled, your drop will go live automatically on {launchAtLabel}. No further action needed after scheduling.</Italic>
        </P>
      ) : (
        <P muted>
          <Italic>Review your drop page carefully before publishing. Once live, customers can place orders immediately.</Italic>
        </P>
      )}

      <Divider />
      <P muted>Questions? Email <a href="mailto:hello@dropvine.pro" style={{ color: 'inherit' }}>hello@dropvine.pro</a></P>
    </EmailShell>
  )
}

export default DropSubmissionConfirmation
