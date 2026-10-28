'use client'
// /dashboard/settings — the vendor edits their own profile: bio and contact
// links, profile photo and logo, and where they're based. All of it shows on
// their public page, /direct/[slug].
//
// Data + saves: GET/POST /api/direct/me (text fields and location) and
// /api/direct/me/image (photos, saved as soon as they're picked). Session-
// cookie auth; the server only ever updates this vendor's own row.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, mockUserHeaders } from '@/lib/auth-context'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { DashboardSidebar, DashboardMobileNav, useUnpaidOrderCount } from '@/components/dropvine/dashboard-nav'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeLocation, normalizeLocationEdit, formatLocation, US_STATES } from '@/lib/location'
import { BIO_MAX } from '@/lib/vendors/profile'

const GREEN = '#2D4A2A'
const INPUT_CLASS = 'h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0'
const LABEL_CLASS = 'text-[11px] uppercase tracking-[0.2em] text-muted-foreground'

export default function DashboardSettingsPage() {
  const router = useRouter()
  const { user, loading, signOut, configured } = useAuth() || {}
  const idHeaders = mockUserHeaders(user, configured)
  const unpaidCount = useUnpaidOrderCount(user, configured)
  const [vendor, setVendor] = useState(null)
  const [savedLocation, setSavedLocation] = useState(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/direct/me', { headers: idHeaders })
        const d = await r.json().catch(() => ({}))
        if (!r.ok || !d.ok) throw new Error(d.error || 'Could not load your profile.')
        if (cancelled) return
        setVendor(d.vendor || null)
        if (d.vendor) setSavedLocation(normalizeLocation(d.vendor.location_city, d.vendor.location_state))
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load your profile.')
      } finally {
        if (!cancelled) setFetching(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  // The dashboard's location notice links to #location, which only renders
  // once the vendor has loaded, so scroll to it then.
  useEffect(() => {
    if (vendor && window.location.hash === '#location') document.getElementById('location')?.scrollIntoView()
  }, [vendor])

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
  }

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar active="settings" user={user} signOut={signOut} unpaidCount={unpaidCount} />

      <main className="flex-1 min-w-0">
        <DashboardMobileNav active="settings" unpaidCount={unpaidCount} />

        <header className="border-b border-border">
          <div className="px-6 md:px-12 py-8">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Your vine</div>
            <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter">Settings</h1>
          </div>
        </header>

        {fetching ? (
          <div className="px-6 md:px-12 py-12 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="px-6 md:px-12 py-12 text-sm text-red-700">{error}</div>
        ) : !vendor ? (
          <div className="px-6 md:px-12 py-12 text-sm text-muted-foreground">
            Your vendor profile isn’t set up yet. Please check back in a minute.
          </div>
        ) : (
          <div className="divide-y divide-border">
            <ProfileSection vendor={vendor} idHeaders={idHeaders} />
            <PhotosSection vendor={vendor} idHeaders={idHeaders} />
            <LocationSection saved={savedLocation} onSaved={setSavedLocation} idHeaders={idHeaders} />
          </div>
        )}
      </main>
    </div>
  )
}

function SectionHeading({ eyebrow, title }) {
  return (
    <>
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{eyebrow}</div>
      <h2 className="font-serif font-light text-3xl tracking-tighter">{title}</h2>
    </>
  )
}

