// Web app manifest, served at /manifest.webmanifest (Next.js convention).
//
// Static Dropvine Direct values. Colours match the site's light theme
// (--background #FAFAF7). Icons in public/icons are the Dropvine logo mark on
// that background.
//
// Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest

const SITE_BACKGROUND = '#FAFAF7'

export default function manifest() {
  return {
    name: 'Dropvine',
    short_name: 'Dropvine',
    description: 'Stop taking orders through DMs. Dropvine does the work for you.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: SITE_BACKGROUND,
    theme_color: SITE_BACKGROUND,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
