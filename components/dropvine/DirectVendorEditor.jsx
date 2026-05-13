'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { Loader2, Save, Trash2 } from 'lucide-react'

const TIERS = ['free', 'maker', 'studio']

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/['’“”"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function DirectVendorEditor({ initialVendor = null, initialProfile = null, isNew = false }) {
  const router = useRouter()
  const [v, setV] = useState(initialVendor || {
    business_name: '', slug: '', bio: '', logo_url: '', photo_url: '',
    venmo_handle: '', instagram_url: '', website_url: '', tier: 'free', active: true,
  })
  const [creatorEmail, setCreatorEmail] = useState(initialProfile?.email || '')
  const [busy, setBusy] = useState(false)

  const set = (k, val) => setV((p) => ({ ...p, [k]: val }))

  const save = async () => {
    if (!v.business_name || !v.slug) { toast.error('Business name + slug required'); return }
    setBusy(true)
    try {
      const payload = { ...v }
      if (creatorEmail) payload.creator_email = creatorEmail.trim().toLowerCase()
      const url = isNew ? '/api/market/admin/direct/vendors' : `/api/market/admin/direct/vendors/${v.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const r = await adminFetch(url, { method, body: JSON.stringify(payload) })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Save failed'); return }
      toast.success(isNew ? 'Vendor created.' : 'Saved.')
      if (isNew) router.replace(`/admin/direct/vendors/${j.vendor.id}`)
    } catch (e) { toast.error(e?.message || 'Failed') }
    finally { setBusy(false) }
  }

  const remove = async () => {
    if (!initialVendor) return
    if (!confirm(`Deactivate ${v.business_name}? Past drops are preserved; the vendor stops appearing in active lists.`)) return
    const r = await adminFetch(`/api/market/admin/direct/vendors/${v.id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Deactivated.'); router.replace('/admin/direct/vendors') }
  }

  return (
    <div className="grid gap-6 max-w-3xl">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4">
        <h2 className="font-serif text-lg text-stone-800">Business</h2>
        <Row>
          <F label="Business name *" value={v.business_name} onChange={(e) => {
            set('business_name', e.target.value)
            if (isNew && !v.slug) set('slug', slugify(e.target.value))
          }} />
          <F label="Slug *" value={v.slug} onChange={(e) => set('slug', slugify(e.target.value))}
             help="used in /direct/[slug] URLs" />
        </Row>
        <Field label="Bio">
          <textarea rows={4} value={v.bio || ''} onChange={(e) => set('bio', e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-300" />
        </Field>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4">
        <h2 className="font-serif text-lg text-stone-800">Imagery</h2>
        <Row>
          <F label="Logo URL" value={v.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://…" />
          <F label="Photo URL" value={v.photo_url || ''} onChange={(e) => set('photo_url', e.target.value)} placeholder="https://…" />
        </Row>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4">
        <h2 className="font-serif text-lg text-stone-800">Contact &amp; links</h2>
        <Row>
          <F label="Venmo handle" value={v.venmo_handle || ''} onChange={(e) => set('venmo_handle', e.target.value)} placeholder="your-handle" />
          <F label="Instagram URL" value={v.instagram_url || ''} onChange={(e) => set('instagram_url', e.target.value)} placeholder="https://instagram.com/…" />
        </Row>
        <F label="Website URL" value={v.website_url || ''} onChange={(e) => set('website_url', e.target.value)} placeholder="https://…" />
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4">
        <h2 className="font-serif text-lg text-stone-800">Ownership &amp; access</h2>
        <F label="Linked profile (email)"
           help="Resolves to profiles.id and gates Direct submissions to this creator. Leave empty for an unlinked placeholder vendor."
           value={creatorEmail} onChange={(e) => setCreatorEmail(e.target.value)} placeholder="creator@example.com" />
        <Row>
          <Field label="Tier">
            <select value={v.tier || 'free'} onChange={(e) => set('tier', e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm border border-stone-200 bg-white">
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Active">
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={v.active !== false} onChange={(e) => set('active', e.target.checked)} />
              {v.active !== false ? 'Visible in active lists' : 'Hidden'}
            </label>
          </Field>
        </Row>
      </section>

      <div className="flex items-center gap-3 sticky bottom-3 bg-stone-50/90 backdrop-blur p-3 rounded-xl border border-stone-200">
        <button onClick={save} disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs uppercase tracking-wider bg-stone-900 text-stone-50 disabled:opacity-40">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
        {!isNew ? (
          <button onClick={remove}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs uppercase tracking-wider bg-white border border-stone-300 text-stone-700 hover:bg-stone-50">
            <Trash2 className="w-3.5 h-3.5" /> Deactivate
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Row({ children }) { return <div className="grid sm:grid-cols-2 gap-4">{children}</div> }
function Field({ label, help, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-baseline justify-between text-xs text-stone-600">
        <span>{label}</span>
        {help ? <span className="text-[11px] text-stone-400">{help}</span> : null}
      </span>
      {children}
    </label>
  )
}
function F({ label, help, ...props }) {
  return (
    <Field label={label} help={help}>
      <input type="text" {...props}
             className="w-full px-3 py-2 rounded-md text-sm border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300" />
    </Field>
  )
}
