'use client'
import React, { useEffect, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminSubmissionsPage() {
  const [data, setData] = useState({ posts: [], products: [] })
  const [loading, setLoading] = useState(true)

  const load = () => adminFetch('/api/market/admin/submissions').then((r) => r.json()).then((j) => { setData(j); setLoading(false) })
  useEffect(() => { load() }, [])

  const act = async (type, id, action) => {
    const r = await adminFetch(`/api/market/admin/submissions/${type}/${id}/${action}`, { method: 'POST' })
    const j = await r.json()
    if (!r.ok || j?.error) toast.error(j?.error || 'Failed')
    else { toast.success(`${type} ${action}d`); load() }
  }

  const Section = ({ title, type, items }) => (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-2">{title} · {items.length} pending</h2>
      {items.length === 0 ? <p className="text-sm text-stone-500 italic">Nothing pending right now.</p> : (
        <div className="space-y-3">
          {items.map((s) => (
            <article key={s.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-serif text-base text-stone-800">{s.vendors?.name || s.vendor_email || '—'}</div>
                  <div className="text-[11px] text-stone-500">{new Date(s.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => act(type, s.id, 'reject')} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700"><X className="w-3.5 h-3.5" /> Reject</button>
                  <button onClick={() => act(type, s.id, 'approve')} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700"><Check className="w-3.5 h-3.5" /> Approve</button>
                </div>
              </div>
              <pre className="text-xs bg-stone-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(s.raw_payload, null, 2)}</pre>
            </article>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-2">Submissions</h1>
      <p className="text-sm text-stone-500 mb-6">Tally form posts and product submissions awaiting your review.</p>
      {loading ? <p className="text-stone-500">Loading…</p> : (
        <>
          <Section title="Vendor posts" type="post" items={data.posts} />
          <Section title="Vendor products" type="product" items={data.products} />
        </>
      )}
    </AdminShell>
  )
}
