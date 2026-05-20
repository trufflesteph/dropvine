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
  // The nav's primary CTA mirrors the homepage hero CTA (`hero_primary_cta`)
  // so the operator can edit them in one place from /admin/direct/settings.
  // Falls back to "Start your drop" + /signup if the keys aren't set.
  const [primaryCtaText, setPrimaryCtaText] = useState('Start your drop')
  const [primaryCtaHref, setPrimaryCtaHref] = useState('/signup')

  // Best-effort site_config fetch (logo_url + hero_primary_cta + href).
  // One query, multiple keys.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sb = getSupabaseBrowser()
        if (!sb) return
        const { data, error } = await sb
          .from('site_config').select('key, value')
          .in('key', ['logo_url', 'hero_primary_cta', 'hero_primary_cta_href'])
        if (error || cancelled || !Array.isArray(data)) return
        const m = Object.fromEntries(data.map((r) => [r.key, r.value]))
        const logo = (m.logo_url || '').trim()
        if (logo) setLogoUrl(logo)
        const cta = stripTrailingArrow(m.hero_primary_cta || '')
        if (cta) setPrimaryCtaText(cta)
        const href = (m.hero_primary_cta_href || '').trim()
        if (href) setPrimaryCtaHref(href)
      } catch { /* keep fallbacks */ }
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
              style={{ height: '60px', width: 'auto' }}
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
              <Link href={primaryCtaHref} className="inline-flex items-center gap-2 border border-olive text-olive px-4 py-2 hover:bg-olive hover:text-background transition-colors">
                {primaryCtaText} <span aria-hidden>→</span>
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
