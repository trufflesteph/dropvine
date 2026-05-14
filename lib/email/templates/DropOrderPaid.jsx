import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, Italic, Divider, Detail, styles } from './_shared'

function money(cents) {
  if (cents == null) return '—'
  return `$${(Number(cents) / 100).toFixed(2)}`
}

// Sent when a maker / admin marks a pending pre-order or deposit as paid via
// the /admin/direct/orders page. Includes pickup details so the shopper knows
// what to expect next.
export function DropOrderPaid({ order, launch }) {
  const isDeposit = order?.collection_mode === 'deposit'
  const balanceLine = isDeposit && order?.balance_cents > 0
    ? `Balance of ${money(order.balance_cents)} is due at pickup.`
    : null

  return (
    <EmailShell preview={`Payment confirmed — ${launch?.title || 'your drop'} #${order.short_code}`}>
      <Eyebrow>{launch?.title || 'Dropvine Direct'} · Order #{order.short_code}</Eyebrow>
      <H1>Payment confirmed.</H1>
      <P>
        Your payment has been received. Your order <strong>{order.short_code}</strong> for{' '}
        <Italic>{launch?.title || 'this drop'}</Italic> is confirmed. See you at pickup!
      </P>

      <Divider />
      <Detail label="Order" value={`#${order.short_code}`} />
      <Detail label="Quantity" value={String(order.quantity)} />
      <Detail label={isDeposit ? 'Deposit paid' : 'Total paid'} value={money(isDeposit ? order.deposit_cents : order.total_cents)} />
      {balanceLine ? <Detail label="Balance at pickup" value={money(order.balance_cents)} /> : null}
      <Divider />

      <Section>
        <Text style={styles.eyebrow}>Pickup</Text>
        <Text style={{ ...styles.detailRow, margin: '0 0 4px' }}>
          {launch?.pickup_details || 'The maker will reach out with pickup details shortly.'}
        </Text>
      </Section>

      <Divider />
      <P muted>
        Questions about your order? Reply to this email and the maker will get back to you.
      </P>
    </EmailShell>
  )
}

export default DropOrderPaid
