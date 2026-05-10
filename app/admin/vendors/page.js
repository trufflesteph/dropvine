'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { Plus, Eye, EyeOff } from 'lucide-react'

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState(null)
  useEffect(() => { adminFetch('/api/market/admin/vendors').then((r) => r.json()).then((j) => setVendors(j?.vendors || [])) }, [])

  return (
    <AdminShell>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Vendors</h1>
          <p className="text-stone-500 text-sm">Manage market vendors, booth assignments and pre-order settings.</p>
        </div>
        <Link href="/admin/vendors/new" className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-stone-900 text-stone-50 text-sm">
          <Plus className="w-4 h-4" /> Add vendor
        </Link>
      </div>
      {vendors === null ? <p className="text-stone-500">Loading…</p> : (
        <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
          {vendors.length === 0 ? <p className="p-5 text-sm text-stone-500">No vendors yet.</p> :
            vendors.map((v) => (
              <Link key={v.id} href={`/admin/vendors/${v.id}`} className="p-3 px-4 flex items-center gap-3 hover:bg-stone-50">
                <span className="font-mono text-xs text-stone-500 w-12">#{v.booth_number ?? '—'}</span>
                <span className="flex-1 truncate">
                  <span className="font-serif text-stone-800">{v.name}</span>
                  {v.tagline ? <span className="text-xs text-stone-500 ml-2">{v.tagline}</span> : null}
                </span>
                <span className="flex flex-wrap gap-1 max-w-[200px] justify-end">
                  {(v.categories || []).slice(0, 2).map((c) => (
                    <span key={c} className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">{c}</span>
                  ))}
                </span>
                {v.accepts_preorders ? <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Pre-order</span> : null}
                <span className="text-stone-400">
                  {v.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-stone-300" />}
                </span>
              </Link>
            ))}
        </div>
      )}
    </AdminShell>
  )
}
