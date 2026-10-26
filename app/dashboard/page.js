'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, mockUserHeaders } from '@/lib/auth-context'
import { toast } from 'sonner'
import { ArrowUpRight, Plus, Calendar, Users, Sparkles, Loader2, Eye, X } from 'lucide-react'
import { TALLY_NEW_DROP_URLS } from '@/lib/dashboard/new-drop-url'
import { formatEmailDate } from '@/lib/email/format'
import { DashboardSidebar, DashboardMobileNav, useUnpaidOrderCount } from '@/components/dropvine/dashboard-nav'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeLocation, normalizeLocationEdit, formatLocation, US_STATES } from '@/lib/location'

// Per-user, so a shared browser doesn't hide the notice for another vendor.
const LOCATION_NOTICE_KEY = 'dropvine_location_notice_dismissed'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading, signOut, configured } = useAuth() || {}
  const idHeaders = mockUserHeaders(user, configured)
  const [drops, setDrops] = useState([])
  const [fetching, setFetching] = useState(true)
  const [publishingId, setPublishingId] = useState(null)
  const [creatingDrop, setCreatingDrop] = useState(false)
  // Vendor tier drives which Tally form URL is used. Falls back to 'free'.
  const [vendorTier, setVendorTier] = useState('free')
  // direct_vendors.trial_ends_at; null = no trial (vendors from before trials).
  const [trialEndsAt, setTrialEndsAt] = useState(null)
  // Saved direct_vendors location, normalized. Null until /api/direct/me
  // returns a vendor row (no row = no location section or notice).
  const [savedLocation, setSavedLocation] = useState(null)
  // Starts true so the notice doesn't flash before localStorage is read.
  const [noticeDismissed, setNoticeDismissed] = useState(true)
  const unpaidCount = useUnpaidOrderCount(user, configured)
  const noticeKey = user ? `${LOCATION_NOTICE_KEY}:${user.id}` : null

  useEffect(() => {
    if (!noticeKey) return
    try { setNoticeDismissed(localStorage.getItem(noticeKey) === '1') } catch { setNoticeDismissed(false) }
  }, [noticeKey])

  const dismissNotice = () => {
    setNoticeDismissed(true)
    try { localStorage.setItem(noticeKey, '1') } catch {}
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const reload = async () => {
    if (!user) return
    setFetching(true)
    try {
      const r = await fetch('/api/drops?creator=me', { headers: idHeaders })
      const d = await r.json()
      setDrops(d.drops || [])
    } catch {
      // leave drops as-is; fetching clears below
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => { if (user) reload() }, [user])

  // Fetch the vendor's tier so the "New drop" CTA routes to the right form,
  // and the trial end date for the trial line.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/direct/me', { headers: idHeaders })
        if (!r.ok) return
        const d = await r.json()
        if (cancelled) return
        if (d?.vendor?.tier) setVendorTier(d.vendor.tier)
        setTrialEndsAt(d?.vendor?.trial_ends_at || null)
        if (d?.vendor) setSavedLocation(normalizeLocation(d.vendor.location_city, d.vendor.location_state))
      } catch {}
    })()
    return () => { cancelled = true }
  }, [user])

  // Open a new tab immediately (avoids popup blockers), fetch a submission
  // token, then redirect the tab to the right Tally form with ?token=...
  const handleNewDrop = async () => {
    if (!user || creatingDrop) return
    const tab = window.open('', '_blank')
    setCreatingDrop(true)
    try {
      const r = await fetch('/api/submission-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...idHeaders },
      })
      const d = await r.json()
      if (!r.ok || !d.token) throw new Error(d.error || 'Could not generate submission token')
      const base = TALLY_NEW_DROP_URLS[vendorTier] || TALLY_NEW_DROP_URLS.free
      tab.location.href = `${base}?token=${d.token}`
    } catch (e) {
      tab?.close()
      toast.error(e?.message || 'Could not open drop form — please try again')
    } finally {
      setCreatingDrop(false)
    }
  }

  const publish = async (drop) => {
    if (!user) return
    setPublishingId(drop.id)
    try {
      const r = await fetch(`/api/market/admin/drops/${drop.id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...idHeaders },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!r.ok || d?.error) { toast.error(d?.error || 'Publish failed'); return }
      toast.success(d.already ? 'Already published.' : 'Published — your drop is now live.')
      setDrops((prev) => prev.map((l) => l.id === drop.id ? { ...l, status: 'published' } : l))
    } catch (e) {
      toast.error(e?.message || 'Publish failed')
    } finally {
      setPublishingId(null)
    }
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
  }

  const upcoming = drops.filter(l => new Date(l.launch_at) > new Date())
  const totalWaitlist = 0
  const trialEndLabel = formatEmailDate(trialEndsAt)
  const trialActive = !!trialEndLabel && new Date(trialEndsAt) > new Date()
  const showLocationNotice = !!savedLocation && (!savedLocation.city || !savedLocation.state) && !noticeDismissed

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <DashboardSidebar active="drops" user={user} signOut={signOut} unpaidCount={unpaidCount} />

      {/* Main */}
      <main className="flex-1 min-w-0">
        <DashboardMobileNav active="drops" unpaidCount={unpaidCount} />
        {showLocationNotice ? (
          <div className="px-6 md:px-12 py-3 border-b border-border text-sm flex items-start justify-between gap-4" style={{ background: '#F3F6F1' }} data-testid="location-notice">
            <a href="#location" className="underline underline-offset-4">Add where you're based so shoppers can find you by location.</a>
            <button onClick={dismissNotice} aria-label="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {trialEndLabel ? (
          <div className="px-6 md:px-12 py-3 border-b border-border text-sm text-muted-foreground" data-testid="trial-status">
            {trialActive
              ? `Free trial: ends ${trialEndLabel}.`
              : "Your free trial has ended. We'll be in touch about your plan."}
          </div>
        ) : null}
        <header className="border-b border-border">
          <div className="px-6 md:px-12 py-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Your vine</div>
              <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter">Your drops</h1>
            </div>
            <button
              onClick={handleNewDrop}
              disabled={creatingDrop}
              className="inline-flex items-center gap-2 text-background px-5 py-3 text-sm hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#2D4A2A' }}
            >
              {creatingDrop ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              New drop
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="px-6 md:px-12 py-10 grid grid-cols-1 sm:grid-cols-3 gap-6 border-b border-border">
          <Stat icon={<Sparkles className="h-4 w-4" />} label="Total drops" value={drops.length} />
          <Stat icon={<Calendar className="h-4 w-4" />} label="Upcoming" value={upcoming.length} />
          <Stat icon={<Users className="h-4 w-4" />} label="Waitlist (all)" value={totalWaitlist} hint="View per drop →" />
        </section>

        {/* Drops list */}
        <section className="px-6 md:px-12 py-12">
          {fetching ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : drops.length === 0 ? (
            <EmptyState onNewDrop={handleNewDrop} creating={creatingDrop} />
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {drops.map(l => {
                const now = new Date()
                const isDraft = l.status === 'draft'
                const isScheduled = l.status === 'scheduled'
                const isClosed = l.status === 'closed' || (l.status === 'published' && l.closes_at && new Date(l.closes_at) < now)
                const isLive = l.status === 'published' && !isClosed

                const statusLabel = isClosed ? null
                  : isScheduled ? 'Scheduled'
                  : isLive ? 'Published'
                  : l.status

                let dateLabel, dateValue
                if (isClosed) {
                  dateLabel = 'Closed'
                  dateValue = null
                } else if (isLive) {
                  dateLabel = 'Closes'
                  dateValue = l.closes_at
                    ? new Date(l.closes_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                    : '—'
                } else {
                  dateLabel = 'Opens'
                  dateValue = new Date(l.launch_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                }

                return (
                  <li key={l.id} className="py-7 grid grid-cols-12 gap-4 items-center group">
                    <div className="col-span-12 md:col-span-6">
                      <div className="flex items-center gap-2 mb-1">
                        {statusLabel ? (
                          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{statusLabel}</span>
                        ) : null}
                        {isDraft ? (
                          <span className="inline-flex items-center text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
                            Needs review
                          </span>
                        ) : null}
                      </div>
                      <div className="font-serif text-2xl tracking-tight">{l.title}</div>
                      <div className="text-sm text-muted-foreground">/l/{l.handle}</div>
                    </div>
                    <div className="col-span-6 md:col-span-3 text-sm">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">{dateLabel}</div>
                      {dateValue ? <div className="tabular-nums">{dateValue}</div> : null}
                    </div>
                    <div className="col-span-6 md:col-span-3 flex items-center justify-end gap-3 text-sm flex-wrap">
                      {isDraft ? (
                        <>
                          <Link
                            href={`/l/${l.handle}?preview=true`}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="h-3.5 w-3.5" /> Preview
                          </Link>
                          <button
                            onClick={() => publish(l)}
                            disabled={publishingId === l.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider disabled:opacity-50"
                            style={{ background: '#F59E0B', color: '#1c1500' }}
                          >
                            {publishingId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Publish
                          </button>
                        </>
                      ) : (
                        <Link href={`/l/${l.handle}`} className="inline-flex items-center gap-1 text-muted-foreground group-hover:text-foreground">
                          View <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {savedLocation ? (
          <LocationSection saved={savedLocation} onSaved={setSavedLocation} idHeaders={idHeaders} />
        ) : null}
      </main>
    </div>
  )
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className="border border-border p-6">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{icon}{label}</div>
      <div className="mt-3 font-serif text-4xl font-light tracking-tighter">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

// "Where you're based" — city + US state, saved via POST /api/direct/me.
// City and state are set together, or both cleared.
function LocationSection({ saved, onSaved, idHeaders }) {
  const [city, setCity] = useState(saved.city)
  const [state, setState] = useState(saved.state)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { ok, text }

  const draft = normalizeLocationEdit(city, state)
  const unchanged = draft.city === saved.city && draft.state === saved.state

  const save = async (e) => {
    e.preventDefault()
    if (draft.error) { setMessage({ ok: false, text: draft.error }); toast.error(draft.error); return }
    setSaving(true)
    setMessage(null)
    try {
      const r = await fetch('/api/direct/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...idHeaders },
        body: JSON.stringify({ location_city: draft.city, location_state: draft.state }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not save your location.')
      const next = normalizeLocation(d.location_city, d.location_state)
      onSaved(next)
      setCity(next.city)
      setState(next.state)
      const text = next.city ? `Saved. Shoppers will see ${formatLocation(next.city, next.state)}.` : 'Location cleared.'
      setMessage({ ok: true, text })
      toast.success(text)
    } catch (err) {
      const text = err?.message || 'Could not save your location.'
      setMessage({ ok: false, text })
      toast.error(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="location" className="px-6 md:px-12 py-12 border-t border-border scroll-mt-6">
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Your profile</div>
      <h2 className="font-serif font-light text-3xl tracking-tighter">Where you're based</h2>
      <form onSubmit={save} className="mt-6 max-w-md space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location-city" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">City</Label>
            <Input id="location-city" value={city} onChange={e => setCity(e.target.value)} onBlur={() => setCity(c => c.trim())} className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" placeholder="e.g. Austin" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-state" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">State</Label>
            <select
              id="location-state"
              value={state}
              onChange={e => setState(e.target.value)}
              className="h-12 w-full rounded-none border-x-0 border-t-0 border-b border-border bg-transparent focus:outline-none focus:border-foreground text-sm text-foreground"
              style={{ paddingLeft: 0 }}
            >
              <option value="">Select a state</option>
              {Object.entries(US_STATES).map(([code, stateName]) => (
                <option key={code} value={code}>{stateName}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Shown publicly as city and state only, never your street address.</p>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            disabled={saving || unchanged}
            className="inline-flex items-center gap-2 text-background px-5 py-3 text-sm hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#2D4A2A' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save location
          </button>
          {message ? (
            <p role="status" className={`text-sm ${message.ok ? 'text-muted-foreground' : 'text-red-700'}`} data-testid="location-save-message">{message.text}</p>
          ) : null}
        </div>
      </form>
    </section>
  )
}

function EmptyState({ onNewDrop, creating }) {
  return (
    <div className="border border-dashed border-border p-12 md:p-20 text-center">
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">On your vine</div>
      <h2 className="font-serif font-light text-3xl md:text-4xl tracking-tighter">Start your first drop.</h2>
      <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm">Set a deadline, share the link, and let your customers order before you make a thing.</p>
      <button
        onClick={onNewDrop}
        disabled={creating}
        className="mt-8 inline-flex items-center gap-2 text-background px-6 py-3 text-sm hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: '#2D4A2A' }}
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Create a drop
      </button>
    </div>
  )
}
