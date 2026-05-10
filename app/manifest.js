// Dynamic PWA manifest, served at /manifest.webmanifest (Next.js convention).
// Pulls name, theme, and icon from the active market_config so the white-label
// branding stays in sync with the admin Settings page. Falls back to safe
// defaults if no active config exists.
//
// Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest

import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const FALLBACK_ICON = 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=512&h=512&fit=crop&crop=entropy&auto=format'

export default async function manifest() {
  let cfg = null
  try {
    const supa = getSupabaseAdmin()
    if (supa) {
      const { data } = await supa.from('market_config').select(
        'name, pwa_short_name, pwa_theme_color, pwa_background_color, pwa_icon_url'
      ).eq('is_active', true).maybeSingle()
      cfg = data || null
    }
  } catch { /* fall back below */ }

  const name = cfg?.name || 'Dropvine Markets'
  const shortName = cfg?.pwa_short_name || (cfg?.name ? cfg.name.split(/\s+/)[0] : 'Markets')
  const themeColor = cfg?.pwa_theme_color || '#2F5233'
  const bgColor = cfg?.pwa_background_color || '#FAF7F2'
  const iconUrl = cfg?.pwa_icon_url || FALLBACK_ICON

  return {
    name,
    short_name: shortName,
    description: 'A seasonal farmers market in your pocket — vendor map, pre-orders, kids’ passport.',
    start_url: '/market',
    scope: '/market',
    display: 'standalone',
    orientation: 'portrait',
    background_color: bgColor,
    theme_color: themeColor,
    categories: ['food', 'shopping', 'lifestyle'],
    icons: [
      { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Browse vendors', short_name: 'Shop', url: '/market/shop' },
      { name: 'Calendar',       short_name: 'Calendar', url: '/market/calendar' },
      { name: 'My passport',    short_name: 'Passport', url: '/market/passport' },
    ],
  }
}
