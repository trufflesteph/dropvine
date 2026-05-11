'use client'
import React from 'react'
import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/markets/cart-context'

export default function CartFAB() {
  const { hydrated, itemCount, totalCents, cart } = useCart() || {}
  if (!hydrated || itemCount === 0) return null
  return (
    <Link
      href="/market/cart"
      className="fixed left-1/2 -translate-x-1/2 bottom-[88px] z-40 inline-flex items-center gap-3 px-4 py-3 rounded-full shadow-lg"
      style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <ShoppingBag className="w-4 h-4" />
      <span className="text-sm font-medium">{itemCount} item{itemCount === 1 ? '' : 's'} · ${(totalCents / 100).toFixed(2)}</span>
      {cart?.vendor_name ? <span className="text-xs opacity-70">— {cart.vendor_name}</span> : null}
    </Link>
  )
}
