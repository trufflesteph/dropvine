'use client'
// Vendor dashboard navigation, shared by /dashboard and /dashboard/orders:
// a sidebar from md up, and a compact tab row on phones (the sidebar is
// hidden there). "Orders" shows the number of unpaid orders.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DropvineLogo } from '@/components/dropvine/logo'
import { mockUserHeaders } from '@/lib/auth-context'

const GREEN = '#2D4A2A'

// Unpaid pre-order / deposit orders across the vendor's drops. The API reads
// the Supabase session cookie (x-user-id only in local mock mode).
export function useUnpaidOrderCount(user, configured) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/dashboard/orders?summary=1', { headers: mockUserHeaders(user, configured) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok) setCount(d.unpaid_count || 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, configured])
  return count
}

function CountBadge({ count, inverted }) {
  if (!count) return null
  return (
    <span
      className="ml-2 inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full text-[11px] tabular-nums"
      style={inverted ? { backgroundColor: '#FAFAF7', color: GREEN } : { backgroundColor: GREEN, color: '#FAFAF7' }}
      aria-label={`${count} unpaid`}
      data-testid="unpaid-badge"
    >
      {count}
    </span>
  )
}

const LINKS = [
  { key: 'drops', href: '/dashboard', label: 'Drops' },
  { key: 'orders', href: '/dashboard/orders', label: 'Orders' },
]

export function DashboardSidebar({ active, user, signOut, unpaidCount }) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border p-8 bg-stone-50">
      <Link href="/" className="inline-flex items-center mb-12" aria-label="Dropvine home"><DropvineLogo height={48} /></Link>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Your vine</div>
      <nav className="space-y-1 text-sm">
        {LINKS.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            className={`flex items-center py-2 px-3 -mx-3 ${active === l.key ? 'text-background' : 'text-muted-foreground hover:text-foreground'}`}
            style={active === l.key ? { backgroundColor: GREEN } : undefined}
          >
            {l.label}
            {l.key === 'orders' ? <CountBadge count={unpaidCount} inverted={active === 'orders'} /> : null}
          </Link>
        ))}
        <a className="block py-2 px-3 -mx-3 text-muted-foreground cursor-not-allowed opacity-60">Settings</a>
      </nav>
      <div className="mt-auto pt-8 border-t border-border">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Account</div>
        <div className="text-sm truncate">{user?.email}</div>
        <button onClick={() => signOut?.()} className="mt-3 text-xs text-muted-foreground hover:text-foreground">Sign out</button>
      </div>
    </aside>
  )
}

export function DashboardMobileNav({ active, unpaidCount }) {
  return (
    <nav className="md:hidden flex items-center gap-1 px-4 py-3 border-b border-border bg-stone-50 text-sm" aria-label="Dashboard">
      {LINKS.map((l) => (
        <Link
          key={l.key}
          href={l.href}
          className={`inline-flex items-center h-10 px-4 ${active === l.key ? 'text-background' : 'text-muted-foreground'}`}
          style={active === l.key ? { backgroundColor: GREEN } : undefined}
        >
          {l.label}
          {l.key === 'orders' ? <CountBadge count={unpaidCount} inverted={active === 'orders'} /> : null}
        </Link>
      ))}
    </nav>
  )
}
