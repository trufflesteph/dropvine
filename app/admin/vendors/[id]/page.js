'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import AdminShell from '@/components/markets/AdminShell'
import VendorEditor from '@/components/markets/VendorEditor'
import { adminFetch } from '@/lib/markets/admin-client'

export default function EditVendorPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!id) return
    adminFetch(`/api/market/admin/vendors/${id}`).then((r) => r.json()).then((j) => setData(j))
  }, [id])

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-6">{data?.vendor?.name || 'Edit vendor'}</h1>
      {data ? <VendorEditor initialVendor={data.vendor} products={data.products} posts={data.posts} /> : <p className="text-stone-500">Loading…</p>}
    </AdminShell>
  )
}
