'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function VendorEditor({ initialVendor = null, products = [], posts = [] }) {
  const router = useRouter()
  const isNew = !initialVendor
  const [v, setV] = useState({
    name: '', slug: '', tagline: '', description: '', categories: [],
    venmo_handle: '', email: '', phone: '', website: '', instagram_handle: '',
    accepts_preorders: false, booth_number: '', is_active: true,
    cover_url: '', logo_url: '',
    ...(initialVendor || {}),
  })
  const [busy, setBusy] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }))
  const setCat = (s) => set('categories', s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))

  const submit = async (e) => {
    e.preventDefault()
    if (!v.name?.trim() || !v.slug?.trim()) return toast.error('Name and slug are required')
    setBusy(true)
    try {
      const payload = {
        ...v,
        booth_number: v.booth_number === '' || v.booth_number === null ? null : parseInt(v.booth_number, 10),
        venmo_handle: (v.venmo_handle || '').replace(/^@/, '') || null,
      }
      const url = isNew ? '/api/market/admin/vendors' : `/api/market/admin/vendors/${initialVendor.id}`
      const r = await adminFetch(url, { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(payload) })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Save failed'); setBusy(false); return }
      toast.success(isNew ? 'Vendor created' : 'Saved')
      router.replace(`/admin/vendors/${j.vendor.id}`)
    } catch (e) { toast.error(e?.message); setBusy(false) }
  }

  const remove = async () => {
    if (!initialVendor) return
    if (!confirm('Hide this vendor from the shopper PWA? Order history is preserved.')) return
    const r = await adminFetch(`/api/market/admin/vendors/${initialVendor.id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Vendor hidden'); router.replace('/admin/vendors') }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 max-w-3xl">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4">
        <Row><F label="Name *" value={v.name} onChange={(e) => set('name', e.target.value)} required /></Row>
        <Row>
          <F label="Slug *" value={v.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} required />
          <F label="Booth #" type="number" min="1" value={v.booth_number ?? ''} onChange={(e) => set('booth_number', e.target.value)} />
        </Row>
        <Row><F label="Tagline" value={v.tagline || ''} onChange={(e) => set('tagline', e.target.value)} /></Row>
        <Row><F label="Categories (comma-separated)" value={(v.categories || []).join(', ')} onChange={(e) => setCat(e.target.value)} placeholder="produce, eggs" /></Row>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-stone-500">Description (markdown)</span>
            <button type="button" onClick={() => setShowPreview((s) => !s)} className="text-xs underline text-stone-500">{showPreview ? 'Edit' : 'Preview'}</button>
          </div>
          {showPreview ? (
            <div className="mt-1 prose prose-stone prose-sm max-w-none rounded-lg border border-stone-200 bg-stone-50 p-3 min-h-[120px]">
              <ReactMarkdown>{v.description || '_Nothing yet._'}</ReactMarkdown>
            </div>
          ) : (
            <textarea rows={6} value={v.description || ''} onChange={(e) => set('description', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-stone-300"
                      placeholder={'**A family-run** organic farm just outside *Junction City*.\n\n- Pasture-raised eggs\n- Heirloom produce'} />
          )}
        </div>

        <Row>
          <F label="Cover image URL" value={v.cover_url || ''} onChange={(e) => set('cover_url', e.target.value)} />
          <F label="Logo URL" value={v.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} />
        </Row>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4">
        <h2 className="font-serif text-lg text-stone-800">Pre-orders & Venmo</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!v.accepts_preorders} onChange={(e) => set('accepts_preorders', e.target.checked)} />
          Accept pre-orders for this vendor
        </label>
        <Row><F label="Venmo handle (no @)" value={v.venmo_handle || ''} onChange={(e) => set('venmo_handle', e.target.value)} placeholder="brookside-farm" /></Row>
        <p className="text-xs text-stone-500">Required to accept pre-orders. Shoppers will be sent to <code className="bg-stone-100 px-1 rounded">venmo.com/&lt;handle&gt;</code> with the order amount and note pre-filled.</p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4">
        <h2 className="font-serif text-lg text-stone-800">Contact</h2>
        <Row>
          <F label="Email" type="email" value={v.email || ''} onChange={(e) => set('email', e.target.value)} />
          <F label="Phone" value={v.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </Row>
        <Row>
          <F label="Website" value={v.website || ''} onChange={(e) => set('website', e.target.value)} />
          <F label="Instagram" value={v.instagram_handle || ''} onChange={(e) => set('instagram_handle', e.target.value)} placeholder="@brooksidefarmco" />
        </Row>
      </div>

      {!isNew ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-3">
          <h2 className="font-serif text-lg text-stone-800">Visibility</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!v.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Visible in the shopper PWA
          </label>
          <p className="text-xs text-stone-500">Hidden vendors keep their products + order history but disappear from /market/shop and the map.</p>
          <p className="text-xs text-stone-500">{products?.length || 0} products · {posts?.length || 0} posts</p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 text-stone-50 text-sm disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {busy ? 'Saving…' : isNew ? 'Create vendor' : 'Save changes'}
        </button>
        {!isNew ? <button type="button" onClick={remove} className="text-xs text-stone-500 hover:text-rose-600 underline">Hide vendor</button> : null}
      </div>
    </form>
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
