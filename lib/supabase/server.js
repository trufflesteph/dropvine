import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Custom fetch that opts out of Next.js's fetch-result cache. Without this,
// Next.js wraps every fetch() inside a server route and caches the response,
// which causes Supabase reads-after-write inside the same request to return
// stale data (we hit this on the PUT /products diff flow — re-reads returned
// previously-deleted rows). `export const dynamic = 'force-dynamic'` on the
// route is NOT sufficient — it only opts the route OUT of full-route caching,
// not the per-fetch data cache.
const noStoreFetch = (input, init = {}) => fetch(input, { ...init, cache: 'no-store' })

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
    // Disable Next.js fetch caching — see comment on getSupabaseAdmin below.
    global: { fetch: noStoreFetch },
  })
}

// Admin client (service_role) — bypasses RLS. Use ONLY for trusted server-side operations
// like webhook handlers, payment status updates, etc. Never expose its key to the browser.
//
// IMPORTANT: passes a custom `fetch` that forces `cache: 'no-store'` on every
// request. See note on noStoreFetch above.
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  })
}

