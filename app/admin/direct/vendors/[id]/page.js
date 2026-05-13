'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import AdminShell from '@/components/markets/AdminShell'
import DirectVendorEditor from '@/components/dropvine/DirectVendorEditor'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'

export default function EditDirectVendorPage() {
  const { id } = useParams()
  const [vendor, setVendor] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!id) return
    (async () => {
      try {
        const r = await adminFetch(`/api/market/admin/direct/vendors/${id}`)
        const j = await r.json()
        if (j?.error) { toast.error(j.error); return }
        setVendor(j.vendor); setProfile(j.profile)
      } catch (e) { toast.error(e?.message || 'Failed') }
      finally { setLoading(false) }
    })()
  }, [id])

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-6">Direct · Edit vendor</h1>
      {loading ? <p className="text-stone-500">Loading…</p>
        : !vendor ? <p className="text-stone-500">Not found.</p>
        : <DirectVendorEditor initialVendor={vendor} initialProfile={profile} />}
    </AdminShell>
  )
}
