import * as React from 'react'
import { Html, Head, Preview, Body, Container, Section, Heading, Text, Button, Hr } from '@react-email/components'

const styles = {
  body: { backgroundColor: '#FAFAF7', fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif', padding: '32px 0' },
  container: { maxWidth: 560, margin: '0 auto', backgroundColor: '#fff', border: '1px solid #E8E5DE', padding: 36 },
  kicker: { fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8C8579', margin: 0 },
  h: { fontFamily: 'ui-serif, Georgia, serif', fontWeight: 400, fontSize: 28, lineHeight: 1.2, margin: '12px 0 16px', color: '#0E0E0C' },
  p: { fontSize: 15, lineHeight: 1.55, color: '#3D3B36', margin: '0 0 12px' },
  cta: { display: 'inline-block', background: '#0E0E0C', color: '#FAFAF7', padding: '14px 24px', fontSize: 13, textDecoration: 'none', marginTop: 16 },
  meta: { fontSize: 12, color: '#8C8579', lineHeight: 1.6, margin: '24px 0 0' },
  hr: { border: 'none', borderTop: '1px solid #E8E5DE', margin: '24px 0' },
}

export function DraftDropReview({ launch, vendorName, vendorEmail, previewUrl }) {
  return (
    <Html>
      <Head />
      <Preview>New draft drop awaiting review — {launch.title}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.kicker}>Draft awaiting review</Text>
          <Heading style={styles.h}>{launch.title}</Heading>
          <Text style={styles.p}>A new drop has been submitted via Tally and is sitting in the admin queue as a draft. Review it, then publish from the preview page when you’re ready.</Text>
          <Section>
            <Button href={previewUrl} style={styles.cta}>Open preview →</Button>
          </Section>
          <Hr style={styles.hr} />
          <Text style={styles.meta}>
            <strong>Vendor:</strong> {vendorName || '—'}<br />
            <strong>Vendor email:</strong> {vendorEmail || '—'}<br />
            <strong>Submitted:</strong> {new Date(launch.created_at || Date.now()).toLocaleString()}<br />
            <strong>Handle:</strong> /l/{launch.handle}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default DraftDropReview
