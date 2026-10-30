'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Menu as MenuIcon, X } from 'lucide-react'
import { wrapFocusIndex } from '@/lib/nav/links'

// Menu button + panel used below the desktop breakpoint by the shared nav
// (components/dropvine/nav.jsx) and the home page header (app/page.js).
//
// The panel is a modal over the page: Escape, the Close button, the backdrop,
// any link and a route change all close it; focus moves into it on open, is
// trapped while open and returns to the Menu button on close. The page is
// scroll-locked while it's open.
//
// Props:
//   links          [{ href, label }] page links (lib/nav/links.js)
//   user/onSignOut logged in: Dashboard + Sign out instead of Log in + CTA
//   cta            { href, label, arrow } shown to logged-out users
//   logo           node for the panel's logo link
//   desktopMinWidth  px at which the desktop nav takes over (closes the menu)
//   classes        style hooks; defaults are the shared nav's look. `hideAt`
//                  must hide the button and overlay from desktopMinWidth up.
const DEFAULT_CLASSES = {
  hideAt: 'lg:hidden',
  button: 'inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-3 border border-border text-sm text-foreground hover:border-foreground transition-colors',
  container: 'container',
  logoLink: 'inline-flex items-center min-h-[44px] font-serif text-x1 tracking-tighter',
  link: 'flex items-center min-h-[48px] text-base text-foreground hover:underline underline-offset-4',
  cta: 'mt-6 flex w-full items-center justify-center gap-2 min-h-[48px] px-4 border border-olive bg-olive text-background text-base hover:opacity-90 transition-opacity',
}

export function SiteMenu({ links, user = null, onSignOut, cta, logo, desktopMinWidth = 1024, classes = {} }) {
  const cls = { ...DEFAULT_CLASSES, ...classes }
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const menuButtonRef = useRef(null)
  const closeButtonRef = useRef(null)
  const panelRef = useRef(null)
  const wasOpen = useRef(false)
  const close = () => setOpen(false)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      closeButtonRef.current?.focus()
      const root = document.documentElement
      const prevOverflow = root.style.overflow
      root.style.overflow = 'hidden'
      const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
      // Widening to the desktop nav hides the panel, so close it rather than
      // leave the page scroll-locked.
      const wide = window.matchMedia(`(min-width: ${desktopMinWidth}px)`)
      const onWide = (e) => { if (e.matches) setOpen(false) }
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
  }, [open, desktopMinWidth])

  const trapTab = (e) => {
    if (e.key !== 'Tab') return
    const items = [...panelRef.current.querySelectorAll('a[href], button:not([disabled])')]
    const next = wrapFocusIndex(items.indexOf(document.activeElement), items.length, e.shiftKey)
    if (next < 0) return
    e.preventDefault()
    items[next].focus()
  }

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={menuId}
        className={`${cls.hideAt} ${cls.button}`}
      >
        <MenuIcon className="h-4 w-4" aria-hidden="true" />
        Menu
      </button>

      <div className={`fixed inset-0 z-50 ${cls.hideAt}`} hidden={!open}>
        <div
          className="absolute inset-0 bg-foreground/40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          aria-hidden="true"
          onClick={close}
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
          <div className="py-2">
            <div className={`${cls.container} flex items-center justify-between gap-x-4`}>
              <Link href="/" onClick={close} className={cls.logoLink} aria-label="Dropvine home">
                {logo}
              </Link>
              <button ref={closeButtonRef} type="button" onClick={close} className={cls.button}>
                <X className="h-4 w-4" aria-hidden="true" />
                Close
              </button>
            </div>
          </div>
          <nav className="pb-8" aria-label="Main">
            <div className={cls.container}>
              <ul className="border-t border-border divide-y divide-border">
                {links.map((l) => (
                  <li key={l.href}><Link href={l.href} onClick={close} className={cls.link}>{l.label}</Link></li>
                ))}
                {user ? (
                  <>
                    <li><Link href="/dashboard" onClick={close} className={cls.link}>Dashboard</Link></li>
                    <li>
                      <button type="button" onClick={() => { close(); onSignOut?.() }} className={`${cls.link} w-full text-left`}>
                        Sign out
                      </button>
                    </li>
                  </>
                ) : (
                  <li><Link href="/login" onClick={close} className={cls.link}>Log in</Link></li>
                )}
              </ul>
              {!user && cta ? (
                <Link href={cta.href} onClick={close} className={cls.cta}>
                  {cta.label}{cta.arrow ? <> <span aria-hidden>→</span></> : null}
                </Link>
              ) : null}
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
