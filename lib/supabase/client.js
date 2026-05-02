'use client'
import { createBrowserClient } from '@supabase/ssr'

let _client = null

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url, key, configured: Boolean(url && key) }
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().configured
}

export function getSupabaseBrowser() {
  const { url, key, configured } = getSupabaseConfig()
  if (!configured) return null
  if (_client) return _client
  _client = createBrowserClient(url, key)
  return _client
}
