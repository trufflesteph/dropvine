'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { formatEmailDateTime } from '@/lib/email/format'
import { toast } from 'sonner'

const DAY_MS = 24 * 60 * 60 * 1000

// Whole days until trial_ends_at, rounded down: 0 on the last day, negative
// once the trial has ended.
function daysLeft(trialEndsAt, now) {
  return Math.floor((Date.parse(trialEndsAt) - now) / DAY_MS)
}

export default function DirectTrialsPage() {
  const [trials, setTrials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const r = await adminFetch('/api/market/admin/direct/trials')
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error || 'Failed')
        setTrials(j?.trials || [])
      } catch (e) { toast.error(e?.message || 'Failed') }
      finally { setLoading(false) }
    })()
  }, [])

  const now = Date.now()

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-stone-900">Direct · Trials</h1>
        <p className="text-sm text-stone-500">Vendors with a free trial, soonest end first. Nothing happens automatically when a trial ends.</p>
      </div>

      {loading ? <p className="text-stone-500 py-8 text-center">Loading…</p>
        : trials.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
            No vendors have a trial yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-stone-500 bg-stone-50">
                <tr><th className="px-4 py-3">Business</th><th>Email</th><th>Signed up</th><th>Trial ends</th><th className="pr-4 text-right">Days left</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {trials.map((t) => {
                  const days = daysLeft(t.trial_ends_at, now)
                  return (
                    <tr key={t.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/direct/vendors/${t.id}`} className="font-serif text-stone-900 hover:underline">{t.business_name || '—'}</Link>
                      </td>
                      <td className="text-stone-700">{t.email || <span className="text-stone-400 italic">Unlinked</span>}</td>
                      <td className="text-stone-600">{formatEmailDateTime(t.created_at) || '—'}</td>
                      <td className="text-stone-600">{formatEmailDateTime(t.trial_ends_at) || '—'}</td>
                      <td className={`pr-4 text-right tabular-nums ${days < 0 ? 'text-stone-400' : 'text-stone-900'}`}>{days}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </AdminShell>
  )
}
