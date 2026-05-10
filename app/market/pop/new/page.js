'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import MarketHeader from '@/components/markets/MarketHeader'
import { useAuth } from '@/lib/auth-context'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { colorFromString } from '@/lib/markets/pop-icons'

export default function NewChildPage() {
  const router = useRouter()
  const { user } = useAuth() || {}
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return (
      <main>
        <MarketHeader back title="Add a child" />
        <div className="max-w-md mx-auto px-5 py-12 text-center text-stone-600">
          You need to sign in first.
        </div>
      </main>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Name required')
    setSubmitting(true)
    try {
      const res = await fetch('/api/market/pop/children', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), age: age ? parseInt(age, 10) : null }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) { toast.error(j?.error || 'Failed'); setSubmitting(false); return }
      toast.success(`${j.child.name} added`)
      router.replace(`/market/pop/${j.child.id}`)
    } catch (e) {
      toast.error(e?.message || 'Failed')
      setSubmitting(false)
    }
  }

  const previewColour = colorFromString(name || '?')

  return (
    <main>
      <MarketHeader back title="Add a child" />
      <form onSubmit={submit} className="max-w-md mx-auto px-5 py-6 space-y-5">
        <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="w-16 h-16 rounded-full grid place-items-center font-serif text-2xl text-white"
               style={{ background: previewColour }}>
            {(name || '?')[0].toUpperCase()}
          </div>
          <p className="text-xs text-stone-500">A colourful avatar is generated automatically from your child’s name.</p>
        </div>
        <Field label="Name *" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        <Field label="Age (optional)" type="number" min="0" max="18" value={age} onChange={(e) => setAge(e.target.value)} />
        <button type="submit" disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm"
                style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitting ? 'Adding…' : 'Add child'}
        </button>
      </form>
    </main>
  )
}

function Field({ label, ...rest }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-stone-500">{label}</span>
      <input {...rest} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-300" />
    </label>
  )
}
