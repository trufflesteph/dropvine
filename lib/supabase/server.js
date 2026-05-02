import { createServerClient } from '@supabase/ssr'
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
      set() {},
      remove() {},
    },
  })
}
