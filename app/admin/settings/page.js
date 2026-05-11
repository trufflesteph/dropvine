'use client'
import React, { useEffect, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { MARKET_NEUTRAL_DEFAULTS, MARKET_INPUT_PLACEHOLDERS } from '@/lib/markets/defaults'

export default function AdminSettingsPage() {
  const [c, setC] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { adminFetch('/api/market/admin/config').then((r) => r.json()).then((j) => setC(j?.config || null)) }, [])
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const fields = ['name','subtitle','season','primary_color','accent_color','pwa_short_name','pwa_theme_color','pwa_background_color','map_booth_count','map_orientation','map_street_name','map_cross_street_start','map_cross_street_end','contact_email','about_md']
    const payload = {}
    for (const k of fields) payload[k] = c[k]
    // Coerce booth count to integer or null (lets the operator clear it)
    if (payload.map_booth_count === '' || payload.map_booth_count == null) {
      payload.map_booth_count = null
    } else {
      const n = parseInt(payload.map_booth_count, 10)
      payload.map_booth_count = Number.isFinite(n) ? n : null
    }
    const r = await adminFetch('/api/market/admin/config', { method: 'PATCH', body: JSON.stringify(payload) })
    const j = await r.json()
    if (!r.ok || j?.error) toast.error(j?.error || 'Failed')
    else { toast.success('Saved'); setC(j.config) }
    setBusy(false)
  }

  return (
    <AdminShell requireRole="platform">
      <h1 className="font-serif text-3xl text-stone-900 mb-1">Market settings</h1>
      <p className="text-sm text-stone-500 mb-6">Platform-only. Edits theme, PWA metadata, and the auto-generated street map.</p>
      {!c ? <p className="text-stone-500">Loading…</p> : (
        <form onSubmit={submit} className="grid gap-6 max-w-3xl">
          <Card title="Identity">
            <Row><F label="Name" value={c.name || ''} onChange={(e) => set('name', e.target.value)} /></Row>
            <Row><F label="Subtitle" value={c.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} /></Row>
            <Row>
              <F label="Season" value={c.season || ''} onChange={(e) => set('season', e.target.value)} />
              <F label="PWA short name" value={c.pwa_short_name || ''} onChange={(e) => set('pwa_short_name', e.target.value)} />
            </Row>
            <Row><F label="Contact email" type="email" value={c.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} /></Row>
          </Card>

          <Card title="Theme">
            <Row>
              <ColorField label="Primary" value={c.primary_color || MARKET_NEUTRAL_DEFAULTS.primary_color} onChange={(v) => set('primary_color', v)} />
              <ColorField label="Accent" value={c.accent_color || MARKET_NEUTRAL_DEFAULTS.accent_color} onChange={(v) => set('accent_color', v)} />
            </Row>
            <Row>
              <ColorField label="PWA theme" value={c.pwa_theme_color || MARKET_NEUTRAL_DEFAULTS.pwa_theme_color} onChange={(v) => set('pwa_theme_color', v)} />
              <ColorField label="PWA background" value={c.pwa_background_color || MARKET_NEUTRAL_DEFAULTS.pwa_background_color} onChange={(v) => set('pwa_background_color', v)} />
            </Row>
          </Card>

          <Card title="Street map">
            <Row>
              <F label="Street name" value={c.map_street_name || ''} onChange={(e) => set('map_street_name', e.target.value)} placeholder={MARKET_INPUT_PLACEHOLDERS.street_name} />
              <F label="Booth count" type="number" min="2" max="40" value={c.map_booth_count ?? ''} onChange={(e) => set('map_booth_count', e.target.value)} />
            </Row>
            <Row>
              <F label="Cross street — start" value={c.map_cross_street_start || ''} onChange={(e) => set('map_cross_street_start', e.target.value)} placeholder={MARKET_INPUT_PLACEHOLDERS.cross_street_start} />
              <F label="Cross street — end" value={c.map_cross_street_end || ''} onChange={(e) => set('map_cross_street_end', e.target.value)} placeholder={MARKET_INPUT_PLACEHOLDERS.cross_street_end} />
            </Row>
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-stone-500">Orientation</span>
              <select value={c.map_orientation || 'horizontal'} onChange={(e) => set('map_orientation', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
          </Card>

          <Card title="About">
            <textarea rows={5} value={c.about_md || ''} onChange={(e) => set('about_md', e.target.value)}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono" placeholder="Markdown supported…" />
          </Card>

          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 text-stone-50 text-sm disabled:opacity-50 w-fit">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
          </button>
        </form>
      )}
    </AdminShell>
  )
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4">
      <h2 className="font-serif text-lg text-stone-800">{title}</h2>
      {children}
    </section>
  )
}
function Row({ children }) { return <div className="grid sm:grid-cols-2 gap-4">{children}</div> }
function F({ label, ...rest }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-stone-500">{label}</span>
      <input {...rest} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-300" />
    </label>
  )
}
function ColorField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-stone-500">{label}</span>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded cursor-pointer bg-transparent border-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 text-sm font-mono focus:outline-none" />
      </div>
    </label>
  )
}
