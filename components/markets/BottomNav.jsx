'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Store, BadgeCheck, Sparkles, User } from 'lucide-react'

const NAV = [
  { href: '/market',          label: 'Home',     Icon: Home },
  { href: '/market/shop',     label: 'Shop',     Icon: Store },
  { href: '/market/passport', label: 'Passport', Icon: BadgeCheck },
  { href: '/market/pop',      label: 'POP Kids', Icon: Sparkles },
  { href: '/market/profile',  label: 'Me',       Icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-white/85 backdrop-blur-md"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="flex max-w-3xl mx-auto">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/market' && pathname?.startsWith(href))
          return (
            <li key={href} className="flex-1">
              <Link href={href}
                    className="flex flex-col items-center gap-0.5 py-2.5 text-[11px]"
                    style={{ color: active ? 'var(--market-primary, #2F5233)' : '#75716A' }}>
                <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.6} />
                <span className="tracking-wide">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
