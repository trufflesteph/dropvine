// Site nav links, shared by the desktop row and the phone menu
// (components/dropvine/nav.jsx) so the two never drift apart.
export const PAGE_LINKS = [
  { href: '/drops', label: 'Shop drops' },
  { href: '/makers', label: 'Browse makers' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/tools', label: 'Free tools' },
]

// Focus trap for the menu: index to focus after Tab (or Shift+Tab) from
// `index` among `count` focusable elements, wrapping at both ends. An index
// outside the list (focus escaped) goes to the first, or last on Shift+Tab.
export function wrapFocusIndex(index, count, backwards = false) {
  if (count <= 0) return -1
  if (index < 0 || index >= count) return backwards ? count - 1 : 0
  return backwards ? (index - 1 + count) % count : (index + 1) % count
}
