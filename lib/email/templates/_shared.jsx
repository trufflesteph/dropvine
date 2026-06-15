// Shared layout + tokens for all Dropvine emails.
// Tables-based, inline styles only. Mobile-friendly. No external fonts/images.
import * as React from 'react'
import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from '@react-email/components'

const LOGO_URL = 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/assets/dropvine%202%20color%20logo_transparent.png'

export const BRAND = {
  bg: '#FAFAF7',
  fg: '#0E0E0C',
  muted: '#6B6863',
  border: '#E8E5DE',
  accent: '#3D3B36',
  // Round-2 Fix 21 — brighter platform green for all primary CTAs across
  // both emails AND the public drop page. Keep this constant single-source.
  green: '#4CAF50',
  greenHover: '#43A047',
}

const SERIF = "'Cormorant Garamond', 'Times New Roman', Georgia, serif"
const SANS  = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

const styles = {
  body: {
    backgroundColor: BRAND.bg,
    color: BRAND.fg,
    fontFamily: SANS,
    margin: 0,
    padding: 0,
    WebkitFontSmoothing: 'antialiased',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '40px 24px 32px',
  },
  brandRow: {
    fontFamily: SERIF,
    fontSize: '20px',
    letterSpacing: '-0.02em',
    color: BRAND.fg,
    paddingBottom: '40px',
  },
  eyebrow: {
    fontSize: '11px',
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color: BRAND.muted,
    margin: '0 0 12px',
  },
  h1: {
    fontFamily: SERIF,
    fontWeight: 300,
    fontSize: '36px',
    lineHeight: '1.05',
    letterSpacing: '-0.025em',
    margin: '0 0 24px',
    color: BRAND.fg,
  },
  p: {
    fontSize: '15px',
    lineHeight: '1.65',
    color: BRAND.fg,
    margin: '0 0 16px',
  },
  pMuted: {
    fontSize: '14px',
    lineHeight: '1.65',
    color: BRAND.muted,
    margin: '0 0 16px',
  },
  hr: {
    borderColor: BRAND.border,
    borderWidth: '0 0 1px',
    borderStyle: 'solid',
    margin: '32px 0',
  },
  ctaWrap: {
    margin: '40px 0 0',
    paddingBottom: '40px',
  },
  cta: {
    display: 'inline-block',
    backgroundColor: '#2D4A2A',
    color: '#ffffff',
    padding: '14px 28px',
    fontSize: '14px',
    fontFamily: 'sans-serif',
    textDecoration: 'none',
    borderRadius: '2px',
    fontWeight: 500,
  },
  textLink: {
    display: 'inline-block',
    color: BRAND.green,
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    margin: '0 0 12px',
  },
  // Round-2 Fix 13 — Detail rows are now stacked vertically with the
  // label (uppercase eyebrow) on its own line, then the value below.
  // Each pair gets bottom margin for visual breathing room. This replaces
  // the old inline "label · value" layout where labels collided with values.
  detailWrap: {
    margin: '0 0 20px',
  },
  detailLabel: {
    display: 'block',
    color: BRAND.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
    fontSize: '10px',
    margin: '0 0 6px',
    fontWeight: 600,
  },
  detailValue: {
    display: 'block',
    fontSize: '15px',
    color: BRAND.fg,
    lineHeight: '1.5',
    margin: 0,
  },
  productRow: {
    padding: '14px 0',
    borderBottom: `1px solid ${BRAND.border}`,
  },
  productName: {
    fontSize: '15px',
    color: BRAND.fg,
    margin: '0 0 4px',
    fontWeight: 600,
  },
  productDesc: {
    fontSize: '13px',
    color: BRAND.muted,
    lineHeight: '1.5',
    margin: '0 0 4px',
  },
  productPrice: {
    fontSize: '14px',
    color: BRAND.fg,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    margin: 0,
  },
  footer: {
    fontSize: '11px',
    color: BRAND.muted,
    lineHeight: '1.7',
    marginTop: '40px',
    paddingTop: '24px',
    borderTop: `1px solid ${BRAND.border}`,
  },
  footerLine: {
    fontSize: '11px',
    color: BRAND.muted,
    lineHeight: '1.7',
    margin: 0,
  },
  italic: {
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: BRAND.muted,
  },
}

// EmailShell accepts an optional `footerLines` array prop so each template
// can supply its own context-appropriate footer (Round 2 Fix 9, 10, 16).
// When omitted, we render a SAFE generic Dropvine footer so legacy callers
// don't ship blank emails.
export function EmailShell({ preview, children, planTier, footerLines }) {
  const showWatermark = (planTier || 'free') !== 'shop'
  const lines = Array.isArray(footerLines) && footerLines.length
    ? footerLines
    : ['Sent by Dropvine.', 'Dropvine — fresh drops daily']
  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brandRow}>
            <Img src={LOGO_URL} alt="Dropvine" height={48} style={{ width: 'auto', display: 'block' }} />
          </Section>
          {children}
          <Section style={styles.footer}>
            {lines.map((line, i) => (
              <Text key={i} style={styles.footerLine}>{line}</Text>
            ))}
            {showWatermark ? (
              <Text style={{ ...styles.footerLine, margin: '12px 0 0', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                Powered by <a href="https://dropvine.pro" style={{ color: BRAND.muted, textDecoration: 'underline' }}>Dropvine</a>
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function H1({ children, style }) { return <Text style={{ ...styles.h1, ...(style||{}) }}>{children}</Text> }
export function Eyebrow({ children }) { return <Text style={styles.eyebrow}>{children}</Text> }
export function P({ children, muted, style }) { return <Text style={{ ...(muted ? styles.pMuted : styles.p), ...(style || {}) }}>{children}</Text> }
export function Italic({ children }) { return <span style={styles.italic}>{children}</span> }
export function Divider() { return <Hr style={styles.hr} /> }
export function CTA({ href, children }) {
  // Single full-width primary button. The `ghost` prop is intentionally
  // ignored — use <TextLink> for the secondary action instead so email
  // clients don't blow up the layout (see _shared.jsx comment on `cta`).
  return (
    <Section style={styles.ctaWrap}>
      <a href={href} style={styles.cta}>{children}</a>
    </Section>
  )
}

// Plain inline text link used for secondary CTAs (e.g. "Review my drop")
// in the same body section. Renders reliably across Gmail, Apple Mail,
// Outlook, and dark-mode clients because there's no table/border to break.
export function TextLink({ href, children, style }) {
  return (
    <Section style={{ margin: '0 0 16px', ...(style || {}) }}>
      <a href={href} style={styles.textLink}>{children}</a>
    </Section>
  )
}

// Round-2 Fix 13 — Detail now renders the label on its own line above
// the value, with margin between rows. Backwards-compatible signature.
export function Detail({ label, value }) {
  return (
    <Section style={styles.detailWrap}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </Section>
  )
}

// Round-2 Fix 15 — Compact product line used in the submission confirmation
// email. Renders {name, optional description, price-cents formatted}.
export function ProductLine({ name, description, priceCents }) {
  const price = priceCents != null ? `$${(Number(priceCents) / 100).toFixed(2)}` : ''
  return (
    <Section style={styles.productRow}>
      <Text style={styles.productName}>{name}</Text>
      {description ? <Text style={styles.productDesc}>{description}</Text> : null}
      {price ? <Text style={styles.productPrice}>{price}</Text> : null}
    </Section>
  )
}

export { styles }
