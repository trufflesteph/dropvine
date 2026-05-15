'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { Countdown } from '@/components/dropvine/countdown'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Trash2, CheckCircle2, AlertTriangle, Clock, BellRing, BellOff, Send, Plus, X, GripVertical, Image as ImageIcon, Save } from 'lucide-react'

// Admin draft-drop preview — renders the launch identical to /l/[handle],
// with a fixed banner on top for review actions (publish / delete).
// All admin-only chrome lives in the banner; the preview body is a faithful
// reproduction of the public page so the reviewer sees exactly what shoppers will.

// Convert ISO → datetime-local input value (no seconds, local TZ).
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
function fmtPretty(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminDropPreviewPage() {
  const { id } = useParams()
  const router = useRouter()
  const [launch, setLaunch] = useState(null)
  const [creator, setCreator] = useState(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sendingNow, setSendingNow] = useState(false)
  const [notifyAtInput, setNotifyAtInput] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const r = await adminFetch(`/api/market/admin/drops/${id}`)
        if (r.status === 404) { if (!cancelled) setNotFound(true); return }
        const d = await r.json()
        if (!cancelled) { setLaunch(d.launch); setCreator(d.creator) }
      } catch (e) {
        if (!cancelled) toast.error(e?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Keep the datetime-local field in sync when launch loads / changes.
  useEffect(() => {
    if (launch?.notify_at) setNotifyAtInput(toLocalInput(launch.notify_at))
    else setNotifyAtInput('')
  }, [launch?.notify_at])

  const publish = async () => {
    if (!launch) return
    setPublishing(true)
    try {
      const body = {}
      const iso = fromLocalInput(notifyAtInput)
      // Always send the key so the server applies our intent (null = send immediately).
      body.notify_at = iso
      const r = await adminFetch(`/api/market/admin/drops/${launch.id}/publish`, {
        method: 'PATCH', body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok || d?.error) { toast.error(d?.error || 'Publish failed'); return }
      if (d.already) toast.success('Already published.')
      else if (d.scheduled) toast.success(`Published. Notification scheduled for ${fmtPretty(d.scheduled_for)}.`)
      else toast.success('Published — notification sent.')
      setLaunch(d.launch)
    } catch (e) {
      toast.error(e?.message || 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  const sendNow = async () => {
    if (!launch) return
    if (!confirm('Send the notification to the waitlist right now?')) return
    setSendingNow(true)
    try {
      const r = await adminFetch(`/api/market/admin/drops/${launch.id}/notify-now`, { method: 'POST', body: '{}' })
      const d = await r.json()
      if (!r.ok || d?.error) { toast.error(d?.error || 'Send failed'); return }
      if (d.alreadyNotified) toast('Already notified.')
      else if (d.skipped) toast(`Skipped: ${d.skipped}`)
      else toast.success(`Sent. Email: ${d?.sent?.email ?? 0}, SMS: ${d?.sent?.sms ?? 0}`)
      // Refresh launch row so banner reflects the new notified_at.
      const lr = await adminFetch(`/api/market/admin/drops/${launch.id}`)
      const ld = await lr.json()
      if (ld?.launch) setLaunch(ld.launch)
    } catch (e) {
      toast.error(e?.message || 'Send failed')
    } finally {
      setSendingNow(false)
    }
  }

  const remove = async () => {
    if (!launch) return
    if (!confirm(`Delete this draft permanently? “${launch.title}” will be removed.`)) return
    setDeleting(true)
    try {
      const r = await adminFetch(`/api/market/admin/drops/${launch.id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d?.error) { toast.error(d?.error || 'Delete failed'); return }
      toast.success('Draft deleted.')
      router.replace('/admin')
    } catch (e) {
      toast.error(e?.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <AdminShell><div className="py-20 text-center text-sm text-stone-500">Loading draft…</div></AdminShell>
  }
  if (notFound) {
    return (
      <AdminShell>
        <div className="py-20 text-center">
          <div className="font-serif text-2xl text-stone-800 mb-2">Draft not found</div>
          <p className="text-sm text-stone-500">It may have already been published or deleted.</p>
          <Link href="/admin" className="inline-block mt-6 text-sm underline text-stone-600">← Back to dashboard</Link>
        </div>
      </AdminShell>
    )
  }
  if (!launch) return null

  const isDraft = launch.status === 'draft'
  const isLive = new Date(launch.launch_at) <= new Date()
  const submittedAt = launch.created_at ? new Date(launch.created_at).toLocaleString() : '—'

  return (
    <div>
      {/* Admin-only banner */}
      <div
        role="region"
        aria-label="Draft preview banner"
        className="sticky top-0 z-40 border-b"
        style={{ background: isDraft ? '#FEE7E2' : '#E2F1DE', borderColor: isDraft ? '#9F2A14' : '#1f6e1f' }}
      >
        <div className="max-w-6xl mx-auto px-5 py-3 flex flex-wrap items-center gap-3 text-[13px]">
          {isDraft ? (
            <AlertTriangle className="w-4 h-4" style={{ color: '#9F2A14' }} />
          ) : (
            <CheckCircle2 className="w-4 h-4" style={{ color: '#1f6e1f' }} />
          )}
          <strong style={{ color: isDraft ? '#9F2A14' : '#1f6e1f' }}>
            {isDraft ? 'DRAFT — not yet visible to shoppers' : 'PUBLISHED — live for shoppers'}
          </strong>
          <span className="text-stone-600 ml-2">
            <span className="text-stone-400">Vendor:</span>{' '}
            <strong>{creator?.display_name || creator?.full_name || creator?.email || 'Unmatched'}</strong>
            {creator?.email ? <span className="text-stone-400"> &middot; {creator.email}</span> : null}
          </span>
          <span className="text-stone-500"><span className="text-stone-400">Submitted:</span> {submittedAt}</span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Link href="/admin" className="text-xs text-stone-600 underline">All</Link>
            {isDraft ? (
              <>
                <button
                  onClick={publish}
                  disabled={publishing || deleting}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-stone-900 text-stone-50 disabled:opacity-50"
                >
                  {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Publish
                </button>
                <button
                  onClick={remove}
                  disabled={publishing || deleting}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Delete
                </button>
              </>
            ) : (
              <Link
                href={`/l/${launch.handle}`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-stone-900 text-stone-50"
              >
                View public page <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Notification scheduling row — visible for draft + published */}
        <NotifyRow
          launch={launch}
          isDraft={isDraft}
          notifyAtInput={notifyAtInput}
          setNotifyAtInput={setNotifyAtInput}
          sendingNow={sendingNow}
          sendNow={sendNow}
        />
      </div>

      {/* Shopper-identical preview */}
      <main className="min-h-screen bg-background text-foreground">
        <header className="absolute top-12 inset-x-0 z-20">
          <div className="container flex items-center justify-between py-6">
            <Link href="/" className="font-serif text-lg tracking-tighter">Dropvine</Link>
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Launch — {launch.handle}</div>
          </div>
        </header>

        {/* Hero */}
        <section className="pt-44 pb-20 md:pt-56 md:pb-28">
          <div className="container max-w-5xl">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-8">
              {isLive ? 'Now open' : 'Upcoming launch'}
            </div>
            <h1 className="font-serif font-light text-5xl sm:text-6xl md:text-8xl leading-[0.96] tracking-tight text-balance">
              {launch.title}
            </h1>
            {launch.tagline ? (
              <p className="mt-8 font-serif italic text-2xl md:text-3xl text-muted-foreground max-w-3xl tracking-tight">{launch.tagline}</p>
            ) : null}
          </div>
        </section>

        {/* Cover image */}
        {launch.cover_url ? (
          <section className="container max-w-5xl pb-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={launch.cover_url} alt="" className="w-full h-auto border border-border" />
          </section>
        ) : null}

        {/* Countdown / live */}
        <section className="border-y border-border bg-stone-100/60">
          <div className="container py-16 md:py-24">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-6">
              {isLive ? 'The doors are open' : 'Opens in'}
            </div>
            {isLive ? (
              <div className="font-serif text-5xl md:text-7xl tracking-tight">It’s time.</div>
            ) : (
              <Countdown target={launch.launch_at} size="lg" />
            )}
          </div>
        </section>

        {/* Body */}
        <section className="container py-24 md:py-32 grid md:grid-cols-12 gap-12">
          <div className="md:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">The piece</div>
            <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-line text-pretty">
              {launch.description || 'No description provided.'}
            </p>
            {launch.price_cents > 0 ? (
              <div className="mt-12 pt-8 border-t border-border">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Price at release</div>
                <div className="font-serif text-4xl tracking-tight">${(launch.price_cents / 100).toFixed(2)}</div>
              </div>
            ) : null}
            {launch.pickup_details ? (
              <div className="mt-8 pt-8 border-t border-border">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Pickup &amp; collection</div>
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{launch.pickup_details}</p>
              </div>
            ) : null}
          </div>

          <aside className="md:col-span-5 md:sticky md:top-24 self-start">
            <div className="border border-border p-8 md:p-10 bg-background">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Reserve / Order</div>
              <div className="font-serif text-2xl md:text-3xl tracking-tight">
                {launch.collection_mode === 'pre-order' ? 'Pre-order this drop.' : 'Be present at release.'}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Capacity: <strong className="text-foreground">{launch.capacity ?? 'unlimited'}</strong><br />
                Collection mode: <strong className="text-foreground">{launch.collection_mode || 'pre-order'}</strong>
                {launch.venmo_handle ? <><br />Pay-to: <strong className="text-foreground">@{launch.venmo_handle}</strong></> : null}
              </p>
              <p className="mt-6 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                (Live ordering UI appears once published.)
              </p>
            </div>
          </aside>
        </section>

        {/* Product catalogue editor — admins can curate launch_products here. */}
        <section className="container max-w-5xl pb-24">
          <ProductsEditor launchId={launch.id} />
        </section>

        {/* Gallery */}
        {Array.isArray(launch.photo_urls) && launch.photo_urls.length ? (
          <section className="container max-w-5xl pb-24 grid grid-cols-2 md:grid-cols-3 gap-3">
            {launch.photo_urls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt="" className="w-full h-auto border border-border" />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  )
}

// Notification scheduling sub-component rendered inside the sticky preview banner.
// Renders one of four states:
//   1. Draft → date+time picker labelled "Notify list at" (sent as notify_at on publish).
//   2. Published + future notify_at + null notified_at → "Notification scheduled for …" + "Send now".
//   3. Published + notified_at set → "Notification sent …" (green).
//   4. Published + both null → "Notification not sent" + "Send now".
function NotifyRow({ launch, isDraft, notifyAtInput, setNotifyAtInput, sendingNow, sendNow }) {
  const tone = (bg, fg, border) => ({ background: bg, color: fg, borderColor: border })

  if (isDraft) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-3 border-t flex flex-wrap items-center gap-3 text-[12px]"
           style={tone('#FFF7E6', '#7A5A00', '#F4D27A')}>
        <Clock className="w-4 h-4" />
        <label className="font-medium">Notify list at</label>
        <input
          type="datetime-local"
          value={notifyAtInput}
          onChange={(e) => setNotifyAtInput(e.target.value)}
          className="text-[12px] bg-white border border-stone-300 rounded px-2 py-1"
        />
        <span className="text-stone-500">Leave blank to notify immediately on publish.</span>
        {notifyAtInput ? (
          <button
            type="button"
            onClick={() => setNotifyAtInput('')}
            className="text-[11px] text-stone-500 underline"
          >
            Clear
          </button>
        ) : null}
      </div>
    )
  }

  // Published states
  const now = new Date()
  const notifyAt = launch.notify_at ? new Date(launch.notify_at) : null
  const notifiedAt = launch.notified_at ? new Date(launch.notified_at) : null
  const fmt = (d) => d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''

  if (notifiedAt) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-3 border-t flex items-center gap-3 text-[12px]"
           style={tone('#E2F1DE', '#1f6e1f', '#A7D6A0')}>
        <CheckCircle2 className="w-4 h-4" />
        <span><strong>Notification sent</strong> {fmt(notifiedAt)}</span>
      </div>
    )
  }
  if (notifyAt && notifyAt > now) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-3 border-t flex flex-wrap items-center gap-3 text-[12px]"
           style={tone('#FFF7E6', '#7A5A00', '#F4D27A')}>
        <BellRing className="w-4 h-4" />
        <span><strong>Notification scheduled for</strong> {fmt(notifyAt)}</span>
        <button
          type="button"
          onClick={sendNow}
          disabled={sendingNow}
          className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-stone-900 text-stone-50 disabled:opacity-50"
        >
          {sendingNow ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Send now
        </button>
      </div>
    )
  }
  // Both null — drop is live, nothing has been sent.
  return (
    <div className="max-w-6xl mx-auto px-5 py-3 border-t flex flex-wrap items-center gap-3 text-[12px]"
         style={tone('#F2F0EA', '#56534D', '#D8D5CD')}>
      <BellOff className="w-4 h-4" />
      <span><strong>Notification not sent</strong></span>
      <button
        type="button"
        onClick={sendNow}
        disabled={sendingNow}
        className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-stone-900 text-stone-50 disabled:opacity-50"
      >
        {sendingNow ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        Send now
      </button>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Products editor — manage launch_products for this launch. Renders below the
// preview body. When at least one row is saved, the public /l/[handle] page
// switches from single-SKU mode to the catalogue grid.
// ---------------------------------------------------------------------------

// Tiny RFC-4180-ish CSV parser (client-side mirror of lib/markets/tally-products.js).
// Pure JS, no deps — safe to ship to the browser.
function parseCsvClient(text) {
  const rows = []; let row = []; let field = ''; let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\r') { /* swallow */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += ch
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c && c.trim().length))
}

function csvRowsToProducts(rows) {
  if (!rows.length) return []
  // Header detection: if first row has known column names, treat as headers; else assume name,price,quantity,description,photo_url order.
  const lower = rows[0].map((c) => String(c || '').toLowerCase().trim().replace(/[_\s-]+/g, ''))
  const headerKeys = ['name', 'price', 'quantity', 'description', 'desc', 'photourl', 'photo', 'image', 'title']
  const looksLikeHeader = lower.some((k) => headerKeys.includes(k))
  const map = {}
  let body = rows
  if (looksLikeHeader) {
    lower.forEach((k, i) => {
      if (k === 'name' || k === 'product' || k === 'title') map.name = i
      else if (k === 'description' || k === 'desc') map.description = i
      else if (k === 'price' || k === 'cost') map.price = i
      else if (k === 'quantity' || k === 'qty' || k === 'capacity' || k === 'stock') map.quantity = i
      else if (k === 'photourl' || k === 'photo' || k === 'image' || k === 'imageurl' || k === 'photolink') map.photo_url = i
    })
    body = rows.slice(1)
  } else {
    // Positional fallback.
    map.name = 0; map.price = 1; map.quantity = 2; map.description = 3; map.photo_url = 4
  }
  if (map.name == null) return []
  const out = []
  for (const r of body) {
    const name = String(r[map.name] || '').trim()
    if (!name) continue
    const priceRaw = r[map.price] != null ? String(r[map.price]).replace(/[^0-9.\-]/g, '') : ''
    const priceNum = parseFloat(priceRaw)
    const price_cents = Number.isFinite(priceNum)
      ? (priceNum >= 1000 ? Math.round(priceNum) : Math.round(priceNum * 100))
      : 0
    const quantityStr = r[map.quantity] != null ? String(r[map.quantity]).replace(/[^0-9\-]/g, '') : ''
    const quantity = quantityStr ? Math.max(0, parseInt(quantityStr, 10)) : null
    out.push({
      _new: true,
      name,
      description: map.description != null && r[map.description] ? String(r[map.description]).trim() : null,
      price_cents,
      quantity,
      photo_url: map.photo_url != null && r[map.photo_url] ? String(r[map.photo_url]).trim() : null,
      sort_order: out.length,
    })
  }
  return out
}

function ProductsEditor({ launchId }) {
  const [rows, setRows] = useState(null)         // null = loading; [] = none
  const [migrationPending, setMigrationPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvMode, setCsvMode] = useState('append') // 'append' | 'replace'

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await adminFetch(`/api/market/admin/drops/${launchId}/products`)
        const d = await r.json()
        if (cancelled) return
        if (!r.ok) { toast.error(d?.error || 'Failed to load products'); setRows([]); return }
        setRows(d.products || [])
        setMigrationPending(!!d.migration_pending)
      } catch (e) {
        if (!cancelled) { toast.error(e?.message || 'Failed to load'); setRows([]) }
      }
    }
    if (launchId) load()
    return () => { cancelled = true }
  }, [launchId])

  const addRow = () => {
    setRows((r) => [...(r || []), {
      _new: true, name: '', description: '', price_cents: 0,
      quantity: null, photo_url: '', sort_order: (r?.length || 0),
    }])
    setDirty(true)
  }

  const removeRow = (idx) => {
    setRows((r) => (r || []).filter((_, i) => i !== idx))
    setDirty(true)
  }

  const updateRow = (idx, patch) => {
    setRows((r) => (r || []).map((row, i) => i === idx ? { ...row, ...patch } : row))
    setDirty(true)
  }

  const moveRow = (idx, delta) => {
    setRows((r) => {
      const next = [...(r || [])]
      const tgt = idx + delta
      if (tgt < 0 || tgt >= next.length) return next
      ;[next[idx], next[tgt]] = [next[tgt], next[idx]]
      return next.map((row, i) => ({ ...row, sort_order: i }))
    })
    setDirty(true)
  }

  // Drag-and-drop reorder. Uses HTML5 native DnD — keyboard accessibility
  // still served by the ↑/↓ buttons.
  const onDragStartRow = (idx) => () => setDragIdx(idx)
  const onDragOverRow = (idx) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overIdx !== idx) setOverIdx(idx)
  }
  const onDropRow = (idx) => (e) => {
    e.preventDefault()
    const src = dragIdx
    setDragIdx(null); setOverIdx(null)
    if (src == null || src === idx) return
    setRows((r) => {
      const next = [...(r || [])]
      const [moved] = next.splice(src, 1)
      next.splice(idx, 0, moved)
      return next.map((row, i) => ({ ...row, sort_order: i }))
    })
    setDirty(true)
  }
  const onDragEnd = () => { setDragIdx(null); setOverIdx(null) }

  const importCsv = () => {
    const txt = csvText.trim()
    if (!txt) { toast.error('Paste some CSV first.'); return }
    const parsed = parseCsvClient(txt)
    const newRows = csvRowsToProducts(parsed)
    if (!newRows.length) {
      toast.error('No products found in CSV. First column should be the product name.')
      return
    }
    setRows((cur) => {
      const base = csvMode === 'replace' ? [] : (cur || [])
      const offset = base.length
      const merged = [...base, ...newRows.map((p, i) => ({ ...p, sort_order: offset + i }))]
      return merged
    })
    setDirty(true)
    setCsvText('')
    setCsvOpen(false)
    toast.success(`Imported ${newRows.length} product${newRows.length === 1 ? '' : 's'} (${csvMode}). Click Save to persist.`)
  }

  const save = async () => {
    if (!rows) return
    // Validate: name required, price >= 0.
    const cleaned = rows.map((r, i) => ({
      id: r.id,
      name: (r.name || '').trim(),
      description: (r.description || '').trim() || null,
      price_cents: Math.max(0, parseInt(r.price_cents || 0, 10) || 0),
      quantity: r.quantity === '' || r.quantity == null ? null : Math.max(0, parseInt(r.quantity, 10) || 0),
      photo_url: (r.photo_url || '').trim() || null,
      sort_order: i,
    })).filter((r) => r.name)
    setSaving(true)
    try {
      const r = await adminFetch(`/api/market/admin/drops/${launchId}/products`, {
        method: 'PUT', body: JSON.stringify({ products: cleaned }),
      })
      const d = await r.json()
      if (!r.ok || d?.error) { toast.error(d?.error || 'Save failed'); return }
      setRows(d.products || [])
      setDirty(false)
      toast.success(`Saved · ${d.counts.inserted} added · ${d.counts.updated} updated · ${d.counts.deleted} removed`)
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (rows == null) {
    return <div className="text-sm text-stone-400 py-10 text-center">Loading products…</div>
  }

  return (
    <div className="border border-border bg-background p-6 md:p-10">
      <div className="flex items-end justify-between gap-3 mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Multi-product catalogue</div>
          <h2 className="font-serif text-2xl md:text-3xl tracking-tight mt-1">Products</h2>
          <p className="text-xs text-muted-foreground mt-1">
            When you add at least one product here, the public drop page switches from a single-price flow
            to a catalogue grid with per-product quantity steppers. Each product&rsquo;s <em>Quantity</em>{' '}
            is a hard cap. Drag rows to reorder, or paste a CSV to bulk-import.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setCsvOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50">
            Paste CSV
          </button>
          <button onClick={addRow}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50">
            <Plus className="w-3 h-3" /> Add product
          </button>
          <button onClick={save} disabled={!dirty || saving}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-stone-900 text-stone-50 disabled:opacity-40">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>

      {csvOpen ? (
        <div className="mb-5 border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">Paste CSV</div>
            <div className="flex items-center gap-2 text-[11px]">
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input type="radio" name="csvmode" checked={csvMode === 'append'} onChange={() => setCsvMode('append')} />
                Append
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input type="radio" name="csvmode" checked={csvMode === 'replace'} onChange={() => setCsvMode('replace')} />
                Replace all
              </label>
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mb-2">
            Expected columns: <code>name,price,quantity,description,photo_url</code> (in any order if a header row is present). Prices can be dollars (8.50) or cents (850).
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`name,price,quantity,description,photo_url\nApples,8.00,50,Crisp Honeycrisp,https://...\nBread,12.00,10,Sourdough loaf,`}
            rows={6}
            className="w-full font-mono text-xs bg-white border border-stone-200 rounded px-3 py-2"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button onClick={() => { setCsvText(''); setCsvOpen(false) }}
                    className="text-[11px] text-stone-500 underline">Cancel</button>
            <button onClick={importCsv}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-stone-900 text-stone-50">
              Import
            </button>
          </div>
        </div>
      ) : null}

      {migrationPending ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-xs mb-4">
          The <code>launch_products</code> table has not been provisioned yet.
          Apply <code className="mx-1">supabase/migrations/2026-06-multi-product.sql</code> in your Supabase SQL editor
          to enable multi-product drops.
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="text-sm text-stone-500 text-center py-12 border border-dashed border-stone-300">
          No products yet — public page will use single-price fallback.
          <div className="mt-2"><button onClick={addRow} className="underline">Add the first product</button></div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <ProductRow
              key={row.id || `new-${idx}`}
              idx={idx}
              row={row}
              total={rows.length}
              isDragging={dragIdx === idx}
              isDragOver={overIdx === idx && dragIdx != null && dragIdx !== idx}
              onDragStart={onDragStartRow(idx)}
              onDragOver={onDragOverRow(idx)}
              onDrop={onDropRow(idx)}
              onDragEnd={onDragEnd}
              onChange={(patch) => updateRow(idx, patch)}
              onRemove={() => removeRow(idx)}
              onMoveUp={() => moveRow(idx, -1)}
              onMoveDown={() => moveRow(idx, 1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductRow({ idx, row, total, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd, onChange, onRemove, onMoveUp, onMoveDown }) {
  // price_cents stored as cents; we display dollars in the input.
  const priceDollars = row.price_cents != null && row.price_cents !== ''
    ? (Number(row.price_cents) / 100).toFixed(2) : ''
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`border p-4 grid grid-cols-12 gap-3 items-start transition ${
        isDragging ? 'border-stone-400 opacity-50' : isDragOver ? 'border-stone-900 bg-stone-50' : 'border-stone-200'
      }`}
    >
      <div className="col-span-12 md:col-span-2 flex flex-col gap-2">
        <div className="aspect-square bg-stone-50 border border-stone-200 flex items-center justify-center overflow-hidden">
          {row.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.photo_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <ImageIcon className="w-6 h-6 text-stone-300" />
          )}
        </div>
        <input
          type="url"
          value={row.photo_url || ''}
          onChange={(e) => onChange({ photo_url: e.target.value })}
          placeholder="https://photo.jpg"
          className="text-[11px] bg-white border border-stone-200 rounded px-2 py-1 w-full font-mono"
        />
      </div>
      <div className="col-span-12 md:col-span-7 space-y-2">
        <input
          type="text"
          value={row.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Product name"
          className="w-full font-serif text-lg bg-white border border-stone-200 rounded px-3 py-2"
        />
        <textarea
          value={row.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Description (optional)"
          rows={2}
          className="w-full text-sm bg-white border border-stone-200 rounded px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-stone-500">Price ($)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={priceDollars}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                onChange({ price_cents: Number.isFinite(n) ? Math.round(n * 100) : 0 })
              }}
              placeholder="0.00"
              className="mt-0.5 w-full bg-white border border-stone-200 rounded px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-stone-500">Quantity cap</span>
            <input
              type="number"
              min="0"
              value={row.quantity ?? ''}
              onChange={(e) => onChange({ quantity: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              placeholder="Unlimited"
              className="mt-0.5 w-full bg-white border border-stone-200 rounded px-3 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>
      <div className="col-span-12 md:col-span-3 flex md:flex-col items-end gap-1">
        <button onClick={onRemove} title="Remove" aria-label="Remove product"
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white border border-stone-300 text-stone-600 hover:bg-stone-50">
          <X className="w-3 h-3" /> Remove
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={idx === 0}
                  title="Move up" aria-label="Move up"
                  className="inline-flex items-center px-1.5 py-1 rounded border border-stone-200 text-stone-500 disabled:opacity-30 hover:bg-stone-50">
            ↑
          </button>
          <button onClick={onMoveDown} disabled={idx >= total - 1}
                  title="Move down" aria-label="Move down"
                  className="inline-flex items-center px-1.5 py-1 rounded border border-stone-200 text-stone-500 disabled:opacity-30 hover:bg-stone-50">
            ↓
          </button>
          <span className="text-[10px] text-stone-400 ml-1"><GripVertical className="w-3 h-3 inline" />{idx + 1}</span>
        </div>
      </div>
    </div>
  )
}
