'use client'
import React, { useEffect, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { formatEmailDate } from '@/lib/email/format'
import { toast } from 'sonner'

export default function PremiumWaitlistPage() {
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const r = await adminFetch('/api/market/admin/direct/premium-waitlist')
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error || 'Failed')
        setSignups(j?.signups || [])
      } catch (e) { toast.error(e?.message || 'Failed') }
      finally { setLoading(false) }
    })()
  }, [])

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-stone-900">Direct · Premium waitlist</h1>
        <p className="text-sm text-stone-500">Sign-ups from the Premium Shop Annual card on the homepage, newest first. {signups.length} total.</p>
      </div>

      {loading ? <p className="text-stone-500 py-8 text-center">Loading…</p>
        : signups.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
            No sign-ups yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-stone-500 bg-stone-50">
                <tr><th className="px-4 py-3">First name</th><th>Email</th><th>Business name</th><th className="pr-4">Signed up</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {signups.map((w) => (
                  <tr key={w.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-stone-900">{w.first_name}</td>
                    <td className="text-stone-700">{w.email}</td>
                    <td className="text-stone-700">{w.business_name || <span className="text-stone-400">—</span>}</td>
                    <td className="pr-4 text-stone-600 whitespace-nowrap">{formatEmailDate(w.created_at) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </AdminShell>
  )
}
