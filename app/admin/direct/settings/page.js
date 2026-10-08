'use client'
import React, { useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { Loader2, Save, ChevronDown, ChevronRight } from 'lucide-react'

// Schema is key-value: site_config(key text unique, value text). Only keys
// that live code reads are listed here:
//   • hero_primary_cta, hero_primary_cta_href, logo_url → components/dropvine/nav.jsx
//   • footer_tagline → components/dropvine/footer.jsx
//   • logo_url and home_* → app/page.js (defaults in lib/site-config/home-copy.js)
// Saving upserts, so a key with no row yet is created on first save.

const tierFields = (tier) => [
  { key: `home_tier_${tier}_price`,    label: 'Price',    type: 'text', help: 'e.g. $24' },
  { key: `home_tier_${tier}_period`,   label: 'Period',   type: 'text', help: 'e.g. / month' },
  { key: `home_tier_${tier}_tagline`,  label: 'Tagline',  type: 'text' },
  { key: `home_tier_${tier}_features`, label: 'Features', type: 'textarea', help: 'One feature per line' },
]

const SECTIONS = [
  {
    title: 'Site nav button', kicker: 'Shared nav on Shop drops, Free tools, vendor, review and legal pages (not the homepage)', defaultOpen: true,
    fields: [
      { key: 'hero_primary_cta',      label: 'Button text', type: 'text', help: 'Default: Start your drop' },
      { key: 'hero_primary_cta_href', label: 'Button link', type: 'text', help: 'Default: /signup' },
    ],
  },
  {
    title: 'Logo', kicker: 'Shared nav and homepage header and footer', defaultOpen: true,
    fields: [
      { key: 'logo_url', label: 'Logo URL', type: 'text', help: 'PNG or SVG' },
    ],
  },
  {
    title: 'Footer tagline', kicker: 'Shared footer on the same pages as the nav (not the homepage)', defaultOpen: true,
    fields: [
      { key: 'footer_tagline', label: 'Footer tagline', type: 'text', help: 'Default: Your sales engine.' },
    ],
  },
  {
    title: 'Homepage hero', kicker: 'Top of the homepage',
    fields: [
      { key: 'home_hero_eyebrow',    label: 'Eyebrow',             type: 'text' },
      { key: 'home_hero_headline_1', label: 'Headline, part 1',    type: 'text', help: 'e.g. You bake.' },
      { key: 'home_hero_headline_2', label: 'Headline, part 2 (green)', type: 'text', help: 'e.g. Dropvine handles the selling.' },
      { key: 'home_hero_subtext',    label: 'Subtext',             type: 'textarea' },
      { key: 'home_hero_cta',        label: 'Button text',         type: 'text' },
      { key: 'home_hero_note',       label: 'Note under the button', type: 'text' },
    ],
  },
  {
    title: 'Homepage pricing', kicker: 'Pricing heading and the Maker and Shop cards',
    fields: [
      { key: 'home_pricing_headline', label: 'Headline', type: 'text' },
      { key: 'home_pricing_subtext',  label: 'Subtext',  type: 'textarea' },
      ...tierFields('maker').map((f) => ({ ...f, label: `Maker — ${f.label}` })),
      ...tierFields('shop').map((f) => ({ ...f, label: `Shop — ${f.label}` })),
    ],
  },
  {
    title: 'Premium Shop Annual', kicker: 'Third pricing card',
    fields: [
      { key: 'home_premium_badge', label: 'Badge', type: 'text', help: 'e.g. Launch pricing · 25 spots' },
      ...tierFields('premium'),
      { key: 'home_premium_original_price', label: 'Original price (struck through)', type: 'text', help: 'e.g. $650' },
      { key: 'home_premium_deadline_note',  label: 'Deadline note', type: 'text', help: 'Shown after the tagline' },
    ],
  },
  {
    title: 'Homepage final call to action', kicker: 'Green band above the homepage footer',
    fields: [
      { key: 'home_final_headline', label: 'Headline',    type: 'text' },
      { key: 'home_final_cta',      label: 'Button text', type: 'text' },
    ],
  },
]

export default function DirectSettingsPage() {
  const [cfg, setCfg] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingAll, setSavingAll] = useState(false)
  const [savingSection, setSavingSection] = useState(null) // section title or null
  const [dirty, setDirty] = useState({})
  const [openSections, setOpenSections] = useState(() => {
    const init = {}
    for (const s of SECTIONS) init[s.title] = !!s.defaultOpen
    return init
  })

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

  const toggleSection = (title) =>
    setOpenSections((p) => ({ ...p, [title]: !p[title] }))

  const dirtyCountFor = (section) => section.fields.reduce(
    (n, f) => n + (dirty[f.key] ? 1 : 0), 0
  )

  // Save only the dirty keys belonging to one section (or all if no section).
  const save = async ({ section } = {}) => {
    const filterKeys = section ? new Set(section.fields.map((f) => f.key)) : null
    const updates = {}
    for (const k of Object.keys(dirty)) {
      if (!dirty[k]) continue
      if (filterKeys && !filterKeys.has(k)) continue
      updates[k] = cfg[k] ?? null
    }
    if (!Object.keys(updates).length) { toast('Nothing to save.'); return }
    if (section) setSavingSection(section.title); else setSavingAll(true)
    try {
      const r = await adminFetch('/api/market/admin/direct/site-config', {
        method: 'PATCH', body: JSON.stringify({ updates }),
      })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Save failed'); return }
      toast.success(`Saved ${Object.keys(updates).length} setting${Object.keys(updates).length === 1 ? '' : 's'}.`)
      // Clear dirty flags only for the saved keys.
      setDirty((p) => {
        const next = { ...p }
        for (const k of Object.keys(updates)) delete next[k]
        return next
      })
    } catch (e) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSavingAll(false); setSavingSection(null)
    }
  }

  const totalDirty = useMemo(() => Object.values(dirty).filter(Boolean).length, [dirty])

  if (loading) return <AdminShell><div className="py-16 text-center text-stone-500">Loading site config…</div></AdminShell>

  return (
    <AdminShell requireRole="platform">
      <div className="flex items-center justify-between mb-6 sticky top-[5.5rem] z-10 bg-stone-50 py-2">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Direct · Settings</h1>
          <p className="text-sm text-stone-500">Nav and footer changes show on the next page load. Homepage changes show within about 10 minutes. A blank homepage field shows the original text.</p>
        </div>
        <button
          onClick={() => save()}
          disabled={savingAll || !totalDirty}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs uppercase tracking-wider bg-stone-900 text-stone-50 disabled:opacity-40"
        >
          {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save all {totalDirty ? `(${totalDirty})` : ''}
        </button>
      </div>

      <div className="grid gap-6">
        {SECTIONS.map((sec) => {
          const isOpen = !!openSections[sec.title]
          const sectionDirty = dirtyCountFor(sec)
          const isSavingThis = savingSection === sec.title
          return (
            <section key={sec.title} className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <header className="flex items-center gap-3 p-5">
                <button
                  type="button"
                  onClick={() => toggleSection(sec.title)}
                  className="flex items-center gap-2 text-left flex-1 group"
                  aria-expanded={isOpen}
                >
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-stone-400 group-hover:text-stone-700" />
                    : <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700" />}
                  <div>
                    <h2 className="font-serif text-xl text-stone-800">{sec.title}</h2>
                    <p className="text-xs text-stone-500">{sec.kicker}</p>
                  </div>
                </button>
                {sectionDirty ? (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    {sectionDirty} unsaved
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => save({ section: sec })}
                  disabled={isSavingThis || !sectionDirty}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider bg-stone-900 text-stone-50 disabled:opacity-40"
                >
                  {isSavingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save
                </button>
              </header>
              {isOpen ? (
                <div className="grid gap-4 px-5 pb-5">
                  {sec.fields.map((f) => (
                    <Field key={f.key} field={f} value={cfg[f.key]} onChange={(v) => set(f.key, v)} dirty={!!dirty[f.key]} />
                  ))}
                </div>
              ) : null}
            </section>
          )
        })}
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
