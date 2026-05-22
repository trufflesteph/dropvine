'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import { ArrowUpRight, Plus, Calendar, Users, Sparkles, Loader2, Eye } from 'lucide-react'
import { DropvineLogo } from '@/components/dropvine/logo'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth() || {}
  const [launches, setLaunches] = useState([])
  const [fetching, setFetching] = useState(true)
  const [publishingId, setPublishingId] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const reload = async () => {
    if (!user) return
    setFetching(true)
    const r = await fetch('/api/launches?creator=me', { headers: { 'x-user-id': user.id } })
    const d = await r.json()
    setLaunches(d.launches || [])
    setFetching(false)
  }

  useEffect(() => { if (user) reload() }, [user])

  const publish = async (launch) => {
    if (!user) return
    setPublishingId(launch.id)
    try {
      const r = await fetch(`/api/market/admin/drops/${launch.id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!r.ok || d?.error) { toast.error(d?.error || 'Publish failed'); return }
      toast.success(d.already ? 'Already published.' : 'Published — your drop is now live.')
      // Optimistic local update
      setLaunches((prev) => prev.map((l) => l.id === launch.id ? { ...l, status: 'published' } : l))
    } catch (e) {
      toast.error(e?.message || 'Publish failed')
    } finally {
      setPublishingId(null)
    }
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
  }

  const upcoming = launches.filter(l => new Date(l.launch_at) > new Date())
  const totalWaitlist = 0 // placeholder; could fetch counts per launch

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border p-8 bg-stone-50">
        <Link href="/" className="inline-flex items-center mb-12" aria-label="Dropvine home"><DropvineLogo height={48} /></Link>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Studio</div>
        <nav className="space-y-1 text-sm">
          <Link href="/dashboard" className="block py-2 px-3 -mx-3 bg-foreground text-background">Launches</Link>
          <Link href="/dashboard/reservations" className="block py-2 px-3 -mx-3 text-muted-foreground hover:text-foreground">Reservations</Link>
          <a className="block py-2 px-3 -mx-3 text-muted-foreground hover:text-foreground cursor-not-allowed opacity-60">Audience</a>
          <a className="block py-2 px-3 -mx-3 text-muted-foreground hover:text-foreground cursor-not-allowed opacity-60">Settings</a>
        </nav>
        <div className="mt-auto pt-8 border-t border-border">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Account</div>
          <div className="text-sm truncate">{user.email}</div>
          <button onClick={() => signOut?.()} className="mt-3 text-xs text-muted-foreground hover:text-foreground">Sign out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="border-b border-border">
          <div className="px-6 md:px-12 py-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Studio</div>
              <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter">Your launches</h1>
            </div>
            <Link href="/dashboard/launches/new" className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-3 text-sm hover:opacity-90">
              <Plus className="h-4 w-4" /> New launch
            </Link>
          </div>
        </header>

        {/* Stats */}
        <section className="px-6 md:px-12 py-10 grid grid-cols-1 sm:grid-cols-3 gap-6 border-b border-border">
          <Stat icon={<Sparkles className="h-4 w-4" />} label="Total launches" value={launches.length} />
          <Stat icon={<Calendar className="h-4 w-4" />} label="Upcoming" value={upcoming.length} />
          <Stat icon={<Users className="h-4 w-4" />} label="Waitlist (all)" value={totalWaitlist} hint="View per launch →" />
        </section>

        {/* Launches list */}
        <section className="px-6 md:px-12 py-12">
          {fetching ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : launches.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {launches.map(l => {
                const isDraft = l.status === 'draft'
                return (
                  <li key={l.id} className="py-7 grid grid-cols-12 gap-4 items-center group">
                    <div className="col-span-12 md:col-span-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{l.status}</span>
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
                      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Opens</div>
                      <div className="tabular-nums">{new Date(l.launch_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </div>
                    <div className="col-span-6 md:col-span-3 flex items-center justify-end gap-3 text-sm flex-wrap">
                      {isDraft ? (
                        <>
                          <Link
                            href={`/admin/drops/${l.id}/preview`}
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

function EmptyState() {
  return (
    <div className="border border-dashed border-border p-12 md:p-20 text-center">
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Your studio is quiet</div>
      <h2 className="font-serif font-light text-3xl md:text-4xl tracking-tighter">Begin your first launch.</h2>
      <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm">A launch is a single page with a story, a moment, and an audience waiting.</p>
      <Link href="/dashboard/launches/new" className="mt-8 inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 text-sm">
        <Plus className="h-4 w-4" /> Compose a launch
      </Link>
    </div>
  )
}
