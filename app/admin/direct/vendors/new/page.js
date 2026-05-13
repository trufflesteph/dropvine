'use client'
import DirectVendorEditor from '@/components/dropvine/DirectVendorEditor'
import AdminShell from '@/components/markets/AdminShell'

export default function NewDirectVendorPage() {
  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-6">Direct · New vendor</h1>
      <DirectVendorEditor isNew />
    </AdminShell>
  )
}
