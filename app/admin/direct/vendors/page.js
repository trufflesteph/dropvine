'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { Plus, Search, ExternalLink } from 'lucide-react'

const TIERS = ['all', 'free', 'maker', 'studio']

export default function DirectVendorsListPage() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState('all')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const r = await adminFetch('/api/market/admin/direct/vendors')
        const j = await r.json()
        setVendors(j?.vendors || [])
      } catch (e) { toast.error(e?.message || 'Failed') }
      finally { setLoading(false) }
    })()
  }, [])

  const filtered = useMemo(() => {
    let v = vendors
    if (!showInactive) v = v.filter((x) => x.active !== false)
    if (tier !== 'all') v = v.filter((x) => x.tier === tier)
    if (search.trim()) {
      const s = search.toLowerCase()
      v = v.filter((x) =>
        (x.business_name || '').toLowerCase().includes(s) ||
        (x.slug || '').toLowerCase().includes(s) ||
        (x.profile?.email || '').toLowerCase().includes(s)
      )
    }
    return v
  }, [vendors, tier, search, showInactive])

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Direct · Vendors</h1>
          <p className="text-sm text-stone-500">Creators registered to publish Dropvine Direct drops. {vendors.length} total · {vendors.filter((v) => v.active).length} active.</p>
        </div>
        <Link href="/admin/direct/vendors/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs uppercase tracking-wider bg-stone-900 text-stone-50">
          <Plus className="w-3.5 h-3.5" /> New vendor
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-stone-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search name, slug, or email…"
                 className="text-sm bg-transparent focus:outline-none w-72" />
        </div>
        <div className="flex gap-1">
          {TIERS.map((t) => (
            <button key={t} onClick={() => setTier(t)}
              className="text-[11px] uppercase tracking-wider px-2.5 py-1.5 rounded-full"
              style={tier === t ? { background: '#0E0E0C', color: '#FAFAF7' } : { background: 'white', color: '#56534D', border: '1px solid #E8E5DE' }}>
              {t === 'all' ? 'All tiers' : t}
            </button>
          ))}
        </div>
        <label className="text-xs text-stone-500 inline-flex items-center gap-1.5 ml-auto">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {loading ? <p className="text-stone-500 py-8 text-center">Loading…</p>
        : filtered.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
            No vendors match this filter.{' '}
            <Link href="/admin/direct/vendors/new" className="underline">Create one</Link>.
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-stone-500 bg-stone-50">
                <tr><th className="px-4 py-3">Business</th><th>Slug</th><th>Owner</th><th>Tier</th><th>Status</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/direct/vendors/${v.id}`} className="font-serif text-stone-900 hover:underline">{v.business_name || '—'}</Link>
                    </td>
                    <td className="text-stone-500 font-mono text-[12px]">/{v.slug}</td>
                    <td className="text-stone-700">
                      {v.profile ? (
                        <>
                          <div>{v.profile.display_name || v.profile.full_name || '—'}</div>
                          <div className="text-[11px] text-stone-400">{v.profile.email}</div>
                        </>
                      ) : <span className="text-stone-400 italic">Unlinked</span>}
                    </td>
                    <td className="uppercase text-[11px] tracking-wider text-stone-600">{v.tier}</td>
                    <td>
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={v.active
                          ? { background: '#E2F1DE', color: '#1f6e1f' }
                          : { background: '#F2F0EA', color: '#56534D' }}>
                        {v.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right pr-4">
                      <Link href={`/admin/direct/vendors/${v.id}`} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900">
                        Edit <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </AdminShell>
  )
}
