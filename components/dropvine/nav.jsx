'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Menu as MenuIcon, X } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { PAGE_LINKS, wrapFocusIndex } from '@/lib/nav/links'
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

  // Phone menu (below lg). Panel is a modal over the page: Escape, the Close
  // button, the backdrop, any link and a route change all close it; focus
  // moves into it on open, is trapped while open and returns to the Menu
  // button on close.
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuButtonRef = useRef(null)
  const closeButtonRef = useRef(null)
  const panelRef = useRef(null)
  const wasOpen = useRef(false)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    if (menuOpen) {
      wasOpen.current = true
      closeButtonRef.current?.focus()
      const root = document.documentElement
      const prevOverflow = root.style.overflow
      root.style.overflow = 'hidden'
      const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
      // Widening past lg hides the panel, so close it rather than leave the
      // page scroll-locked.
      const wide = window.matchMedia('(min-width: 1024px)')
      const onWide = (e) => { if (e.matches) setMenuOpen(false) }
      document.addEventListener('keydown', onKey)
      wide.addEventListener?.('change', onWide)
      return () => {
        root.style.overflow = prevOverflow
        document.removeEventListener('keydown', onKey)
        wide.removeEventListener?.('change', onWide)
      }
    }
    if (wasOpen.current) {
      wasOpen.current = false
      menuButtonRef.current?.focus()
    }
  }, [menuOpen])

  const trapTab = (e) => {
    if (e.key !== 'Tab') return
    const items = [...panelRef.current.querySelectorAll('a[href], button:not([disabled])')]
    const next = wrapFocusIndex(items.indexOf(document.activeElement), items.length, e.shiftKey)
    if (next < 0) return
    e.preventDefault()
    items[next].focus()
  }

  // Header is in normal flow (not floating over the page), so it can't
  // overlap page headings at any width. Every link is at least 44px tall.
  // The full row needs ~930px with "Browse makers" and the configured CTA,
  // so it starts at lg; below that it's the logo + Menu button.
  const linkClass = 'inline-flex items-center min-h-[44px] text-muted-foreground hover:text-foreground transition-colors'
  const menuLinkClass = 'flex items-center min-h-[48px] text-base text-foreground hover:underline underline-offset-4'
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
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          className="lg:hidden inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-3 border border-border text-sm text-foreground hover:border-foreground transition-colors"
        >
          <MenuIcon className="h-4 w-4" aria-hidden="true" />
          Menu
        </button>
      </div>

      <div className="fixed inset-0 z-50 lg:hidden" hidden={!menuOpen}>
        <div
          className="absolute inset-0 bg-foreground/40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          aria-hidden="true"
          onClick={closeMenu}
        />
        <div
          id={menuId}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          onKeyDown={trapTab}
          className="relative max-h-[100dvh] overflow-y-auto bg-background border-b border-border shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-200"
        >
          <div className="container flex items-center justify-between gap-x-4 py-2">
            <Link href="/" onClick={closeMenu} className="inline-flex items-center min-h-[44px] font-serif text-x1 tracking-tighter" aria-label="Dropvine home">
              {logo}
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenu}
              className="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-3 border border-border text-sm text-foreground hover:border-foreground transition-colors"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Close
            </button>
          </div>
          <nav className="container pb-8" aria-label="Main">
            <ul className="border-t border-border divide-y divide-border">
              {PAGE_LINKS.map((l) => (
                <li key={l.href}><Link href={l.href} onClick={closeMenu} className={menuLinkClass}>{l.label}</Link></li>
              ))}
              {user ? (
                <>
                  <li><Link href="/dashboard" onClick={closeMenu} className={menuLinkClass}>Dashboard</Link></li>
                  <li>
                    <button type="button" onClick={() => { closeMenu(); signOut?.() }} className={`${menuLinkClass} w-full text-left`}>
                      Sign out
                    </button>
                  </li>
                </>
              ) : (
                <li><Link href="/login" onClick={closeMenu} className={menuLinkClass}>Log in</Link></li>
              )}
            </ul>
            {!user ? (
              <Link
                href={primaryCtaHref}
                onClick={closeMenu}
                className="mt-6 flex w-full items-center justify-center gap-2 min-h-[48px] px-4 border border-olive bg-olive text-background text-base hover:opacity-90 transition-opacity"
              >
                {primaryCtaText} <span aria-hidden>→</span>
              </Link>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  )
}

// Exported for re-use by other client components (homepage CTA, etc).
export { stripTrailingArrow }
