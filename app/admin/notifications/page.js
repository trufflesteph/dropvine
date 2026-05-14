'use client'
import React, { useEffect, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { MessageSquare, Mail, Send, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminNotificationsPage() {
  return (
    <AdminShell requireRole="platform">
      <NotificationsInner />
    </AdminShell>
  )
}

function StatusPill({ ok, label }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {label}
    </div>
  )
}

function NotificationsInner() {
  const [status, setStatus] = useState({ email: false, sms: false, loading: true })
  const [form, setForm] = useState({ to: '', body: 'Dropvine Markets — test SMS ✓' })
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const loadStatus = async () => {
    setStatus((s) => ({ ...s, loading: true }))
    try {
      const res = await adminFetch('/api/market/admin/sms/test')
      const j = await res.json()
      const ch = j?.status || {}
      setStatus({ email: !!ch.email, sms: !!ch.sms, loading: false })
    } catch {
      setStatus({ email: false, sms: false, loading: false })
    }
  }
  useEffect(() => { loadStatus() }, [])

  const sendTest = async (e) => {
    e?.preventDefault?.()
    if (!form.to.trim()) { toast.error('Enter a destination phone'); return }
    setBusy(true)
    setLastResult(null)
    try {
      const res = await adminFetch('/api/market/admin/sms/test', {
        method: 'POST',
        body: JSON.stringify({ to: form.to.trim(), body: form.body }),
      })
      const j = await res.json()
      setLastResult({ status: res.status, body: j })
      if (j?.ok && j?.sid) toast.success(`Sent (${j.sid})`)
      else if (j?.skipped) toast.error(`Skipped: ${j.skipped}`)
      else toast.error(j?.error || 'Send failed')
    } catch (e) {
      toast.error(e?.message || 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-stone-900">Notifications</h1>
        <p className="text-sm text-stone-600 mt-1">
          Verify each notification channel is wired up and send a test message.
        </p>
      </div>

      {/* Channel status */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-serif text-base text-stone-800">Channel status</div>
          <button onClick={loadStatus} disabled={status.loading}
                  className="text-xs px-2.5 py-1 rounded-full border border-stone-200 hover:bg-stone-50 inline-flex items-center gap-1 disabled:opacity-50">
            {status.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-stone-500" />
            <span className="text-sm text-stone-700">Email (Resend)</span>
            <StatusPill ok={status.email} label={status.email ? 'Connected' : 'Off'} />
          </div>
          <div className="flex items-center gap-2 ml-4">
            <MessageSquare className="w-4 h-4 text-stone-500" />
            <span className="text-sm text-stone-700">SMS (Twilio)</span>
            <StatusPill ok={status.sms} label={status.sms ? 'Connected' : 'Off'} />
          </div>
        </div>
        {!status.sms && !status.loading ? (
          <p className="text-[12px] text-stone-500 mt-3">
            SMS off — verify <code className="px-1 rounded bg-stone-100">TWILIO_ACCOUNT_SID</code>,
            <code className="px-1 rounded bg-stone-100">TWILIO_AUTH_TOKEN</code>, and
            <code className="px-1 rounded bg-stone-100">TWILIO_FROM_NUMBER</code> are set in <code className="px-1 rounded bg-stone-100">.env</code>.
          </p>
        ) : null}
      </div>

      {/* Test send */}
      <form onSubmit={sendTest} className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="font-serif text-base text-stone-800">Send a test SMS</div>
        <p className="text-xs text-stone-500">
          Sends one text via Twilio through the orchestrator. Standard Twilio rates apply.
          On trial accounts, the destination phone must be verified in your Twilio console.
        </p>
        <div>
          <label className="text-[11px] uppercase tracking-widest text-stone-400">Destination phone (E.164)</label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="+1 415 555 1234"
            value={form.to}
            onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
            disabled={busy}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest text-stone-400">Message body</label>
          <textarea
            rows={3}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            disabled={busy}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50"
          />
          <p className="text-[11px] text-stone-400 mt-1">
            "Reply STOP to opt out." is appended automatically.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="submit" disabled={busy || !status.sms}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition disabled:opacity-50"
                  style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? 'Sending…' : 'Send test'}
          </button>
        </div>
        {lastResult ? (
          <pre className="mt-2 text-[11px] text-stone-600 bg-stone-50 rounded-lg p-3 overflow-auto max-h-48">
{`HTTP ${lastResult.status}
${JSON.stringify(lastResult.body, null, 2)}`}
          </pre>
        ) : null}
      </form>

      {/* Help / context */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600 space-y-2">
        <div className="font-serif text-base text-stone-800">Where SMS is used</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Shopper order confirmation (when shopper has opted in on <code>/market/profile</code>)</li>
          <li>Vendor fulfillment magic-link (when vendor has <code>sms_opt_in = true</code> + phone on file)</li>
          <li>Market-day morning reminder (cron: <code>/api/cron/market-day-push</code>)</li>
        </ul>
      </div>
    </div>
  )
}
