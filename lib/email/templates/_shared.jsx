// Shared layout + tokens for all Dropvine emails.
// Tables-based, inline styles only. Mobile-friendly. No external fonts/images.
import * as React from 'react'
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'

export const BRAND = {
  bg: '#FAFAF7',
  fg: '#0E0E0C',
  muted: '#6B6863',
  border: '#E8E5DE',
  accent: '#3D3B36',
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
    margin: '32px 0',
  },
  cta: {
    display: 'inline-block',
    backgroundColor: '#2D4A2A',
    color: '#FFFFFF',
    fontSize: '14px',
    letterSpacing: '0.02em',
    padding: '14px 28px',
    textDecoration: 'none',
  },
  ctaGhost: {
    display: 'inline-block',
    border: `1px solid #2D4A2A`,
    color: '#2D4A2A',
    fontSize: '14px',
    letterSpacing: '0.02em',
    padding: '13px 28px',
    textDecoration: 'none',
  },
  detailRow: {
    fontSize: '13px',
    lineHeight: '1.7',
    color: BRAND.muted,
    margin: '0 0 6px',
  },
  detailLabel: {
    display: 'inline-block',
    width: '110px',
    color: BRAND.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    fontSize: '10px',
    paddingRight: '12px',
  },
  detailValue: {
    fontSize: '13px',
    color: BRAND.fg,
  },
  footer: {
    fontSize: '11px',
    color: BRAND.muted,
    lineHeight: '1.7',
    marginTop: '40px',
    paddingTop: '24px',
    borderTop: `1px solid ${BRAND.border}`,
  },
  italic: {
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: BRAND.muted,
  },
}

export function EmailShell({ preview, children, planTier }) {
  // Show "Powered by Dropvine" footer for free + maker tiers; hide for shop.
  // planTier may be undefined (legacy callers / Markets module emails) — in
  // that case we DO show the watermark (safe default for unknown tiers).
  const showWatermark = (planTier || 'free') !== 'shop'
  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brandRow}>Dropvine</Section>
          {children}
          <Section style={styles.footer}>
            <Text style={{ ...styles.detailRow, margin: 0 }}>
              You&rsquo;re receiving this email because you submitted a drop on Dropvine.
            </Text>
            <Text style={{ ...styles.detailRow, margin: 0 }}>
              Dropvine — Built for the gap between making and selling.
            </Text>
            {showWatermark ? (
              <Text style={{ ...styles.detailRow, margin: '12px 0 0', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
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
export function P({ children, muted }) { return <Text style={muted ? styles.pMuted : styles.p}>{children}</Text> }
export function Italic({ children }) { return <span style={styles.italic}>{children}</span> }
export function Divider() { return <Hr style={styles.hr} /> }
export function CTA({ href, children, ghost }) {
  return (
    <Section style={styles.ctaWrap}>
      <a href={href} style={ghost ? styles.ctaGhost : styles.cta}>{children}</a>
    </Section>
  )
}
export function Detail({ label, value }) {
  return (
    <Text style={{ ...styles.detailRow, margin: '0 0 8px' }}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </Text>
  )
}

export { styles }
