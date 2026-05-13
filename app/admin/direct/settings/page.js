'use client'
import React, { useEffect, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

// Schema is key-value: site_config(key text unique, value text). We render a
// curated set of fields grouped into sections. Adding a new key is a one-line
// addition to the FIELDS map below.

const SECTIONS = [
  {
    title: 'Brand', kicker: 'Logo, headline, footer',
    fields: [
      { key: 'logo_url',        label: 'Logo URL',       type: 'text', help: 'PNG or SVG, square preferred' },
      { key: 'hero_headline',   label: 'Hero headline',  type: 'text' },
      { key: 'hero_subtext',    label: 'Hero subtext',   type: 'textarea' },
      { key: 'hero_cta',        label: 'Hero CTA text',  type: 'text' },
      { key: 'footer_tagline',  label: 'Footer tagline', type: 'text' },
    ],
  },
  {
    title: 'Free tier', kicker: 'Hobbyist plan',
    fields: [
      { key: 'free_tier_name',        label: 'Tier name',          type: 'text' },
      { key: 'free_tier_price_label', label: 'Price label',         type: 'text', help: 'Freeform — e.g. “Free” or “$0”' },
      { key: 'free_tier_features',    label: 'Features',            type: 'textarea', help: 'One feature per line' },
      { key: 'free_tier_cta',         label: 'CTA button text',     type: 'text' },
    ],
  },
  {
    title: 'Maker tier', kicker: 'Mid plan',
    fields: [
      { key: 'maker_tier_name',        label: 'Tier name',         type: 'text' },
      { key: 'maker_tier_price_cents', label: 'Price (cents)',     type: 'number', help: 'e.g. 1900 = $19.00 /mo' },
      { key: 'maker_tier_features',    label: 'Features',          type: 'textarea', help: 'One feature per line' },
      { key: 'maker_tier_cta',         label: 'CTA button text',   type: 'text' },
    ],
  },
  {
    title: 'Studio tier', kicker: 'Top plan',
    fields: [
      { key: 'studio_tier_name',        label: 'Tier name',          type: 'text' },
      { key: 'studio_tier_price_cents', label: 'Price (cents)',      type: 'number' },
      { key: 'studio_tier_features',    label: 'Features',           type: 'textarea', help: 'One feature per line' },
      { key: 'studio_tier_cta',         label: 'CTA button text',    type: 'text' },
      { key: 'studio_tier_popular',     label: '‘Most popular’ badge', type: 'boolean', help: 'Shows the gold ribbon on the Studio card' },
    ],
  },
]

export default function DirectSettingsPage() {
  const [cfg, setCfg] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState({})

  useEffect(() => {
    (async () => {
      try {
        const r = await adminFetch('/api/market/admin/direct/site-config')
        const j = await r.json()
        if (j?.config) setCfg(j.config)
      } catch (e) { toast.error(e?.message || 'Failed to load') }
      finally { setLoading(false) }
    })()
  }, [])

  const set = (k, v) => {
    setCfg((p) => ({ ...p, [k]: v }))
    setDirty((p) => ({ ...p, [k]: true }))
  }

  const save = async () => {
    const updates = {}
    for (const k of Object.keys(dirty)) updates[k] = cfg[k] ?? null
    if (!Object.keys(updates).length) { toast('Nothing to save.'); return }
    setSaving(true)
    try {
      const r = await adminFetch('/api/market/admin/direct/site-config', {
        method: 'PATCH', body: JSON.stringify({ updates }),
      })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Save failed'); return }
      toast.success(`Saved ${Object.keys(updates).length} setting${Object.keys(updates).length === 1 ? '' : 's'}.`)
      setDirty({})
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminShell><div className="py-16 text-center text-stone-500">Loading site config…</div></AdminShell>

  return (
    <AdminShell requireRole="platform">
      <div className="flex items-center justify-between mb-6 sticky top-[5.5rem] z-10 bg-stone-50 py-2">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Direct · Settings</h1>
          <p className="text-sm text-stone-500">Drives the Dropvine Direct marketing site. Changes apply on next page load.</p>
        </div>
        <button
          onClick={save}
          disabled={saving || !Object.keys(dirty).length}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs uppercase tracking-wider bg-stone-900 text-stone-50 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save {Object.keys(dirty).length ? `(${Object.keys(dirty).length})` : ''}
        </button>
      </div>

      <div className="grid gap-6">
        {SECTIONS.map((sec) => (
          <section key={sec.title} className="rounded-2xl border border-stone-200 bg-white p-6">
            <header className="mb-4 flex items-baseline justify-between">
              <div>
                <h2 className="font-serif text-xl text-stone-800">{sec.title}</h2>
                <p className="text-xs text-stone-500">{sec.kicker}</p>
              </div>
            </header>
            <div className="grid gap-4">
              {sec.fields.map((f) => (
                <Field key={f.key} field={f} value={cfg[f.key]} onChange={(v) => set(f.key, v)} dirty={!!dirty[f.key]} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  )
}

function Field({ field, value, onChange, dirty }) {
  const base = 'block w-full rounded-md border bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stone-300'
  const cls = dirty ? `${base} border-amber-500` : `${base} border-stone-200`
  return (
    <label className="grid gap-1.5">
      <span className="flex items-baseline justify-between text-xs text-stone-600">
        <span>{field.label}{dirty ? <span className="text-amber-600 ml-1">• unsaved</span> : null}</span>
        {field.help ? <span className="text-[11px] text-stone-400">{field.help}</span> : null}
      </span>
      {field.type === 'textarea' ? (
        <textarea rows={5} className={cls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === 'boolean' ? (
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={value === 'true' || value === true}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
          <span className="text-xs text-stone-500">Currently: <strong>{value === 'true' || value === true ? 'on' : 'off'}</strong></span>
        </div>
      ) : field.type === 'number' ? (
        <input type="number" min="0" className={cls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" className={cls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}
