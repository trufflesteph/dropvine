'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, configured } = useAuth() || {}
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back.')
      router.push('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Sign in failed')
    } finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <aside className="hidden md:flex flex-col justify-between p-12 bg-stone-100 border-r border-border">
        <Link href="/"><img src="https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/assets/dropvine%202%20color%20logo_transparent.png" alt="Dropvine" style={{ height: '40px', width: 'auto' }} /></Link>
        <div>
          <p className="font-serif italic text-3xl leading-snug tracking-tight max-w-md">"Five minutes to set up. Zero DMs to manage. Made for every product and service."</p>
          <p className="mt-6 text-sm text-muted-foreground">— Dropvine Founder, Stephanie Baturoni</p>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Dropvine</div>
      </aside>

      <section className="flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-12"><Link href="/" className="font-serif text-xl tracking-tighter">Dropvine</Link></div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Sign in</div>
          <h1 className="font-serif font-light text-4xl tracking-tighter">Welcome back.</h1>
          {!configured && (
            <p className="mt-4 text-xs text-muted-foreground border border-dashed border-border p-3 leading-relaxed">
              Mock mode — Supabase keys not yet configured. Sign up creates a session in memory.
            </p>
          )}
          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" placeholder="you@studio.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" placeholder="••••••••" />
            </div>
            <button disabled={loading} className="w-full bg-foreground text-background h-12 text-sm hover:opacity-90 disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-8 text-sm text-muted-foreground">
            New here? <Link href="/signup" className="underline underline-offset-4 text-foreground">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
