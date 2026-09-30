// Who is calling — for API routes that act for a signed-in user.
//
// The user id comes from the Supabase session cookie, verified with Supabase
// (auth.getUser), never from anything the client sends.
//
// The one exception is local mock mode: when Supabase isn't configured AND
// this isn't a production build, the app has no real sessions (lib/auth-context
// keeps a mock user in localStorage), so the x-user-id header is accepted.
// In production — or whenever Supabase is configured — x-user-id is ignored.

import { getServerSupabaseConfig, getSupabaseServer } from '@/lib/supabase/server'

export function isMockAuthMode() {
  return !getServerSupabaseConfig().configured && process.env.NODE_ENV !== 'production'
}

export async function getSignedInUserId(request) {
  if (getServerSupabaseConfig().configured) {
    const sb = getSupabaseServer()
    if (!sb) return null
    try {
      const { data } = await sb.auth.getUser()
      return data?.user?.id || null
    } catch {
      return null
    }
  }
  if (isMockAuthMode()) return request?.headers?.get('x-user-id') || null
  return null
}
