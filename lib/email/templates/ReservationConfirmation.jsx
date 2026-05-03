import * as React from 'react'
import { EmailShell, H1, Eyebrow, P, Detail, Divider, CTA, Italic } from './_shared'

export function ReservationConfirmation({ launch, reservation, viewUrl }) {
  const opensAt = launch?.launch_at ? new Date(launch.launch_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : ''
  const amount = reservation?.amount_cents ? `$${(reservation.amount_cents / 100).toFixed(2)}` : '—'
  const sid = reservation?.stripe_session_id ? reservation.stripe_session_id.slice(0, 16) + '…' : '—'
  return (
    <EmailShell preview={`Reservation held for ${launch?.title || 'this launch'}.`}>
      <Eyebrow>Reservation confirmed</Eyebrow>
      <H1>Your slot is held.</H1>
      <P>
        Thank you. Your refundable hold has been received and your slot is reserved for <strong>{launch?.title}</strong>.
      </P>
      <Divider />
      <Detail label="Launch" value={launch?.title || '—'} />
      <Detail label="Opens" value={opensAt || '—'} />
      <Detail label="Hold" value={amount} />
      <Detail label="Reference" value={sid} />
      <Divider />
      <P>
        At release, you’ll have <Italic>24 hours</Italic> to complete checkout. If you choose not to,
        the hold is fully refunded.
      </P>
      {viewUrl && <CTA href={viewUrl}>View the launch page</CTA>}
    </EmailShell>
  )
}
export default ReservationConfirmation
