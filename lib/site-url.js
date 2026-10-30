// Public site origin for canonical URLs and absolute links. Same setting the
// email and order code reads (NEXT_PUBLIC_BASE_URL), same production fallback.
const PRODUCTION_BASE = 'https://dropvine.pro'

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || PRODUCTION_BASE).replace(/\/$/, '')
}
