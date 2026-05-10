import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, Italic, Divider, CTA, Detail, styles } from './_shared'

function money(cents) { return `$${((cents || 0) / 100).toFixed(2)}` }

export function MarketOrderConfirmation({ order, vendor, items = [], venmoUrl, marketName }) {
  return (
    <EmailShell preview={`Order #${order.short_code} — send via Venmo to complete`}>
      <Eyebrow>{marketName || 'Dropvine Markets'} · Order #{order.short_code}</Eyebrow>
      <H1>Almost there — send Venmo to confirm.</H1>
      <P>
        Thanks for pre-ordering from <Italic>{vendor.name}</Italic>. To complete your order,
        please send <strong>{money(order.total_cents)}</strong> on Venmo to <strong>@{vendor.venmo_handle}</strong>{' '}
        and include the note exactly as shown.
      </P>

      <Divider />
      <Detail label="Pay to" value={`@${vendor.venmo_handle}`} />
      <Detail label="Amount" value={money(order.total_cents)} />
      <Detail label="Note" value={`Order #${order.short_code}`} />
      <Divider />

      {venmoUrl ? <CTA href={venmoUrl}>Open Venmo</CTA> : null}

      <Section>
        <Text style={styles.eyebrow}>Items</Text>
        {items.map((it) => (
          <Text key={it.id || it.product_id} style={{ ...styles.detailRow, margin: '0 0 4px' }}>
            {it.quantity}× {it.product_name_snapshot || it.name} — {money(it.line_total_cents || it.price_cents * it.quantity)}
          </Text>
        ))}
      </Section>

      <Divider />
      <P muted>
        {vendor.name} will mark your order paid once they confirm the Venmo transfer, and let you know when it’s
        ready to pick up at <strong>Booth #{vendor.booth_number}</strong>. Reply to this email if anything looks wrong.
      </P>
    </EmailShell>
  )
}

export default MarketOrderConfirmation
