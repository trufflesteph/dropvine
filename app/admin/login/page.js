'use client'
import React, { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Loader2 } from 'lucide-react'
import { writeAdminSession, readAdminSession } from '@/lib/markets/admin-client'

function LoginInner() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') || '/admin'
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  React.useEffect(() => {
    if (readAdminSession()) router.replace(next)
  }, [next, router])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/market/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      })
      const j = await r.json()
      if (!r.ok || j?.error) { setErr(j?.error || 'invalid password'); setBusy(false); return }
      writeAdminSession({ token: j.token, role: j.role, exp: Date.now() + 1000 * 60 * 60 * 12 })
      router.replace(next)
    } catch (e) {
      setErr(e?.message || 'failed'); setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white border border-stone-200 p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-stone-900 grid place-items-center text-stone-50"><Lock className="w-5 h-5" /></div>
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-stone-500">Dropvine Markets</div>
            <div className="font-serif text-xl text-stone-900">Admin sign in</div>
          </div>
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-stone-500">Password</span>
          <input autoFocus type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
                 className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-300" />
        </label>
        {err ? <p className="text-sm text-rose-600">{err}</p> : null}
        <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm bg-stone-900 text-stone-50 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Sign in
        </button>
        <p className="text-[11px] text-stone-500">Two roles: <strong>platform</strong> can edit market settings; <strong>organiser</strong> manages day-to-day vendors, dates and submissions.</p>
      </form>
    </div>
  )
}

export default function AdminLoginPage() {
  return <Suspense fallback={<div className="min-h-screen grid place-items-center text-stone-500">Loading…</div>}><LoginInner /></Suspense>
}
