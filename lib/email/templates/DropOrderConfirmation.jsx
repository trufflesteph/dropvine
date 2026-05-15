import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailShell, H1, Eyebrow, P, Italic, Divider, CTA, Detail, styles } from './_shared'

function money(cents) {
  if (cents == null) return '—'
  return `$${(Number(cents) / 100).toFixed(2)}`
}

// Confirmation for a Dropvine Direct pre-order / deposit order placed against
// a public launch page. The shopper has already (claimed they have) sent
// payment via Venmo — this is the receipt + pickup expectations.
//
// Itemised when `items[]` is provided (multi-product drops). Falls back to a
// single quantity line when items is empty (legacy single-SKU drops).
export function DropOrderConfirmation({ order, launch, items = [], baseUrl }) {
  const isDeposit = order?.collection_mode === 'deposit'
  const subjectAmount = isDeposit ? order.deposit_cents : order.total_cents
  const headline = isDeposit
    ? 'Your deposit is in — order secured.'
    : 'Your pre-order is in — payment pending review.'
  const venmoUrl = order?.venmo_handle
    ? `https://venmo.com/${encodeURIComponent(String(order.venmo_handle).replace(/^@/, ''))}?txn=pay&amount=${(subjectAmount / 100).toFixed(2)}&note=${encodeURIComponent(order.venmo_note || '')}`
    : null

  // Render items section only when we have line items AND there's more than 1,
  // OR the single item is a real product (launch_product_id) rather than the
  // synthetic legacy fallback line. This keeps legacy single-SKU emails clean.
  const showItems = Array.isArray(items) && items.length > 0
    && (items.length > 1 || items[0]?.launch_product_id)

  return (
    <EmailShell preview={`Order #${order.short_code} — ${launch?.title || 'your drop'}`}>
      <Eyebrow>{launch?.title || 'Dropvine Direct'} · Order #{order.short_code}</Eyebrow>
      <H1>{headline}</H1>
      <P>
        Thanks for ordering <Italic>{launch?.title || 'the drop'}</Italic>. We&rsquo;ve recorded your{' '}
        {isDeposit ? 'deposit' : 'pre-order'} and the maker will mark it paid once your Venmo transfer comes through.
      </P>

      {showItems ? (
        <>
          <Divider />
          <Section>
            <Text style={styles.eyebrow}>Items</Text>
            {items.map((it) => (
              <Text key={it.id || it.launch_product_id || it.product_name}
                    style={{ ...styles.detailRow, margin: '0 0 4px' }}>
                {it.quantity}× {it.product_name} — {money((it.price_cents || 0) * (it.quantity || 0))}
              </Text>
            ))}
          </Section>
        </>
      ) : null}

      <Divider />
      <Detail label="Order" value={`#${order.short_code}`} />
      <Detail label="Quantity" value={String(order.quantity)} />
      {!showItems && order.unit_price_cents ? <Detail label="Unit price" value={money(order.unit_price_cents)} /> : null}
      <Detail label="Total" value={money(order.total_cents)} />
      {isDeposit ? (
        <>
          <Detail label="Deposit paid" value={money(order.deposit_cents)} />
          <Detail label="Balance at pickup" value={money(order.balance_cents)} />
        </>
      ) : null}
      <Divider />
      <Detail label="Pay to" value={order.venmo_handle ? `@${order.venmo_handle}` : '—'} />
      <Detail label="Amount" value={money(subjectAmount)} />
      <Detail label="Note (Venmo memo)" value={order.venmo_note} />
      <Divider />

      {venmoUrl ? <CTA href={venmoUrl}>Open Venmo</CTA> : null}

      <Section>
        <Text style={styles.eyebrow}>Pickup</Text>
        <Text style={{ ...styles.detailRow, margin: '0 0 4px' }}>
          {launch?.pickup_details || 'The maker will email you with pickup details.'}
        </Text>
      </Section>

      <Divider />
      <P muted>
        If you have already sent the Venmo transfer, no further action is needed — the maker will confirm shortly.
        If anything looks wrong, reply to this email.
      </P>
    </EmailShell>
  )
}

export default DropOrderConfirmation
