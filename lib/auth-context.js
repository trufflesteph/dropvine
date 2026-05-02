'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const configured = isSupabaseConfigured()

  const refresh = useCallback(async () => {
    if (configured) {
      const sb = getSupabaseBrowser()
      const { data } = await sb.auth.getUser()
      setUser(data?.user ? { id: data.user.id, email: data.user.email } : null)
    } else {
      // mock: read from localStorage
      try {
        const raw = localStorage.getItem('dropvine_mock_user')
        setUser(raw ? JSON.parse(raw) : null)
      } catch { setUser(null) }
    }
    setLoading(false)
  }, [configured])

  useEffect(() => {
    refresh()
    if (configured) {
      const sb = getSupabaseBrowser()
      const { data: sub } = sb.auth.onAuthStateChange(() => refresh())
      return () => sub?.subscription?.unsubscribe?.()
    }
  }, [configured, refresh])

  const signUp = async (email, password, displayName) => {
    if (configured) {
      const sb = getSupabaseBrowser()
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
      if (error) throw error
      return data
    }
    const r = await fetch('/api/auth/mock-signup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password, display_name: displayName }) })
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
      return data
    }
    const r = await fetch('/api/auth/mock-signin', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
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
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, configured, signUp, signIn, signOut, refresh }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
