import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export function getServerSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url, key, configured: Boolean(url && key) }
}

export function getSupabaseServer() {
  const { url, key, configured } = getServerSupabaseConfig()
  if (!configured) return null
  const cookieStore = cookies()
  return createServerClient(url, key, {
    cookies: {
      get(name) { return cookieStore.get(name)?.value },
      set(name, value, options) {
        try { cookieStore.set({ name, value, ...options }) } catch { /* noop in static contexts */ }
      },
      remove(name, options) {
        try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }) } catch { /* noop */ }
      },
    },
  })
}

// Admin client (service_role) — bypasses RLS. Use ONLY for trusted server-side operations
// like webhook handlers, payment status updates, etc. Never expose its key to the browser.
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

