'use client'
import React from 'react'
import AdminShell from '@/components/markets/AdminShell'
import VendorEditor from '@/components/markets/VendorEditor'

export default function NewVendorPage() {
  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-6">Add a vendor</h1>
      <VendorEditor />
    </AdminShell>
  )
}
