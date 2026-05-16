'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getSupabaseBrowser } from '@/lib/supabase/client'

// Strip a trailing arrow (→) from CTA-style copy that some operators paste in
// — keeps the button rendering one arrow icon, not two.
function stripTrailingArrow(s) {
  if (!s) return s
  return String(s).replace(/\s*[→➜➝➞➟➠]+\s*$/u, '').trim()
}

export function Nav({ variant = 'light' }) {
  const { user, signOut } = useAuth() || {}
  const [logoUrl, setLogoUrl] = useState(null)

  // Best-effort logo fetch from site_config. Falls back to the text wordmark
  // when no logo_url is configured OR if the network round-trip fails / errors.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sb = getSupabaseBrowser()
        if (!sb) return
        const { data, error } = await sb
          .from('site_config').select('value').eq('key', 'logo_url').maybeSingle()
        if (error || cancelled) return
        const v = (data?.value || '').trim()
        if (v) setLogoUrl(v)
      } catch { /* fall back to wordmark */ }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="container flex items-center justify-between py-6 md:py-8">
        <Link href="/" className="inline-flex items-center font-serif text-xl tracking-tighter" aria-label="Dropvine home">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Dropvine"
              height={40}
              style={{ height: '40px', width: 'auto' }}
              className="block"
              onError={() => setLogoUrl(null)}
            />
          ) : (
            <>Dropvine<span className="align-super text-[8px] ml-0.5 text-muted-foreground">®</span></>
          )}
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-sm">
          <Link href="/#how" className="text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
          <Link href="/#example" className="text-muted-foreground hover:text-foreground transition-colors">Creators</Link>
          <Link href="/#example" className="text-muted-foreground hover:text-foreground transition-colors">Example</Link>
          <Link href="/#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2 md:gap-5 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Dashboard</Link>
              <button onClick={() => signOut?.()} className="text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Sign in</Link>
              <Link href="/signup" className="inline-flex items-center gap-2 border border-foreground px-4 py-2 hover:bg-foreground hover:text-background transition-colors">
                Start your drop <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// Exported for re-use by other client components (homepage CTA, etc).
export { stripTrailingArrow }