function Field({ id, label, help, error, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={LABEL_CLASS}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-red-700" data-testid={`${id}-error`}>{error}</p>
      ) : help ? (
        <p className="text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  )
}

const PROFILE_KEYS = ['bio', 'phone', 'instagram_url', 'website_url', 'venmo_handle']
const toForm = (v) => Object.fromEntries(PROFILE_KEYS.map((k) => [k, v?.[k] || '']))

// "Your profile" — saved via POST /api/direct/me, sending only the fields
// that changed. The server normalizes them (phone formatted, https:// added),
// and the saved values replace what was typed.
function ProfileSection({ vendor, idHeaders }) {
  const [saved, setSaved] = useState(() => toForm(vendor))
  const [form, setForm] = useState(saved)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { ok, text }

  const changed = PROFILE_KEYS.filter((k) => form[k] !== saved[k])
  const set = (k) => (e) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [k]: value }))
    setErrors((errs) => ({ ...errs, [k]: null }))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setErrors({})
    try {
      const r = await fetch('/api/direct/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...idHeaders },
        body: JSON.stringify(Object.fromEntries(changed.map((k) => [k, form[k]]))),
      })
      const d = await r.json().catch(() => ({}))
      // Also on a partial save (phone couldn't be saved, the rest was).
      if (d.vendor) {
        const nextSaved = { ...saved }
        const nextForm = { ...form }
        for (const k of changed) {
          if (d.errors?.[k]) continue
          nextSaved[k] = d.vendor[k] || ''
          nextForm[k] = d.vendor[k] || ''
        }
        setSaved(nextSaved)
        setForm(nextForm)
      }
      if (!r.ok || !d.ok) {
        setErrors(d.errors || {})
        throw new Error(d.error || 'Could not save your profile.')
      }
      const text = 'Saved. Your vendor page shows your changes.'
      setMessage({ ok: true, text })
      toast.success(text)
    } catch (err) {
      const text = err?.message || 'Could not save your profile.'
      setMessage({ ok: false, text })
      toast.error(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="px-6 md:px-12 py-12">
      <SectionHeading eyebrow="Your vendor page" title="Your profile" />
      <form onSubmit={save} className="mt-6 max-w-xl space-y-6">
        <Field id="profile-bio" label="Bio" error={errors.bio}>
          <textarea
            id="profile-bio"
            rows={5}
            maxLength={BIO_MAX}
            value={form.bio}
            onChange={set('bio')}
            className="w-full rounded-none border border-border bg-transparent p-3 text-sm focus:outline-none focus:border-foreground"
            placeholder="What you make, and how you make it."
          />
          <div className="text-xs text-muted-foreground text-right tabular-nums" aria-live="polite" data-testid="bio-count">
            {form.bio.length} / {BIO_MAX}
          </div>
        </Field>
        <Field
          id="profile-phone"
          label="Phone"
          error={errors.phone}
          help="Shown on your vendor page so shoppers can call or text you. Leave blank to keep it private."
        >
          <Input id="profile-phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className={INPUT_CLASS} placeholder="(503) 555-1234" />
        </Field>
        <Field id="profile-instagram" label="Instagram" error={errors.instagram_url} help="Your handle or a link to your profile.">
          <Input id="profile-instagram" value={form.instagram_url} onChange={set('instagram_url')} className={INPUT_CLASS} placeholder="@yourshop" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field id="profile-website" label="Website" error={errors.website_url}>
          <Input id="profile-website" inputMode="url" value={form.website_url} onChange={set('website_url')} className={INPUT_CLASS} placeholder="yourshop.com" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field id="profile-venmo" label="Venmo handle" error={errors.venmo_handle}>
          <Input id="profile-venmo" value={form.venmo_handle} onChange={set('venmo_handle')} className={INPUT_CLASS} placeholder="@yourshop" autoCapitalize="none" spellCheck={false} />
        </Field>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            disabled={saving || changed.length === 0}
            className="inline-flex items-center gap-2 text-background px-5 py-3 text-sm hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: GREEN }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </button>
          {message ? (
            <p role="status" className={`text-sm ${message.ok ? 'text-muted-foreground' : 'text-red-700'}`} data-testid="profile-save-message">{message.text}</p>
          ) : null}
        </div>
      </form>
    </section>
  )
}

function PhotosSection({ vendor, idHeaders }) {
  return (
    <section className="px-6 md:px-12 py-12">
      <SectionHeading eyebrow="Your vendor page" title="Photos" />
      <div className="mt-6 grid lg:grid-cols-2 gap-10 max-w-3xl">
        <ImageField
          kind="photo"
          label="Profile photo"
          help="Shown at the top of your vendor page. If you skip this, we use your newest drop photo."
          initialUrl={vendor.photo_url}
          fit="object-cover"
          idHeaders={idHeaders}
        />
        <ImageField
          kind="logo"
          label="Logo"
          help="Used when there is no profile photo."
          initialUrl={vendor.logo_url}
          fit="object-contain"
          idHeaders={idHeaders}
        />
      </div>
    </section>
  )
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif'
// Matches the server limit in /api/direct/me/image (under Vercel's 4.5 MB
// request cap).
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const MAX_SIDE = 2000

// Scales the image so its longest side is at most MAX_SIDE and re-encodes it:
// JPEG (quality 0.85), or PNG when it has transparent pixels (logos). A file
// the browser can't decode (HEIC outside Safari) is returned as-is for the
// server to convert or reject.
async function prepareImage(file) {
  if (typeof createImageBitmap !== 'function') return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    // Only PNG and WebP can carry transparency.
    let transparent = false
    if (/png|webp/i.test(file.type)) {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) { transparent = true; break }
      }
    }
    const type = transparent ? 'image/png' : 'image/jpeg'
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.85))
    if (!blob) return file
    const name = `${file.name.replace(/\.[^.]*$/, '') || 'image'}.${transparent ? 'png' : 'jpg'}`
    return new File([blob], name, { type })
  } catch {
    return file
  } finally {
    bitmap.close?.()
  }
}

