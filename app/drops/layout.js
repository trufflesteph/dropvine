// Page-scoped metadata for /drops. Because the page itself is a client
// component ('use client'), it can't export `metadata` directly — Next.js
// requires that metadata live in a server component or the surrounding
// layout. So we set it on a route-local layout that wraps the client page.
export const metadata = {
  title: 'Browse Fresh Drops — Dropvine',
  description:
    'Browse fresh drops from independent makers, farms, and studios using Dropvine. Filter by category, search by name, jump straight to a maker.',
  openGraph: {
    title: 'Browse Fresh Drops — Dropvine',
    description:
      'Browse fresh drops from independent makers, farms, and studios using Dropvine.',
    url: 'https://dropvine.pro/drops',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse Fresh Drops — Dropvine',
    description:
      'Browse fresh drops from independent makers, farms, and studios using Dropvine.',
  },
}

export default function DropsLayout({ children }) {
  return children
}
