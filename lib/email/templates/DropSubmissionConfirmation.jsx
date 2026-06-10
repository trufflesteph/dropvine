import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, CTA, Detail, Divider, Italic, ProductLine } from './_shared'
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
// Round 2 — added Description + Products sections (Fix 15), title-case the
// collection mode label (Fix 21 R1), proper detail-row spacing (Fix 13),
// solid green Publish button (Fix 14), and "your sales engine" footer (Fix 16).
//
// Props:
//   launch          — the drop row
//   publishAction   — 'publish' | 'schedule'
//   previewUrl      — absolute https URL to /l/[handle]?preview=true
//   confirmUrl      — absolute https URL to /api/launches/publish/[token]
//   launchAtLabel   — string already formatted for display
//   closesAtLabel   — string already formatted for display
//   products        — array of {name, description, price_cents} (may be empty)
//   description     — drop body description (optional)
//   planTier        — vendor plan tier (used for watermark gate)
export function DropSubmissionConfirmation({
  launch,
  publishAction,
  previewUrl,
  confirmUrl,
  launchAtLabel,
  closesAtLabel,
  products,
  description,
  planTier,
}) {
  const isSchedule = publishAction === 'schedule'
  const title = launch?.title || 'Your drop'
  const mode = launch?.collection_mode ? formatCollectionMode(launch.collection_mode) : null
  const price = launch?.price_cents ? `$${(Number(launch.price_cents) / 100).toFixed(2)}` : null
  const capacity = launch?.capacity || null
  const previewSubject = isSchedule
    ? `Your drop is ready to preview — goes live ${launchAtLabel || 'on schedule'}`
    : `Your drop is ready to preview — ${title}`
  const hasProducts = Array.isArray(products) && products.length > 0
  const bodyText = description && String(description).trim().length ? String(description).trim() : null

  return (
    <EmailShell
      preview={previewSubject}
      planTier={planTier}
      footerLines={[
        "You're receiving this email because you submitted a drop on Dropvine.",
        'Dropvine — your sales engine',
      ]}
    >
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

      {bodyText ? (
        <>
          <Divider />
          <Eyebrow>Description</Eyebrow>
          <P>{bodyText}</P>
        </>
      ) : null}

      {hasProducts ? (
        <>
          <Divider />
          <Eyebrow>Products ({products.length})</Eyebrow>
          {products.map((p, i) => (
            <ProductLine
              key={p.id || i}
              name={p.name}
              description={p.description}
              priceCents={p.price_cents}
            />
          ))}
        </>
      ) : null}

      <Divider />

      <CTA href={previewUrl} ghost>Preview your drop →</CTA>
      <CTA href={confirmUrl}>{isSchedule ? 'Schedule my drop →' : 'Publish my drop →'}</CTA>

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
