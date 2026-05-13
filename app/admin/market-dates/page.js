'use client'
import React, { useEffect, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'

function fmt(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }

export default function AdminDatesPage() {
  const [dates, setDates] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => adminFetch('/api/market/admin/dates').then((r) => r.json()).then((j) => { setDates(j?.dates || []); setLoading(false) })
  useEffect(() => { load() }, [])

  const update = async (id, patch) => {
    const r = await adminFetch(`/api/market/admin/dates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    const j = await r.json()
    if (!r.ok || j?.error) toast.error(j?.error || 'Failed')
    else { toast.success('Updated'); load() }
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-6">Market dates</h1>
      {loading ? <p className="text-stone-500">Loading…</p> : (
        <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
          {dates.map((d) => (
            <div key={d.id} className="p-4 flex flex-wrap items-center gap-3">
              <span className="font-serif text-stone-800 w-44">{fmt(d.date)}</span>
              <span className="text-xs font-mono text-stone-500">{(d.start_time || '').slice(0,5)}–{(d.end_time || '').slice(0,5)}</span>
              <input type="text" defaultValue={d.notes || ''} placeholder="Notes (e.g. holiday)"
                     onBlur={(e) => { if ((d.notes || '') !== e.target.value) update(d.id, { notes: e.target.value || null }) }}
                     className="flex-1 min-w-[200px] rounded-lg border border-stone-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-stone-300" />
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={!!d.is_cancelled} onChange={(e) => update(d.id, { is_cancelled: e.target.checked })} />
                Cancelled
              </label>
              {d.is_cancelled ? <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-rose-50 text-rose-700">DARK</span> : null}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
