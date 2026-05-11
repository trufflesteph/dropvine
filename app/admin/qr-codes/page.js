'use client'
import React, { useEffect, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'

export default function AdminQRPage() {
  const [vendors, setVendors] = useState([])
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  useEffect(() => { adminFetch('/api/market/admin/vendors').then((r) => r.json()).then((j) => setVendors((j?.vendors || []).filter((v) => v.is_active))) }, [])

  return (
    <AdminShell>
      <div className="flex items-baseline justify-between mb-6 print:hidden">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">QR codes</h1>
          <p className="text-sm text-stone-500">Printable booth QRs for the passport stamp flow. Scanning sends shoppers to /market/stamp/&lt;slug&gt;.</p>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-stone-900 text-stone-50 text-sm"><Printer className="w-4 h-4" /> Print all</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 print:gap-3">
        {vendors.map((v) => {
          const url = `${baseUrl}/market/stamp/${v.slug}`
          return (
            <div key={v.id} className="rounded-2xl border border-stone-200 bg-white p-5 text-center print:break-inside-avoid">
              <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Booth #{v.booth_number ?? '—'}</div>
              <div className="font-serif text-lg text-stone-800 mt-1 mb-3">{v.name}</div>
              <div className="inline-block p-3 bg-white">
                <QRCodeSVG value={url} size={170} level="M" includeMargin={false} />
              </div>
              <div className="text-[10px] text-stone-400 mt-3 break-all">{url}</div>
            </div>
          )
        })}
      </div>
      <style jsx global>{`
        @media print {
          @page { margin: 1cm; }
          body { background: white !important; }
          header, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </AdminShell>
  )
}
