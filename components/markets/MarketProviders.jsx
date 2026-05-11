'use client'
import React from 'react'
import { MarketConfigProvider } from '@/lib/markets/config-context'
import { CartProvider } from '@/lib/markets/cart-context'
import BottomNav from '@/components/markets/BottomNav'
import CartFAB from '@/components/markets/CartFAB'

export default function MarketProviders({ initialConfig, children }) {
  return (
    <MarketConfigProvider initialConfig={initialConfig}>
      <CartProvider>
        <div className="min-h-screen pb-20" style={{ background: 'var(--market-bg, #FAF7F2)' }}>
          {children}
          <CartFAB />
          <BottomNav />
        </div>
      </CartProvider>
    </MarketConfigProvider>
  )
}
