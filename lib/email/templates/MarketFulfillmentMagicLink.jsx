import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, Italic, Divider, CTA, Detail, styles } from './_shared'

function money(cents) { return `$${((cents || 0) / 100).toFixed(2)}` }

export function MarketFulfillmentMagicLink({ order, vendor, items = [], magicUrl, marketName, marketDate }) {
  return (
    <EmailShell preview={`New pre-order #${order.short_code} — ${money(order.total_cents)}`}>
      <Eyebrow>{marketName || 'Dropvine Markets'} · Pre-order #{order.short_code}</Eyebrow>
      <H1>You have a new pre-order.</H1>
      <P>A shopper just placed a pre-order for <Italic>{vendor.name}</Italic>.</P>

      <Divider />
      <Detail label="Order" value={`#${order.short_code}`} />
      <Detail label="Total" value={money(order.total_cents)} />
      <Detail label="Shopper" value={`${order.shopper_name || 'Anonymous'} · ${order.shopper_email}`} />
      {order.shopper_phone ? <Detail label="Phone" value={order.shopper_phone} /> : null}
      {marketDate ? <Detail label="For" value={new Date(marketDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} /> : null}
      <Divider />

      <Section>
        <Text style={styles.eyebrow}>Items</Text>
        {items.map((it) => (
          <Text key={it.id || it.product_id} style={{ ...styles.detailRow, margin: '0 0 4px' }}>
            {it.quantity}× {it.product_name_snapshot || it.name} — {money(it.line_total_cents || it.price_cents * it.quantity)}
          </Text>
        ))}
      </Section>

      <CTA href={magicUrl}>Open fulfillment page</CTA>
      <P muted>
        Use the fulfillment page to confirm Venmo payment received and mark the order ready for pickup.
        This link is unique to this order and expires in 30 days.
      </P>
    </EmailShell>
  )
}

export default MarketFulfillmentMagicLink
