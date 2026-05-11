'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { readAdminSession, clearAdminSession } from '@/lib/markets/admin-client'
import { LayoutGrid, Store, Calendar, ShoppingCart, Inbox, Settings, QrCode, LogOut, ShieldCheck } from 'lucide-react'

const LINKS = [
  { href: '/admin',             label: 'Dashboard',   Icon: LayoutGrid, roles: ['platform','organiser'] },
  { href: '/admin/vendors',     label: 'Vendors',     Icon: Store,      roles: ['platform','organiser'] },
  { href: '/admin/dates',       label: 'Dates',       Icon: Calendar,   roles: ['platform','organiser'] },
  { href: '/admin/orders',      label: 'Orders',      Icon: ShoppingCart, roles: ['platform','organiser'] },
  { href: '/admin/submissions', label: 'Submissions', Icon: Inbox,      roles: ['platform','organiser'] },
  { href: '/admin/qr-codes',    label: 'QR codes',    Icon: QrCode,     roles: ['platform','organiser'] },
  { href: '/admin/settings',    label: 'Settings',    Icon: Settings,   roles: ['platform'] },
]

export default function AdminShell({ children, requireRole = null }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = React.useState(undefined) // undefined = loading

  React.useEffect(() => {
    const s = readAdminSession()
    if (!s) {
      router.replace('/admin/login?next=' + encodeURIComponent(pathname || '/admin'))
      return
    }
    if (requireRole && s.role !== requireRole) {
      router.replace('/admin')
      return
    }
    setSession(s)
  }, [router, pathname, requireRole])

  if (session === undefined || session === null) {
    return <div className="min-h-screen grid place-items-center text-stone-500">Loading…</div>
  }

  const onSignOut = () => { clearAdminSession(); router.replace('/admin/login') }
  const visibleLinks = LINKS.filter((l) => l.roles.includes(session.role))

  return (
    <div className="min-h-screen">
      <header className="bg-stone-900 text-stone-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/admin" className="font-serif text-lg">Dropvine · <span className="text-stone-400">Markets Admin</span></Link>
          <nav className="flex items-center gap-1 overflow-x-auto flex-1">
            {visibleLinks.map(({ href, label, Icon }) => {
              const active = pathname === href || (href !== '/admin' && pathname?.startsWith(href))
              return (
                <Link key={href} href={href}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs uppercase tracking-wide whitespace-nowrap"
                      style={active ? { background: 'rgba(255,255,255,0.12)', color: '#FAFAF7' } : { color: '#A8A398' }}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-stone-400"><ShieldCheck className="w-3.5 h-3.5" />{session.role}</span>
            <button onClick={onSignOut} className="inline-flex items-center gap-1 text-stone-400 hover:text-white">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

export function useAdminSession() {
  const [s, setS] = React.useState(null)
  React.useEffect(() => { setS(readAdminSession()) }, [])
  return s
}
