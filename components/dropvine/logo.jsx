// Single source of truth for the Dropvine wordmark/logo image.
// Update this URL once and every nav/footer/dashboard/drop-page header picks it up.
export const DROPVINE_LOGO_URL =
  'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/assets/dropvine%202%20color%20logo_transparent.png'

// `height` is the rendered pixel height. Width auto-scales to preserve aspect.
// `className` lets callers tweak margins / vertical alignment without touching this file.
export function DropvineLogo({ height = 60, className = '', alt = 'Dropvine' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={DROPVINE_LOGO_URL}
      alt={alt}
      style={{ height: `${height}px`, width: 'auto' }}
      className={`block ${className}`}
    />
  )
}
