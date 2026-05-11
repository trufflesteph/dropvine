'use client'
// Browser-side helper for admin sessions.
// We store a JSON blob {role, token, exp} in sessionStorage so the user has
// to re-authenticate every browser session. The token is HMAC-signed
// server-side so the client cannot mint it.

const KEY = 'dropvine_market_admin'

export function readAdminSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (obj?.exp && Date.now() > obj.exp) { window.sessionStorage.removeItem(KEY); return null }
    return obj
  } catch { return null }
}

export function writeAdminSession(session) {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(KEY, JSON.stringify(session)) } catch { /* noop */ }
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.removeItem(KEY) } catch { /* noop */ }
}

export async function adminFetch(input, init = {}) {
  const session = readAdminSession()
  const headers = new Headers(init.headers || {})
  if (session?.token) headers.set('X-Admin-Token', session.token)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401) {
    clearAdminSession()
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login?next=' + encodeURIComponent(window.location.pathname)
    }
  }
  return res
}
