'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Countdown } from '@/components/dropvine/countdown'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowRight, Lock, Check } from 'lucide-react'

export default function PublicLaunchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>}>
      <PublicLaunchPageInner />
    </Suspense>
  )
}

function PublicLaunchPageInner() {
  const { handle } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [launch, setLaunch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [reservationStatus, setReservationStatus] = useState(null) // 'pending' | 'held' | 'cancelled'

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/launches/by-handle/${handle}`)
        if (!r.ok) { setLaunch(null); return }
        const d = await r.json()
        setLaunch(d.launch)
      } finally { setLoading(false) }
    }
    if (handle) load()
  }, [handle])

  // Handle return from Stripe
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const cancelled = searchParams.get('cancelled')
    if (cancelled) {
      toast.error('Reservation cancelled.')
      router.replace(`/l/${handle}`)
      return
    }
    if (!sessionId) return
    setReservationStatus('pending')
    let attempts = 0
    const maxAttempts = 8
    const tick = async () => {
      attempts += 1
      try {
        const r = await fetch(`/api/payments/checkout/status/${sessionId}`)
        const d = await r.json()
        if (d.payment_status === 'paid') {
          setReservationStatus('held')
          toast.success('Reservation confirmed.')
          return
        }
        if (d.status === 'expired') {
          setReservationStatus('cancelled')
          toast.error('Checkout expired.')
          return
        }
      } catch {}
      if (attempts < maxAttempts) setTimeout(tick, 2000)
      else { setReservationStatus('pending'); toast.message('Still processing — check your email shortly.') }
    }
    tick()
  }, [searchParams, handle, router])

  const isLive = useMemo(() => launch ? new Date(launch.launch_at) <= new Date() : false, [launch])

  const join = async (e) => {
    e.preventDefault()
    if (!launch) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/launches/${launch.id}/waitlist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      if (!r.ok) throw new Error('Could not join')
      setJoined(true)
      toast.success('You are on the list. Watch your inbox.')
    } catch (e) { toast.error(e.message) } finally { setSubmitting(false) }
  }

  const reserve = async () => {
    if (!launch || !email) return toast.error('Enter your email first.')
    setReserving(true)
    try {
      const r = await fetch(`/api/launches/${launch.id}/reserve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, origin_url: window.location.origin }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      // Redirect to Stripe Checkout
      window.location.href = d.url
    } catch (e) {
      toast.error(e.message)
      setReserving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
  if (!launch) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="font-serif text-3xl tracking-tighter mb-2">Not found</div>
      <p className="text-muted-foreground text-sm">This launch page does not exist or is unpublished.</p>
      <Link href="/" className="mt-8 underline underline-offset-4 text-sm">Back to Dropvine</Link>
    </div>
  )

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="container flex items-center justify-between py-6">
          <Link href="/" className="font-serif text-lg tracking-tighter">Dropvine</Link>
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Launch — {launch.handle}</div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-36 pb-20 md:pt-48 md:pb-28">
        <div className="container max-w-5xl">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-8">{isLive ? 'Now open' : 'Upcoming launch'}</div>
          <h1 className="font-serif font-light text-5xl sm:text-6xl md:text-8xl leading-[0.96] tracking-tightest text-balance">
            {launch.title}
          </h1>
          {launch.tagline && (
            <p className="mt-8 font-serif italic text-2xl md:text-3xl text-muted-foreground max-w-3xl tracking-tight">{launch.tagline}</p>
          )}
        </div>
      </section>

      {/* Countdown / live */}
      <section className="border-y border-border bg-stone-100/60">
        <div className="container py-16 md:py-24">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-6">{isLive ? 'The doors are open' : 'Opens in'}</div>
          {isLive ? (
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
              <div className="font-serif text-5xl md:text-7xl tracking-tightest">It’s time.</div>
              <button className="inline-flex items-center gap-3 bg-foreground text-background px-8 py-4 text-sm hover:opacity-90">
                Enter the drop <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Countdown target={launch.launch_at} size="lg" />
          )}
        </div>
      </section>

      {/* Body */}
      <section className="container py-24 md:py-32 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-7">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">The piece</div>
          <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-line text-pretty">{launch.description || 'No description provided.'}</p>
          {launch.price_cents > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Price at release</div>
              <div className="font-serif text-4xl tracking-tighter">${(launch.price_cents / 100).toFixed(2)}</div>
            </div>
          )}
        </div>

        <aside className="md:col-span-5 md:sticky md:top-12 self-start">
          <div className="border border-border p-8 md:p-10 bg-background">
            {joined ? (
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Confirmed</div>
                <div className="font-serif text-3xl tracking-tighter">You’re on the list.</div>
                <p className="mt-3 text-sm text-muted-foreground">We’ll let you know the moment the doors open.</p>
              </div>
            ) : (
              <>
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Join the waitlist</div>
                <div className="font-serif text-2xl md:text-3xl tracking-tighter">Be present at release.</div>
                <form onSubmit={join} className="mt-8 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Optional" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
                    <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
                  </div>
                  <button disabled={submitting} className="w-full bg-foreground text-background h-12 text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                    {submitting ? 'Joining…' : <>Join the list <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
                {launch.reservation_enabled && launch.reservation_hold_cents > 0 && (
                  <div className="mt-8 pt-8 border-t border-border">
                    <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Or reserve a slot</div>
                    {reservationStatus === 'held' ? (
                      <div className="flex items-start gap-3 border border-foreground p-4 bg-foreground text-background">
                        <Check className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="text-sm leading-relaxed">
                          Reservation confirmed — your slot is held for this drop. Check your inbox for the receipt.
                        </div>
                      </div>
                    ) : reservationStatus === 'pending' ? (
                      <div className="border border-border p-4 text-sm text-muted-foreground">Confirming your reservation…</div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">Place a refundable hold of <strong className="text-foreground">${(launch.reservation_hold_cents/100).toFixed(2)}</strong> via Stripe to secure your spot.</p>
                        <button onClick={reserve} disabled={reserving} className="w-full border border-foreground h-12 text-sm hover:bg-foreground hover:text-background transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50">
                          <Lock className="h-3.5 w-3.5" /> {reserving ? 'Redirecting to Stripe…' : 'Reserve via Stripe'}
                        </button>
                        <p className="text-[11px] text-muted-foreground mt-2">Secure checkout by Stripe.</p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground text-center">Powered by Dropvine</p>
        </aside>
      </section>
    </main>
  )
}
