'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { DROPVINE_LOGO_URL } from '@/components/dropvine/logo'

// Strip a trailing arrow (→) from CTA-style copy that some operators paste in
// — keeps the button rendering one arrow icon, not two.
function stripTrailingArrow(s) {
  if (!s) return s
  return String(s).replace(/\s*[→➜➝➞➟➠]+\s*$/u, '').trim()
}

export function Nav({ variant = 'light' }) {
  const { user, signOut } = useAuth() || {}
  const [logoUrl, setLogoUrl] = useState(DROPVINE_LOGO_URL)
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

  // Every link is at least 44px tall. Phones (below md): logo + account
  // links / CTA on the first row, page links on a second full-width row. No
  // menu, nothing hidden. "Log in" sits in the page-link row on phones so
  // the first row fits at 390px; it is the same link either way.
  const linkClass = 'inline-flex items-center min-h-[44px] text-muted-foreground hover:text-foreground transition-colors'
  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="container flex flex-wrap items-center justify-between gap-x-4 py-2 md:flex-nowrap md:py-8">
        <Link href="/" className="inline-flex items-center min-h-[44px] font-serif text-x1 tracking-tighter" aria-label="Dropvine home">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Dropvine"
              height={40}
              className="block h-11 w-auto md:h-[60px]"
              onError={() => setLogoUrl(DROPVINE_LOGO_URL === logoUrl ? null : DROPVINE_LOGO_URL)}
            />
          ) : (
            <>Dropvine<span className="align-super text-[8px] ml-0.5 text-muted-foreground">®</span></>
          )}
        </Link>
        <nav className="order-last w-full flex flex-wrap items-center gap-x-5 text-sm md:order-none md:w-auto md:gap-10">
          <Link href="/drops" className={linkClass}>Shop drops</Link>
          <Link href="/#pricing" className={linkClass}>Pricing</Link>
          <Link href="/tools" className={linkClass}>Free tools</Link>
          {!user ? <Link href="/login" className={`${linkClass} md:hidden`}>Log in</Link> : null}
        </nav>
        <div className="flex items-center gap-4 md:gap-5 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className={linkClass}>Dashboard</Link>
              <button onClick={() => signOut?.()} className={linkClass}>Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className={`${linkClass} hidden md:inline-flex`}>Log in</Link>
              <Link href={primaryCtaHref} className="inline-flex items-center min-h-[44px] gap-2 border border-olive text-olive px-4 hover:bg-olive hover:text-background transition-colors">
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
