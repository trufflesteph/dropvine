import { ImageResponse } from 'next/og'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { DROPVINE_LOGO_URL } from '@/components/dropvine/logo'

// Dynamic OG image — Next.js auto-wires this into <meta property="og:image">
// for every page that doesn't define its own opengraph-image. Regenerated at
// most once per hour (see `revalidate` below); social platforms cache their
// own scrape on top of that.
//
// NOTE: next/og renders via Satori, a limited CSS subset (flexbox layout,
// inline styles only — no Tailwind, no next/font). Every multi-child div
// needs an explicit `display: flex`. No custom font is loaded here — the
// `fontFamily: 'serif'` / `'sans-serif'` hints fall back to next/og's bundled
// default font per the brief (no external font fetch, kept simple/robust).

export const runtime = 'nodejs'
export const revalidate = 3600
export const alt = 'Dropvine — Sell more. Text less.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CREAM = '#F5F3EE'
const INK = '#0E0E0C'
const MUTED = '#6B6863'
const BORDER = '#E8E5DE'

// Same data shape/priority as /api/direct/featured-drops — manually curated
// via drops.is_featured_homepage + featured_order, image fallback chain
// hero_image_url → cover_url → vendor photo → vendor logo.
async function getFeaturedDrops() {
  const supa = getSupabaseAdmin()
  if (!supa) return []
  const { data: drops, error } = await supa
    .from('drops')
    .select('id, title, cover_url, hero_image_url, launch_at, closes_at, collection_mode, creator_id, featured_order')
    .eq('is_featured_homepage', true)
    .order('featured_order', { ascending: true, nullsFirst: false })
    .limit(3)
  if (error || !drops?.length) return []

  const creatorIds = [...new Set(drops.map((d) => d.creator_id).filter(Boolean))]
  const vendorByCreator = new Map()
  if (creatorIds.length) {
    const { data: vendors } = await supa
      .from('direct_vendors')
      .select('creator_id, business_name, category, logo_url, photo_url')
      .in('creator_id', creatorIds)
    for (const v of (vendors || [])) vendorByCreator.set(v.creator_id, v)
  }

  return drops.map((d) => {
    const v = vendorByCreator.get(d.creator_id) || null
    return {
      image_url: d.hero_image_url || d.cover_url || v?.photo_url || v?.logo_url || null,
      launch_at: d.launch_at,
      collection_mode: d.collection_mode,
      business_name: v?.business_name || d.title,
      category: v?.category || null,
    }
  })
}

// Same status logic as the homepage's getDropStatus, condensed.
function getDropStatus(drop) {
  const launchMs = drop.launch_at ? Date.parse(drop.launch_at) : 0
  const upcoming = launchMs && launchMs > Date.now()
  if (upcoming) return { label: 'Opens soon', color: '#B45309' }
  const mode = drop.collection_mode
  if (mode === 'reservation') return { label: 'Reserve now', color: '#2563EB' }
  if (mode === 'waitlist') return { label: 'Join waitlist', color: '#B45309' }
  return { label: 'Live drop', color: '#15803D' }
}

export default async function OgImage() {
  const drops = await getFeaturedDrops()

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '1200px',
          height: '630px',
          display: 'flex',
          backgroundColor: CREAM,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left half — wordmark, headline, subtext */}
        <div
          style={{
            width: '600px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={DROPVINE_LOGO_URL} alt="Dropvine" height={40} style={{ height: '40px', width: 'auto' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'serif',
                fontSize: 60,
                fontWeight: 300,
                color: INK,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              Sell more. Text less.
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                color: MUTED,
                marginTop: '24px',
                lineHeight: 1.4,
                maxWidth: '460px',
              }}
            >
              Stop taking orders through DMs. Dropvine does the work for you.
            </div>
          </div>
          <div style={{ display: 'flex', height: '20px' }} />
        </div>

        {/* Right half — three stacked compact drop cards */}
        <div
          style={{
            width: '600px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '18px',
            padding: '0 48px',
          }}
        >
          {drops.map((d, i) => {
            const status = getDropStatus(d)
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  height: '158px',
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${BORDER}`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '158px',
                    height: '158px',
                    display: 'flex',
                    flexShrink: 0,
                    backgroundColor: '#D8D4C8',
                    ...(d.image_url
                      ? { backgroundImage: `url(${d.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : {}),
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#FFFFFF',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      padding: '4px 8px',
                    }}
                  >
                    <div style={{ display: 'flex', width: '6px', height: '6px', borderRadius: '3px', backgroundColor: status.color }} />
                    {status.label}
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '0 24px',
                  }}
                >
                  {d.category ? (
                    <div
                      style={{
                        display: 'flex',
                        alignSelf: 'flex-start',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: INK,
                        backgroundColor: '#F0EDE5',
                        border: `1px solid ${BORDER}`,
                        padding: '4px 8px',
                      }}
                    >
                      {d.category}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', fontFamily: 'serif', fontSize: 22, color: INK }}>
                    {d.business_name}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom-right URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '32px',
            display: 'flex',
            fontSize: 14,
            color: MUTED,
          }}
        >
          dropvine.pro
        </div>
      </div>
    ),
    { ...size }
  )
}
