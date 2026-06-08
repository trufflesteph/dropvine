import * as React from 'react'
import { Section } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, CTA, Divider, Detail } from './_shared'

// Sent to the shopper right after their order is marked fulfilled.
// Single CTA → /review/[review_id] (a lightweight web form, since rich
// forms inside emails are unreliable across clients). The web form posts
// the rating + comment back to /api/reviews/submit.
export function ReviewRequest({ reviewerName, vendorName, dropTitle, reviewUrl, planTier }) {
  return (
    <EmailShell preview={`How was your order from ${vendorName || 'this maker'}?`} planTier={planTier}>
      <Eyebrow>Order received</Eyebrow>
      <H1>How was it?</H1>
      <P>
        {reviewerName ? `Hi ${reviewerName.split(' ')[0]} — ` : 'Hi — '}
        thanks for your order from <strong>{vendorName || 'this maker'}</strong>
        {dropTitle ? <> (<em>{dropTitle}</em>)</> : null}. We'd love to hear how it went.
      </P>
      <P>
        It only takes 30 seconds. Your review will appear on {vendorName || 'their'} profile after a quick check.
      </P>
      <Section style={{ marginTop: 24, marginBottom: 16 }}>
        <CTA href={reviewUrl}>Tell us how it went →</CTA>
      </Section>
      <Divider />
      <Detail label="Want to be private?">
        You can leave a rating without writing anything. We'll never publish your full last name.
      </Detail>
    </EmailShell>
  )
}

export default ReviewRequest
