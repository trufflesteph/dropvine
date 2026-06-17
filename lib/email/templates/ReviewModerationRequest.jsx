import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, Italic, Divider, Detail, styles } from './_shared'

// Sent to PLATFORM_OWNER_EMAIL right after a shopper submits their review.
// Two prominent CTAs — Approve + Reject — each links to the one-shot
// moderation endpoint at /api/reviews/moderate/[token].
//
// Watermark is intentionally suppressed for these internal-ops emails by
// passing planTier='shop' (the EmailShell hides the watermark for shop tier).
export function ReviewModerationRequest({
  vendorName,
  dropTitle,
  reviewerName,
  reviewerEmail,
  rating,
  comment,
  approveUrl,
  rejectUrl,
}) {
  const stars = '★'.repeat(Math.max(1, Math.min(5, rating || 0))) + '☆'.repeat(5 - Math.max(1, Math.min(5, rating || 0)))
  return (
    <EmailShell preview={`New review pending — ${vendorName || 'a maker'}`} planTier="shop">
      <Eyebrow>Pending review</Eyebrow>
      <H1>New review pending — {vendorName || 'a maker'}</H1>
      <P>
        A shopper just submitted a review for <strong>{vendorName || 'a maker'}</strong>
        {dropTitle ? <> on <em>{dropTitle}</em></> : null}.
      </P>
      <Divider />
      <Detail label="Reviewer">{reviewerName || '—'} {reviewerEmail ? <span style={{ color: '#777' }}>· {reviewerEmail}</span> : null}</Detail>
      <Detail label="Rating">
        <span style={{ fontSize: 18, letterSpacing: 2 }}>{stars}</span> <span style={{ color: '#777' }}>({rating || '—'}/5)</span>
      </Detail>
      {comment ? (
        <Detail label="Comment">
          <span style={{ whiteSpace: 'pre-wrap' }}>{comment}</span>
        </Detail>
      ) : (
        <Detail label="Comment"><Italic>No comment left.</Italic></Detail>
      )}
      <Divider />
      <P>Review will only appear publicly after approval.</P>
      <Section style={{ marginTop: 20, marginBottom: 16 }}>
        <table cellPadding={0} cellSpacing={0} border={0}>
          <tr>
            <td style={{ paddingRight: 12 }}>
              <a
                href={approveUrl}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#2D4A2A',
                  color: '#FAFAF7',
                  border: '12px solid #2D4A2A',
                  borderRadius: '2px',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontFamily: 'sans-serif',
                  fontWeight: 500,
                }}
              >
                ✓ Approve review
              </a>
            </td>
            <td>
              <a
                href={rejectUrl}
                style={{
                  display: 'inline-block',
                  backgroundColor: 'transparent',
                  color: '#1F1F1B',
                  border: '12px solid #6B6863',
                  borderRadius: '2px',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontFamily: 'sans-serif',
                  fontWeight: 500,
                }}
              >
                ✗ Reject review
              </a>
            </td>
          </tr>
        </table>
      </Section>
      <Detail label="Heads up">Each link works only once and expires in 30 days.</Detail>
    </EmailShell>
  )
}

export default ReviewModerationRequest
