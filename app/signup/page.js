'use client'
import Link from 'next/link'
import { DropvineLogo } from '@/components/dropvine/logo'
import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { VENDOR_CATEGORIES as BUSINESS_CATEGORIES } from '@/lib/vendors/categories'
import { normalizeLocation, US_STATES } from '@/lib/location'

// Signup doesn't ask for a tier. Every new vendor row starts on Shop with a
// 30-day trial, set by the handle_new_user_direct_vendor() trigger
// (supabase/migrations/2026-10-vendor-trials.sql).

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

  const { signUp, signIn, configured } = useAuth() || {}
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const location = normalizeLocation(city, state)
    if (!location.city) { toast.error('Please enter your city.'); return }
    setLoading(true)
    try {
      // Category and location go into the auth user's metadata as part of
      // signUp itself, so they're saved even when there's no session yet
      // (e.g. email confirmation on). GET /api/direct/me copies them onto the
      // direct_vendors row the first time the vendor loads the dashboard.
      await signUp(email, password, name, {
        category: category || null,
        location_city: location.city,
        location_state: location.state || null,
      })

      // For mock mode, signUp also signs them in. For real Supabase, attempt
      // sign-in (skipping email verification flow for MVP).
      if (configured) {
        try { await signIn(email, password) } catch {}
      }

      toast.success('Welcome to Dropvine.')
      // The welcome version of Settings: photo, bio and location before the
      // first drop.
      router.push('/dashboard/settings?welcome=1')
    } catch (err) {
      toast.error(err.message || 'Sign up failed')
    } finally { setLoading(false) }
  }

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
              <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Business Category</Label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="h-12 w-full rounded-none border-x-0 border-t-0 border-b border-border bg-transparent focus:outline-none focus:border-foreground text-sm text-foreground"
                style={{ paddingLeft: 0 }}
              >
                <option value="">Select a category</option>
                {BUSINESS_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">City</Label>
                <Input required value={city} onChange={e => setCity(e.target.value)} onBlur={() => setCity(c => c.trim())} className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" placeholder="e.g. Austin" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">State</Label>
                <select
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
            <p className="-mt-3 text-xs text-muted-foreground">Shown publicly as city and state only, never your street address.</p>
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
          <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-2 text-foreground">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline underline-offset-2 text-foreground">Privacy Policy</Link>.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="underline underline-offset-4 text-foreground">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
