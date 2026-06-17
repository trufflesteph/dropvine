'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const configured = isSupabaseConfigured()

  // Manual refresh — uses getSession() (local cookie read, no server round-trip)
  // so it resolves immediately. Only call this when you need to force a sync;
  // normal auth state changes are handled by the onAuthStateChange subscription.
  const refresh = useCallback(async () => {
    try {
      if (configured) {
        const sb = getSupabaseBrowser()
        const { data } = await sb.auth.getSession()
        const u = data?.session?.user
        setUser(u ? { id: u.id, email: u.email } : null)
      } else {
        const raw = localStorage.getItem('dropvine_mock_user')
        setUser(raw ? JSON.parse(raw) : null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [configured])

  useEffect(() => {
    if (configured) {
      const sb = getSupabaseBrowser()
      // Use the session Supabase already provides in the callback — avoids
      // an extra getUser() network call on every auth event.
      //
      // SIGNED_OUT fires with session = null, so session?.user is undefined
      // and setUser(null) correctly clears the auth state on sign-out.
      //
      // INITIAL_SESSION fires synchronously on mount with the current session
      // (or null if signed out), which resolves loading without a network call.
      const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
        const u = session?.user
        setUser(u ? { id: u.id, email: u.email } : null)
        setLoading(false)
      })
      return () => sub?.subscription?.unsubscribe?.()
    } else {
      // Mock mode — resolve immediately from localStorage.
      try {
        const raw = localStorage.getItem('dropvine_mock_user')
        setUser(raw ? JSON.parse(raw) : null)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
  }, [configured])

  const signUp = async (email, password, displayName) => {
    if (configured) {
      const sb = getSupabaseBrowser()
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
      if (error) throw error
      return data
    }
    const r = await fetch('/api/auth/mock-signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, display_name: displayName }) })
    if (!r.ok) throw new Error((await r.json()).error || 'Signup failed')
    const u = await r.json()
    localStorage.setItem('dropvine_mock_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const signIn = async (email, password) => {
    if (configured) {
      const sb = getSupabaseBrowser()
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Immediately update user state so any router.push that fires right after
      // signIn() returns sees a populated user — prevents the dashboard's
      // redirect guard from bouncing back to /login before onAuthStateChange fires.
      if (data?.user) setUser({ id: data.user.id, email: data.user.email })
      return data
    }
    const r = await fetch('/api/auth/mock-signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    if (!r.ok) throw new Error((await r.json()).error || 'Sign in failed')
    const u = await r.json()
    localStorage.setItem('dropvine_mock_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const signOut = async () => {
    if (configured) {
      const sb = getSupabaseBrowser()
      await sb.auth.signOut()
    } else {
      localStorage.removeItem('dropvine_mock_user')
    }
    // Clear user immediately — don't wait for onAuthStateChange to deliver
    // the SIGNED_OUT event, which can be delayed. onAuthStateChange will
    // also call setUser(null) when it fires; the duplicate is a no-op.
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, configured, signUp, signIn, signOut, refresh }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
