import './globals.css'
import { Inter, Fraunces } from 'next/font/google'

// Note: this layout sits OUTSIDE /app/app/layout.js root (which it inherits)
// but provides the admin shell. It is intentionally a server component
// with no auth check — the per-page client guard handles redirection so
// /admin/login itself can render without recursive guard.

export const metadata = {
  title: 'Admin — Dropvine Markets',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }) {
  return <div className="min-h-screen bg-stone-50">{children}</div>
}