// One image: saved as soon as a file is picked (POST /api/direct/me/image),
// removed with DELETE. The picked file previews beside the current one while
// it uploads, and stays there marked "Not saved" if the upload fails.
function ImageField({ kind, label, help, initialUrl, fit, idHeaders }) {
  const [current, setCurrent] = useState(initialUrl || null)
  const [chosen, setChosen] = useState(null) // object URL of the picked file
  const [busy, setBusy] = useState(null) // 'upload' | 'remove'
  const [message, setMessage] = useState(null) // { ok, text }
  const inputRef = useRef(null)

  useEffect(() => () => { if (chosen) URL.revokeObjectURL(chosen) }, [chosen])

  const report = (ok, text) => {
    setMessage({ ok, text })
    if (ok) toast.success(text)
    else toast.error(text)
  }

  const upload = async (e) => {
    const picked = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still fires
    if (!picked) return
    setMessage(null)
    setChosen(null)
    setBusy('upload')
    try {
      const file = await prepareImage(picked)
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please choose one under 4 MB.`)
      }
      setChosen(URL.createObjectURL(file))
      const body = new FormData()
      body.append('kind', kind)
      body.append('file', file)
      const r = await fetch('/api/direct/me/image', { method: 'POST', headers: idHeaders, body })
      if (r.status === 413) throw new Error('That image is too large to upload. Please choose a smaller one.')
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not upload that image.')
      setCurrent(d[`${kind}_url`] || null)
      setChosen(null)
      report(true, `${label} saved.`)
    } catch (err) {
      report(false, err?.message || 'Could not upload that image.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirm(`Remove your ${label.toLowerCase()}?`)) return
    setMessage(null)
    setBusy('remove')
    try {
      const r = await fetch(`/api/direct/me/image?kind=${kind}`, { method: 'DELETE', headers: idHeaders })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `Could not remove your ${label.toLowerCase()}.`)
      setCurrent(null)
      setChosen(null)
      report(true, `${label} removed.`)
    } catch (err) {
      report(false, err?.message || `Could not remove your ${label.toLowerCase()}.`)
    } finally {
      setBusy(null)
    }
  }

  const inputId = `image-${kind}`
  return (
    <div className="space-y-3" data-testid={`image-field-${kind}`}>
      <Label htmlFor={inputId} className={LABEL_CLASS}>{label}</Label>
      <div className="flex gap-4">
        <Preview src={current} alt={`Your current ${label.toLowerCase()}`} caption="Current" fit={fit} />
        {chosen ? (
          <Preview src={chosen} alt={`New ${label.toLowerCase()}`} caption={busy === 'upload' ? 'Uploading…' : 'Not saved'} fit={fit} />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
      <input ref={inputRef} id={inputId} type="file" accept={ACCEPT} onChange={upload} className="sr-only" disabled={!!busy} />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
          className="inline-flex items-center gap-2 border border-foreground px-4 py-2.5 text-sm hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {current ? 'Choose a new image' : 'Choose an image'}
        </button>
        {current ? (
          <button
            type="button"
            onClick={remove}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Remove
          </button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className={`text-sm ${message.ok ? 'text-muted-foreground' : 'text-red-700'}`} data-testid={`image-${kind}-message`}>{message.text}</p>
      ) : null}
    </div>
  )
}

function Preview({ src, alt, caption, fit }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [src])
  return (
    <figure className="w-32">
      <div className="w-32 h-32 border border-border bg-stone-100 flex items-center justify-center overflow-hidden">
        {src && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className={`w-full h-full ${fit}`} onError={() => setBroken(true)} />
        ) : (
          <span className="px-2 text-center text-xs text-muted-foreground">{src ? 'No preview' : 'None yet'}</span>
        )}
      </div>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">{caption}</figcaption>
    </figure>
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
