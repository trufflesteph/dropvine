'use client'
import React, { useState } from 'react'
import { useCart } from '@/lib/markets/cart-context'
import { toast } from 'sonner'
import { Plus, Minus } from 'lucide-react'

export default function AddToCartButton({ vendor, product }) {
  const { cart, addItem, setQuantity } = useCart()
  const inCart = cart.items.find((i) => i.product_id === product.id)
  const otherVendor = cart.vendor_id && cart.vendor_id !== vendor.id
  const [confirming, setConfirming] = useState(false)

  const onAdd = () => {
    if (otherVendor && !confirming) { setConfirming(true); return }
    addItem(vendor, product, 1)
    toast.success(`Added “${product.name}” to cart`)
    setConfirming(false)
  }

  if (inCart) {
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-stone-200">
        <button onClick={() => setQuantity(product.id, inCart.quantity - 1)} className="w-7 h-7 grid place-items-center hover:bg-stone-50 rounded-full" aria-label="Decrease">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm w-6 text-center font-mono">{inCart.quantity}</span>
        <button onClick={() => setQuantity(product.id, inCart.quantity + 1)} className="w-7 h-7 grid place-items-center hover:bg-stone-50 rounded-full" aria-label="Increase">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onAdd}
      className="text-xs uppercase tracking-wide px-3 py-1.5 rounded-full transition"
      style={confirming
        ? { background: '#9F2A14', color: '#FAF7F2' }
        : { background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}
    >
      {confirming ? 'Replace cart? Tap again' : 'Add'}
    </button>
  )
}
