'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { readAdminSession, clearAdminSession } from '@/lib/markets/admin-client'
import {
  LayoutGrid, Store, Calendar, ShoppingCart, Inbox, Settings, QrCode, LogOut, ShieldCheck,
  Sparkles, Users, MapPin, Trophy, BadgeCheck, ClipboardList, Package, MessageSquare,
} from 'lucide-react'

// Two-section IA. Sections collapse on mobile via overflow scroll.
const SECTIONS = [
  {
    title: 'Dropvine Direct',
    items: [
      { href: '/admin/direct/drops',    label: 'Drops',    Icon: Sparkles,       roles: ['platform','organiser'] },
      { href: '/admin/direct/orders',   label: 'Orders',   Icon: ClipboardList,  roles: ['platform','organiser'] },
      { href: '/admin/direct/vendors',  label: 'Vendors',  Icon: Users,          roles: ['platform','organiser'] },
      { href: '/admin/direct/settings', label: 'Settings', Icon: Settings, roles: ['platform'] },
    ],
  },
  {
    title: 'Dropvine Markets',
    items: [
      { href: '/admin',              label: 'Dashboard',   Icon: LayoutGrid,    roles: ['platform','organiser'] },
      { href: '/admin/market-dates', label: 'Market dates', Icon: Calendar,     roles: ['platform','organiser'] },
      { href: '/admin/vendors',      label: 'Vendors',     Icon: Store,         roles: ['platform','organiser'] },
      { href: '/admin/attendance',   label: 'Attendance',  Icon: ClipboardList, roles: ['platform','organiser'] },
      { href: '/admin/orders',       label: 'Orders',      Icon: ShoppingCart,  roles: ['platform','organiser'] },
      { href: '/admin/submissions',  label: 'Submissions', Icon: Inbox,         roles: ['platform','organiser'] },
      { href: '/admin/challenges',   label: 'Challenges',  Icon: Trophy,        roles: ['platform','organiser'] },
      { href: '/admin/amenities',    label: 'Amenities',   Icon: MapPin,        roles: ['platform','organiser'] },
      { href: '/admin/pop',          label: 'POP Passport', Icon: BadgeCheck,   roles: ['platform','organiser'] },
      { href: '/admin/qr-codes',     label: 'QR codes',    Icon: QrCode,        roles: ['platform','organiser'] },
      { href: '/admin/notifications',label: 'Notifications', Icon: MessageSquare, roles: ['platform'] },
      { href: '/admin/settings',     label: 'Settings',    Icon: Package,       roles: ['platform'] },
    ],
  },
]

export default function AdminShell({ children, requireRole = null }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = React.useState(undefined)

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
  const isActive = (href) => pathname === href || (href !== '/admin' && pathname?.startsWith(href + '/')) || pathname === href

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-stone-900 text-stone-100 sticky top-0 z-30 border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-4">
          <Link href="/admin" className="font-serif text-base shrink-0">
            Dropvine <span className="text-stone-500">·</span> <span className="text-stone-400">Admin</span>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-stone-400">
              <ShieldCheck className="w-3.5 h-3.5" />{session.role}
            </span>
            <button onClick={onSignOut} className="inline-flex items-center gap-1 text-stone-400 hover:text-white">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-1 flex gap-6 overflow-x-auto">
          {SECTIONS.map((section) => {
            const items = section.items.filter((l) => l.roles.includes(session.role))
            if (!items.length) return null
            return (
              <div key={section.title} className="flex items-center gap-1 shrink-0">
                <div className="text-[9px] uppercase tracking-[0.2em] text-stone-500 mr-2 shrink-0">{section.title}</div>
                {items.map(({ href, label, Icon }) => {
                  const active = isActive(href)
                  return (
                    <Link key={href} href={href}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] uppercase tracking-wide whitespace-nowrap transition"
                          style={active
                            ? { background: 'rgba(255,255,255,0.12)', color: '#FAFAF7' }
                            : { color: '#A8A398' }}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

export function useAdminSession() {
  const [s, setS] = React.useState(null)
  React.useEffect(() => { setS(readAdminSession()) }, [])
  return s
}
