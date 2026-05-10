// Dynamic PWA manifest, served at /manifest.webmanifest (Next.js convention).
//
// Pulls name, theme, and icon from the active market_config so the white-label
// branding stays in sync with the admin Settings page. Falls back to NEUTRAL
// defaults (greyscale) if no active config exists — chosen so that a fresh
// deployment looks visibly "unconfigured" until the operator sets real values.
//
// Icon resolution order:
//   1. market_config.pwa_icon_url  — explicit override per deployment
//   2. /icons/icon-{192,512}.png   — bundled placeholder market-stall art
//
// Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { MARKET_NEUTRAL_DEFAULTS } from '@/lib/markets/defaults'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULTS = {
  name: 'Dropvine Markets',
  short_name: 'Markets',
  theme_color: MARKET_NEUTRAL_DEFAULTS.pwa_theme_color,
  background_color: MARKET_NEUTRAL_DEFAULTS.pwa_background_color,
}

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

  const name = cfg?.name || DEFAULTS.name
  const shortName = cfg?.pwa_short_name || (cfg?.name ? cfg.name.split(/\s+/)[0] : DEFAULTS.short_name)
  const themeColor = cfg?.pwa_theme_color || DEFAULTS.theme_color
  const bgColor = cfg?.pwa_background_color || DEFAULTS.background_color

  // Icons: prefer the operator-supplied URL; otherwise use bundled placeholder PNGs.
  const customIcon = cfg?.pwa_icon_url || null
  const icons = customIcon
    ? [
        { src: customIcon, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: customIcon, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: customIcon, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]

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
    icons,
    shortcuts: [
      { name: 'Browse vendors', short_name: 'Shop', url: '/market/shop' },
      { name: 'Calendar',       short_name: 'Calendar', url: '/market/calendar' },
      { name: 'My passport',    short_name: 'Passport', url: '/market/passport' },
    ],
  }
}
