'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { Countdown } from '@/components/dropvine/countdown'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Trash2, CheckCircle2, AlertTriangle, Clock, BellRing, BellOff, Send } from 'lucide-react'

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

