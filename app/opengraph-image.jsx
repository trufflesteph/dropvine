import { ImageResponse } from 'next/og'
import { DROPVINE_LOGO_URL } from '@/components/dropvine/logo'

// Link preview image. Next.js auto-wires this into <meta property="og:image">
// (and twitter:image) for every page that doesn't define its own
// opengraph-image. Regenerated at most once per hour.
//
// Matches the homepage hero: cream background, logo, the headline in
// Fraunces (navy, second sentence green) and the no-cut line in Manrope.
//
// NOTE: next/og renders via Satori, a limited CSS subset (flexbox layout,
// inline styles only — no Tailwind, no next/font). Every multi-child div
// needs an explicit `display: flex`. Fonts are fetched as TTF from Google
// Fonts; if that fails the image still renders with the bundled default font.

export const runtime = 'edge'
export const revalidate = 3600
export const alt = 'You bake. Dropvine handles the selling.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CREAM = '#FBF6EE'
const NAVY = '#1D3461'
const GREEN = '#2F5128'
const BODY = '#3B342E'

// Logo PNG is 1800x900 (2:1).
const LOGO_HEIGHT = 96
const LOGO_WIDTH = LOGO_HEIGHT * 2

// Google Fonts returns TTF (which Satori needs) when no browser user agent
// is sent. `text` subsets the font to just the characters drawn.
async function loadGoogleFont(family, weight, text) {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(cssUrl)).text()
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)
    if (!src) return null
    const res = await fetch(src[1])
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

export default async function OgImage() {
  const line1 = 'You bake.'
  const line2 = 'Dropvine handles the selling.'
  const subline = 'Dropvine never takes a cut of your sales.'

  const [fraunces, manrope] = await Promise.all([
    loadGoogleFont('Fraunces', 500, line1 + line2),
    loadGoogleFont('Manrope', 500, subline),
  ])
  const fonts = [
    fraunces && { name: 'Fraunces', data: fraunces, weight: 500, style: 'normal' },
    manrope && { name: 'Manrope', data: manrope, weight: 500, style: 'normal' },
  ].filter(Boolean)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: CREAM,
          padding: '56px 80px 72px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DROPVINE_LOGO_URL} alt="Dropvine" width={LOGO_WIDTH} height={LOGO_HEIGHT} style={{ marginLeft: '-8px' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Fraunces',
              fontWeight: 500,
              fontSize: 80,
              lineHeight: 1.04,
              letterSpacing: '-0.02em',
              maxWidth: '1000px',
            }}
          >
            <div style={{ display: 'flex', color: NAVY }}>{line1}</div>
            <div style={{ display: 'flex', color: GREEN }}>{line2}</div>
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Manrope',
              fontWeight: 500,
              fontSize: 30,
              color: BODY,
              marginTop: '36px',
            }}
          >
            {subline}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
