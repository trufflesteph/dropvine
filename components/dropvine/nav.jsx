'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { PAGE_LINKS } from '@/lib/nav/links'
import { SiteMenu } from '@/components/dropvine/site-menu'
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

  // Header is in normal flow (not floating over the page), so it can't
  // overlap page headings at any width. Every link is at least 44px tall.
  // The full row needs ~930px with "Browse makers" and the configured CTA,
  // so it starts at lg; below that it's the logo + Menu button (SiteMenu).
  const linkClass = 'inline-flex items-center min-h-[44px] text-muted-foreground hover:text-foreground transition-colors'
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt="Dropvine"
      height={40}
      className="block h-11 w-auto lg:h-[60px]"
      onError={() => setLogoUrl(DROPVINE_LOGO_URL === logoUrl ? null : DROPVINE_LOGO_URL)}
    />
  ) : (
    <>Dropvine<span className="align-super text-[8px] ml-0.5 text-muted-foreground">®</span></>
  )
  return (
    <header className="relative z-30">
      <div className="container flex items-center justify-between gap-x-4 py-2 lg:py-8">
        <Link href="/" className="inline-flex items-center min-h-[44px] font-serif text-x1 tracking-tighter" aria-label="Dropvine home">
          {logo}
        </Link>
        <nav className="hidden lg:flex items-center gap-10 text-sm" aria-label="Main">
          {PAGE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-5 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className={linkClass}>Dashboard</Link>
              <button onClick={() => signOut?.()} className={linkClass}>Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className={linkClass}>Log in</Link>
              <Link href={primaryCtaHref} className="inline-flex items-center min-h-[44px] gap-2 border border-olive text-olive px-4 hover:bg-olive hover:text-background transition-colors">
                {primaryCtaText} <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
        <SiteMenu
          links={PAGE_LINKS}
          user={user}
          onSignOut={signOut}
          cta={{ href: primaryCtaHref, label: primaryCtaText, arrow: true }}
          logo={logo}
        />
      </div>
    </header>
  )
}

// Exported for re-use by other client components (homepage CTA, etc).
export { stripTrailingArrow }
