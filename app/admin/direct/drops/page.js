'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { Search, Eye, CheckCircle2, Archive, Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'

// Status filter labels (UI) ↔ DB values
const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'draft',     label: 'Draft' },
  { key: 'published', label: 'Live' },
  { key: 'archived',  label: 'Closed' },
]

const PILL = {
  draft:     { bg: '#FEF3C7', fg: '#92400E', label: 'Draft' },
  published: { bg: '#E2F1DE', fg: '#1f6e1f', label: 'Live' },
  archived:  { bg: '#F2F0EA', fg: '#56534D', label: 'Closed' },
  held:      { bg: '#F2F0EA', fg: '#56534D', label: 'Held' },
}

export default function DirectDropsPage() {
  const [drops, setDrops] = useState([])
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)

  // debounce the search box
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 350); return () => clearTimeout(t) }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (debounced) params.set('q', debounced)
      params.set('page', String(page))
      const r = await adminFetch(`/api/market/admin/direct/drops?${params}`)
      const j = await r.json()
      setDrops(j?.drops || [])
      setTotal(j?.total ?? 0)
      setPageSize(j?.page_size ?? 50)
    } catch (e) { toast.error(e?.message || 'Failed to load') }
    finally { setLoading(false) }
  }, [status, debounced, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [status, debounced])

  const publish = async (drop) => {
    setActionId(drop.id)
    try {
      const r = await adminFetch(`/api/market/admin/drops/${drop.id}/publish`, { method: 'PATCH', body: JSON.stringify({}) })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Publish failed'); return }
      toast.success(j.already ? 'Already published.' : 'Published.')
      setDrops((prev) => prev.map((d) => d.id === drop.id ? { ...d, status: 'published' } : d))
    } catch (e) { toast.error(e?.message || 'Failed') }
    finally { setActionId(null) }
  }

  const archive = async (drop) => {
    if (!confirm(`Archive “${drop.title}”? The public page will return 404; data is preserved.`)) return
    setActionId(drop.id)
    try {
      const r = await adminFetch(`/api/market/admin/direct/drops/${drop.id}/archive`, { method: 'PATCH', body: JSON.stringify({}) })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Archive failed'); return }
      toast.success('Archived.')
      setDrops((prev) => prev.map((d) => d.id === drop.id ? { ...d, status: 'archived' } : d))
    } catch (e) { toast.error(e?.message || 'Failed') }
    finally { setActionId(null) }
  }

  const start = page * pageSize
  const end = Math.min(total, start + drops.length)

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Direct · Drops</h1>
          <p className="text-sm text-stone-500">Every launch across all vendors and statuses. {total} total.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…"
                 className="text-sm bg-transparent focus:outline-none w-72" />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setStatus(f.key)}
              className="text-[11px] uppercase tracking-wider px-2.5 py-1.5 rounded-full"
              style={status === f.key ? { background: '#0E0E0C', color: '#FAFAF7' } : { background: 'white', color: '#56534D', border: '1px solid #E8E5DE' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-stone-500 py-8 text-center">Loading…</p>
        : drops.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
            No drops match this filter.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-stone-500 bg-stone-50">
                  <tr>
                    <th className="px-4 py-3">Drop</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Opens</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {drops.map((d) => {
                    const pill = PILL[d.status] || PILL.held
                    const isBusy = actionId === d.id
                    return (
                      <tr key={d.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="font-serif text-stone-900">{d.title}</div>
                          <div className="text-[11px] text-stone-400 font-mono">/l/{d.handle}</div>
                        </td>
                        <td className="text-stone-700">{d.vendor_name}</td>
                        <td>
                          <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                                style={{ background: pill.bg, color: pill.fg }}>
                            {pill.label}
                          </span>
                        </td>
                        <td className="text-[12px] text-stone-500 tabular-nums">{new Date(d.created_at).toLocaleDateString()}</td>
                        <td className="text-[12px] text-stone-500 tabular-nums">{d.launch_at ? new Date(d.launch_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                        <td className="text-right pr-4">
                          <div className="inline-flex items-center gap-2">
                            {d.status === 'draft' ? (
                              <>
                                <Link href={`/admin/drops/${d.id}/preview`} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900">
                                  <Eye className="w-3 h-3" /> Preview
                                </Link>
                                <button onClick={() => publish(d)} disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full disabled:opacity-50"
                                  style={{ background: '#F59E0B', color: '#1c1500' }}>
                                  {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  Publish
                                </button>
                              </>
                            ) : d.status === 'published' ? (
                              <>
                                <a href={`/l/${d.handle}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900">
                                  View <ExternalLink className="w-3 h-3" />
                                </a>
                                <button onClick={() => archive(d)} disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                                  {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                                  Archive
                                </button>
                              </>
                            ) : (
                              <a href={`/l/${d.handle}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700">
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500 mt-3">
              <span>Showing {start + 1}–{end} of {total}</span>
              <div className="inline-flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-stone-200 disabled:opacity-30">
                  <ChevronLeft className="w-3 h-3" /> Prev
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={end >= total}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-stone-200 disabled:opacity-30">
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </>
        )}
    </AdminShell>
  )
}
