'use client'
import React, { useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { Loader2, Save, ChevronDown, ChevronRight } from 'lucide-react'

// Schema is key-value: site_config(key text unique, value text). We render a
// curated set of fields grouped into sections. Adding a new key is a one-line
// addition to the FIELDS map below.

const SECTIONS = [
  {
    title: 'Brand', kicker: 'Logo, headline, footer', defaultOpen: true,
    fields: [
      { key: 'logo_url',        label: 'Logo URL',       type: 'text', help: 'PNG or SVG, square preferred' },
      { key: 'hero_headline',   label: 'Hero headline',  type: 'text' },
      { key: 'hero_subtext',    label: 'Hero subtext',   type: 'textarea' },
      { key: 'hero_cta',        label: 'Hero CTA text',  type: 'text' },
      { key: 'footer_tagline',  label: 'Footer tagline', type: 'text' },
    ],
  },
  {
    title: 'Pricing', kicker: 'Heading shown above the pricing tier cards', defaultOpen: true,
    fields: [
      { key: 'pricing_headline', label: 'Pricing headline', type: 'text',     help: 'e.g. “Start free. Grow when you’re ready.”' },
      { key: 'pricing_subtext',  label: 'Pricing subtext',  type: 'textarea', help: 'One short paragraph; renders below the headline.' },
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
  // ---- Marketing copy sections (seeded by 2026-06-direct-site-copy.sql) ----
  {
    title: 'How it works', kicker: 'Three numbered steps below the hero',
    fields: [
      { key: 'how_it_works_headline',    label: 'Section headline',  type: 'text' },
      { key: 'how_it_works_step1_title', label: 'Step 1 — title',    type: 'text' },
      { key: 'how_it_works_step1_body',  'label': 'Step 1 — body',   type: 'textarea' },
      { key: 'how_it_works_step2_title', label: 'Step 2 — title',    type: 'text' },
      { key: 'how_it_works_step2_body',  label: 'Step 2 — body',     type: 'textarea' },
      { key: 'how_it_works_step3_title', label: 'Step 3 — title',    type: 'text' },
      { key: 'how_it_works_step3_body',  label: 'Step 3 — body',     type: 'textarea' },
    ],
  },
  {
    title: 'Use cases', kicker: 'Three emoji cards under the section headline',
    fields: [
      { key: 'use_cases_headline', label: 'Section headline', type: 'text' },
      { key: 'use_case_1_emoji',   label: 'Card 1 — emoji',   type: 'text', help: 'Single emoji glyph' },
      { key: 'use_case_1_title',   label: 'Card 1 — title',   type: 'text' },
      { key: 'use_case_1_body',    label: 'Card 1 — body',    type: 'textarea' },
      { key: 'use_case_2_emoji',   label: 'Card 2 — emoji',   type: 'text' },
      { key: 'use_case_2_title',   label: 'Card 2 — title',   type: 'text' },
      { key: 'use_case_2_body',    label: 'Card 2 — body',    type: 'textarea' },
      { key: 'use_case_3_emoji',   label: 'Card 3 — emoji',   type: 'text' },
      { key: 'use_case_3_title',   label: 'Card 3 — title',   type: 'text' },
      { key: 'use_case_3_body',    label: 'Card 3 — body',    type: 'textarea' },
    ],
  },
  {
    title: 'Example', kicker: 'Demo business + four stat tiles',
    fields: [
      { key: 'example_business_name', label: 'Business name',   type: 'text' },
      { key: 'example_tagline',       label: 'Tagline (italic)', type: 'text' },
      { key: 'example_description',   label: 'Description',     type: 'textarea' },
      { key: 'example_stat_1_value',  label: 'Stat 1 — value',   type: 'text' },
      { key: 'example_stat_1_label',  label: 'Stat 1 — label',   type: 'text' },
      { key: 'example_stat_2_value',  label: 'Stat 2 — value',   type: 'text' },
      { key: 'example_stat_2_label',  label: 'Stat 2 — label',   type: 'text' },
      { key: 'example_stat_3_value',  label: 'Stat 3 — value',   type: 'text' },
      { key: 'example_stat_3_label',  label: 'Stat 3 — label',   type: 'text' },
      { key: 'example_stat_4_value',  label: 'Stat 4 — value',   type: 'text' },
      { key: 'example_stat_4_label',  label: 'Stat 4 — label',   type: 'text' },
    ],
  },
  {
    title: 'Collection modes', kicker: 'Four collection-mode cards',
    fields: [
      { key: 'modes_headline', label: 'Section headline', type: 'text' },
      { key: 'modes_subtext',  label: 'Section subtext',  type: 'textarea' },
      { key: 'mode_1_name',    label: 'Mode 1 — name',    type: 'text' },
      { key: 'mode_1_body',    label: 'Mode 1 — body',    type: 'textarea' },
      { key: 'mode_2_name',    label: 'Mode 2 — name',    type: 'text' },
      { key: 'mode_2_body',    label: 'Mode 2 — body',    type: 'textarea' },
      { key: 'mode_3_name',    label: 'Mode 3 — name',    type: 'text' },
      { key: 'mode_3_body',    label: 'Mode 3 — body',    type: 'textarea' },
      { key: 'mode_4_name',    label: 'Mode 4 — name',    type: 'text' },
      { key: 'mode_4_body',    label: 'Mode 4 — body',    type: 'textarea' },
    ],
  },
  {
    title: 'Bottom CTA', kicker: 'Last section above the footer',
    fields: [
      { key: 'bottom_cta_headline', label: 'Headline', type: 'text' },
      { key: 'bottom_cta_subtext',  label: 'Subtext',  type: 'textarea' },
      { key: 'bottom_cta_button',   label: 'Button text', type: 'text' },
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
          <p className="text-sm text-stone-500">Drives the Dropvine Direct marketing site. Changes apply on next page load.</p>
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
