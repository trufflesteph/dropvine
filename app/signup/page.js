'use client'
import Link from 'next/link'
import { DropvineLogo } from '@/components/dropvine/logo'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// -- Tier → post-signup destination --------------------------------------
// Free goes straight to the dashboard (no upsell). Maker and Shop get
// routed to Tally so the operator can collect the extended onboarding
// info before any (future) Stripe charge fires.
//
// Phase B: after Tally, route maker/shop through Stripe checkout
// On Stripe success, redirect to /dashboard
// Stripe success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?signup=complete`
const TALLY_MAKER_URL = 'https://tally.so/r/RGbWeJ'
const TALLY_SHOP_URL  = 'https://tally.so/r/RGbWeJ'

const VALID_TIERS = new Set(['free', 'maker', 'shop'])

function normaliseTier(raw) {
  const t = (raw || '').toLowerCase().trim()
  if (!t) return null
  return VALID_TIERS.has(t) ? t : null
}

function tallyUrlForTier(tier, email) {
  const base = tier === 'shop' ? TALLY_SHOP_URL : tier === 'maker' ? TALLY_MAKER_URL : null
  if (!base) return null
  const url = new URL(base)
  if (email) url.searchParams.set('vendor_email', email)
  return url.toString()
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </main>
    }>
      <SignupPageInner />
    </Suspense>
  )
}

function SignupPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?tier=maker | shop (free or absent = default flow). The marketing
  // page also emits this param via `app/page.js` (see buildPlans()).
  const tier = normaliseTier(searchParams.get('tier'))

  const { signUp, signIn, configured } = useAuth() || {}
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const signUpData = await signUp(email, password, name)
      // signUp returns `{ user, session }` for real Supabase. The user.id is
      // what we need to persist tier_intent against direct_vendors.
      const newUserId = signUpData?.user?.id || signUpData?.id || null

      // For mock mode, signUp also signs them in. For real Supabase, attempt
      // sign-in (skipping email verification flow for MVP).
      if (configured) {
        try { await signIn(email, password) } catch {}
      }

      // Persist tier_intent on the auto-provisioned direct_vendors row.
      // Fire-and-forget — never blocks the redirect. The trigger that
      // creates the direct_vendors row runs asynchronously so we accept a
      // "vendor row not yet provisioned" response gracefully.
      if (newUserId) {
        fetch('/api/direct/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': newUserId },
          body: JSON.stringify({ tier_intent: tier || 'free' }),
        }).catch(() => {})
      }

      toast.success('Welcome to Dropvine.')

      // Route by tier. Maker/Shop go to Tally; everyone else → /dashboard.
      // Tally URL carries the email as a hidden param so the form
      // submission can be reconciled back to this vendor in Phase B.
      const tallyUrl = tallyUrlForTier(tier, email)
      if (tallyUrl) {
        window.location.assign(tallyUrl)
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      toast.error(err.message || 'Sign up failed')
    } finally { setLoading(false) }
  }

  // Small headline tweak when arriving from a paid pricing card so the
  // visitor knows they picked the right tier. Purely cosmetic — no form
  // changes per the spec.
  const intentLabel = tier === 'shop' ? 'the Shop tier' : tier === 'maker' ? 'the Maker tier' : null

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <aside className="hidden md:flex flex-col justify-between p-12 bg-stone-100 border-r border-border">
        <Link href="/" aria-label="Dropvine home"><DropvineLogo height={48} /></Link>
        <div>
          <p className="font-serif italic text-3xl leading-snug tracking-tight max-w-md">"Ready, set, sell!"</p>
          <p className="mt-6 text-sm text-muted-foreground">— Dropvine, your new BBF (business best friend)</p>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Dropvine</div>
      </aside>

      <section className="flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-12"><Link href="/" aria-label="Dropvine home"><DropvineLogo height={40} /></Link></div>
          <h1 className="font-serif font-light text-4xl tracking-tighter">Create your account.</h1>
          {intentLabel ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Signing up for {intentLabel}.
            </p>
          ) : null}
          {!configured && (
            <p className="mt-4 text-xs text-muted-foreground border border-dashed border-border p-3 leading-relaxed">
              Mock mode — Supabase keys not yet configured. Account is held in memory for this session.
            </p>
          )}
          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Business Name</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" placeholder="e.g. Good Flour Bakery" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
              <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" placeholder="you@studio.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
              <Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" placeholder="At least 6 characters" />
            </div>
            <button disabled={loading} className="w-full bg-foreground text-background h-12 text-sm hover:opacity-90 disabled:opacity-50">
              {loading ? 'Submitting…' : 'Submit'}
            </button>
          </form>
          <p className="mt-8 text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="underline underline-offset-4 text-foreground">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
