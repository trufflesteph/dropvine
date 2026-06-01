'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Countdown } from '@/components/dropvine/countdown'
import { DropvineLogo } from '@/components/dropvine/logo'

const STEPS = ['Identity', 'Story', 'Moment', 'Commerce', 'Review']

export default function NewLaunchPage() {
  const router = useRouter()
  const { user, loading } = useAuth() || {}
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const tomorrow = useMemo(() => {
    const d = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    return d.toISOString().slice(0, 16)
  }, [])

  const [form, setForm] = useState({
    title: '',
    handle: '',
    tagline: '',
    description: '',
    launch_at: tomorrow,
    price_cents: 0,
    capacity: '',
    reservation_enabled: false,
    reservation_hold_cents: 5000,
    status: 'published',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [loading, user, router])

  // Auto-derive handle from title
  useEffect(() => {
    if (!form.handle && form.title) {
      set('handle', form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40))
    }
  }, [form.title]) // eslint-disable-line

  const validateStep = () => {
    if (step === 0 && (!form.title || !form.handle)) return 'Title and handle are required.'
    if (step === 2 && !form.launch_at) return 'Pick a drop date.'
    return null
  }

  const next = () => {
    const v = validateStep()
    if (v) return toast.error(v)
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }
  const prev = () => setStep(s => Math.max(0, s - 1))

  const submit = async () => {
    setSubmitting(true)
    try {
      const r = await fetch('/api/launches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({
          ...form,
          launch_at: new Date(form.launch_at).toISOString(),
          price_cents: Number(form.price_cents) || 0,
          reservation_hold_cents: Number(form.reservation_hold_cents) || 0,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to publish')
      toast.success('Launch published.')
      router.push(`/l/${d.drop.handle}`)
    } catch (e) {
      toast.error(e.message)
    } finally { setSubmitting(false) }
  }

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container py-6 flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to studio
          </Link>
          <div className="inline-flex items-center"><DropvineLogo height={40} /></div>
          <div className="text-xs text-muted-foreground tabular-nums">{step + 1} / {STEPS.length}</div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="container py-10">
        <div className="flex items-center gap-3 md:gap-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3 flex-1">
              <div className={`h-px flex-1 ${i <= step ? 'bg-foreground' : 'bg-border'}`} />
              <div className={`text-[10px] md:text-[11px] uppercase tracking-[0.25em] whitespace-nowrap ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <main className="container pb-32 max-w-3xl">
        {step === 0 && (
          <Section eyebrow="Step 01" title="Identity" subtitle="What is the name of this drop, and where will it live?">
            <Field label="Title"><Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Maison Noir — Fall/Winter Capsule" className="h-12 rounded-none" /></Field>
            <Field label="Handle" hint="This is the URL: /l/<handle>">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">/l/</span>
                <Input value={form.handle} onChange={e => set('handle', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="maison-noir-fw26" className="h-12 rounded-none" />
              </div>
            </Field>
            <Field label="Tagline" hint="One line. Set the tone."><Input value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="A study in shadow. 12 pieces. Limited to 200." className="h-12 rounded-none" /></Field>
          </Section>
        )}

        {step === 1 && (
          <Section eyebrow="Step 02" title="Story" subtitle="The page beneath the page.">
            <Field label="Description"><Textarea rows={8} value={form.description} onChange={e => set('description', e.target.value)} placeholder="A meditative collection drawing from the architecture of light…" className="rounded-none resize-none" /></Field>
          </Section>
        )}

        {step === 2 && (
          <Section eyebrow="Step 03" title="Moment" subtitle="When does this open?">
            <Field label="Launch date & time"><Input type="datetime-local" value={form.launch_at} onChange={e => set('launch_at', e.target.value)} className="h-12 rounded-none" /></Field>
            <div className="mt-10 border border-border p-8 bg-stone-50">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Preview</div>
              {form.launch_at ? <Countdown target={new Date(form.launch_at).toISOString()} size="md" /> : <div className="text-muted-foreground text-sm">Pick a date to preview the timer.</div>}
            </div>
          </Section>
        )}

        {step === 3 && (
          <Section eyebrow="Step 04" title="Commerce" subtitle="Pricing, capacity, and reservation behaviour.">
            <Field label="List price (USD)" hint="Shown on page. Set 0 to hide.">
              <Input type="number" min={0} step="1" value={(form.price_cents / 100) || ''} onChange={e => set('price_cents', Math.round(Number(e.target.value) * 100))} placeholder="480" className="h-12 rounded-none" />
            </Field>
            <Field label="Capacity" hint="Total spots available. Leave blank for unlimited.">
              <Input type="number" min={1} step="1" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="200" className="h-12 rounded-none" />
            </Field>
            <div className="flex items-center justify-between border border-border p-6">
              <div>
                <div className="text-sm font-medium">Hold reservations</div>
                <div className="text-xs text-muted-foreground mt-1 max-w-md">Customers place a refundable hold via Stripe to reserve a slot at release.</div>
              </div>
              <Switch checked={form.reservation_enabled} onCheckedChange={v => set('reservation_enabled', v)} />
            </div>
            {form.reservation_enabled && (
              <Field label="Hold amount (USD)"><Input type="number" min={0} value={(form.reservation_hold_cents / 100) || ''} onChange={e => set('reservation_hold_cents', Math.round(Number(e.target.value) * 100))} placeholder="50" className="h-12 rounded-none" /></Field>
            )}
          </Section>
        )}

        {step === 4 && (
          <Section eyebrow="Step 05" title="Review" subtitle="A final look before the page becomes real.">
            <ul className="divide-y divide-border border-y border-border">
              <Row label="Title" value={form.title} />
              <Row label="Handle" value={`/l/${form.handle}`} />
              <Row label="Tagline" value={form.tagline || '—'} />
              <Row label="Opens" value={form.launch_at ? new Date(form.launch_at).toLocaleString() : '—'} />
              <Row label="Price" value={form.price_cents ? `$${(form.price_cents/100).toFixed(2)}` : 'Hidden'} />
              <Row label="Capacity" value={form.capacity ? `${form.capacity} spots` : 'Unlimited'} />
              <Row label="Reservations" value={form.reservation_enabled ? `On — hold $${(form.reservation_hold_cents/100).toFixed(2)}` : 'Off'} />
            </ul>
          </Section>
        )}

        {/* Nav */}
        <div className="mt-16 flex items-center justify-between">
          <button onClick={prev} disabled={step === 0} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={next} className="inline-flex items-center gap-2 bg-foreground text-background px-7 py-3 text-sm hover:opacity-90">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 bg-foreground text-background px-7 py-3 text-sm hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Publishing…' : <>Publish drop <Check className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

function Section({ eyebrow, title, subtitle, children }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">{eyebrow}</div>
      <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter">{title}</h1>
      {subtitle && <p className="mt-3 text-muted-foreground max-w-xl">{subtitle}</p>}
      <div className="mt-12 space-y-7">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <li className="py-4 grid grid-cols-3 gap-4 text-sm">
      <div className="text-muted-foreground uppercase tracking-[0.18em] text-[11px]">{label}</div>
      <div className="col-span-2">{value}</div>
    </li>
  )
}
