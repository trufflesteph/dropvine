'use client'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CartContext = createContext(null)
const LS_KEY = 'dropvine_market_cart_v1'

function emptyCart() {
  return { vendor_id: null, vendor_name: null, vendor_slug: null, vendor_venmo: null, items: [] }
}

function loadCart() {
  if (typeof window === 'undefined') return emptyCart()
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : emptyCart()
  } catch { return emptyCart() }
}

function saveCart(c) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(c)) } catch { /* noop */ }
}

/**
 * Single-vendor cart held in localStorage. Adding a product from a
 * different vendor replaces the cart (callers should confirm first).
 */
export function CartProvider({ children }) {
  const [cart, setCart] = useState(emptyCart())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setCart(loadCart())
    setHydrated(true)
  }, [])

  useEffect(() => { if (hydrated) saveCart(cart) }, [cart, hydrated])

  const itemCount = useMemo(() => cart.items.reduce((s, i) => s + i.quantity, 0), [cart])
  const totalCents = useMemo(() => cart.items.reduce((s, i) => s + i.price_cents * i.quantity, 0), [cart])

  const addItem = useCallback((vendor, product, quantity = 1) => {
    setCart((prev) => {
      // Different vendor → replace
      if (prev.vendor_id && prev.vendor_id !== vendor.id) {
        return {
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          vendor_slug: vendor.slug,
          vendor_venmo: vendor.venmo_handle,
          items: [{ product_id: product.id, name: product.name, price_cents: product.price_cents, quantity }],
        }
      }
      const existing = prev.items.find((i) => i.product_id === product.id)
      const items = existing
        ? prev.items.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i)
        : [...prev.items, { product_id: product.id, name: product.name, price_cents: product.price_cents, quantity }]
      return {
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_slug: vendor.slug,
        vendor_venmo: vendor.venmo_handle,
        items,
      }
    })
  }, [])

  const removeItem = useCallback((productId) => {
    setCart((prev) => {
      const items = prev.items.filter((i) => i.product_id !== productId)
      return items.length === 0 ? emptyCart() : { ...prev, items }
    })
  }, [])

  const setQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) return removeItem(productId)
    setCart((prev) => ({ ...prev, items: prev.items.map((i) => i.product_id === productId ? { ...i, quantity } : i) }))
  }, [removeItem])

  const clear = useCallback(() => setCart(emptyCart()), [])

  const value = useMemo(() => ({ cart, hydrated, itemCount, totalCents, addItem, removeItem, setQuantity, clear }),
                        [cart, hydrated, itemCount, totalCents, addItem, removeItem, setQuantity, clear])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}

/**
 * Build a Venmo deep link.  Falls back to the universal web URL which auto-
 * deep-links into the Venmo app on mobile when installed.
 */
export function venmoUrl({ handle, amountCents, note }) {
  if (!handle) return null
  const amount = ((amountCents || 0) / 100).toFixed(2)
  const params = new URLSearchParams({ txn: 'pay', amount, note: note || '' })
  return `https://venmo.com/${encodeURIComponent(handle.replace(/^@/, ''))}?${params.toString()}`
}
