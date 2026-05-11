'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MarketHeader from '@/components/markets/MarketHeader'
import { useCart, venmoUrl } from '@/lib/markets/cart-context'
import { useAuth } from '@/lib/auth-context'
import { Plus, Minus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function money(c) { return `$${((c || 0) / 100).toFixed(2)}` }

export default function CartPage() {
  const router = useRouter()
  const { cart, hydrated, itemCount, totalCents, setQuantity, removeItem, clear } = useCart()
  const { user } = useAuth() || {}

  const [name, setName] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  React.useEffect(() => { if (user?.email && !email) setEmail(user.email) }, [user]) // eslint-disable-line

  const empty = hydrated && itemCount === 0

  const submit = async (e) => {
    e.preventDefault()
    if (!cart.vendor_id) return
    if (!email) { toast.error('Email required'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/market/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: cart.vendor_id,
          items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          shopper: { email, name, phone: phone || undefined },
          notes: notes || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok || j.error) {
        toast.error(j?.error || 'Failed to create order')
        setSubmitting(false)
        return
      }
      // Show preview — keep the cart cleared so back-nav doesn’t double-submit
      clear()
      router.push(`/market/orders/${j.short_code}`)
    } catch (err) {
      toast.error(err?.message || 'Order failed')
      setSubmitting(false)
    }
  }

  return (
    <main>
      <MarketHeader back title="Your cart" sub={cart.vendor_name || 'No items yet'} />
      <div className="max-w-3xl mx-auto px-5 py-6">
        {empty ? (
          <div className="text-center py-16">
            <p className="text-stone-600">Your cart is empty.</p>
            <Link href="/market/shop" className="text-sm underline text-stone-700 mt-2 inline-block">
              Browse vendors →
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
              {cart.items.map((it) => (
                <div key={it.product_id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-800 truncate">{it.name}</div>
                    <div className="text-xs text-stone-500">{money(it.price_cents)} each</div>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-stone-200">
                    <button onClick={() => setQuantity(it.product_id, it.quantity - 1)} className="w-7 h-7 grid place-items-center hover:bg-stone-50 rounded-full"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="text-sm w-6 text-center font-mono">{it.quantity}</span>
                    <button onClick={() => setQuantity(it.product_id, it.quantity + 1)} className="w-7 h-7 grid place-items-center hover:bg-stone-50 rounded-full"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="font-serif text-base text-stone-800 w-20 text-right">{money(it.price_cents * it.quantity)}</div>
                  <button onClick={() => removeItem(it.product_id)} aria-label="Remove" className="text-stone-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm uppercase tracking-widest text-stone-500">Total</span>
                <span className="font-serif text-2xl text-stone-900">{money(totalCents)}</span>
              </div>
            </div>

            <form onSubmit={submit} className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
              <h2 className="font-serif text-lg text-stone-800">Your details</h2>
              <Input label="Email *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <label className="block">
                <span className="text-xs uppercase tracking-widest text-stone-500">Notes (allergies, pickup time …)</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                          className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-300" />
              </label>

              <p className="text-xs text-stone-500">
                Pre-orders are paid by Venmo to <strong>@{cart.vendor_venmo}</strong>. After you submit, you’ll get a unique order code, an “Open Venmo” button, and a confirmation email.
              </p>

              <button type="submit" disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 mt-2 text-sm"
                      style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? 'Placing order…' : `Place order · ${money(totalCents)}`}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

function Input(props) {
  const { label, ...rest } = props
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-stone-500">{label}</span>
      <input {...rest} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-300" />
    </label>
  )
}
