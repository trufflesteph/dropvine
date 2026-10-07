'use client'
import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { DROPVINE_LOGO_URL } from '@/components/dropvine/logo'

const FOOTER_TAGLINE_FALLBACK = 'Your sales engine.'

export function Footer() {
  // Pull the tagline from site_config so the operator can edit it from
  // /admin/direct/settings. Falls back to the original copy only if the key
  // is genuinely empty / the network call fails.
  const [tagline, setTagline] = useState(FOOTER_TAGLINE_FALLBACK)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sb = getSupabaseBrowser()
        if (!sb) return
        const { data, error } = await sb
          .from('site_config').select('value').eq('key', 'footer_tagline').maybeSingle()
        if (error || cancelled) return
        const v = (data?.value || '').trim()
        if (v) setTagline(v)
      } catch { /* keep fallback */ }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <footer className="border-t border-border mt-32">
      <div className="container py-14 md:py-20 grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
        <div className="col-span-2 md:col-span-2">
          <img
            src={DROPVINE_LOGO_URL}
            alt="Dropvine"
            style={{ height: '60px', width: 'auto' }}
            className="block"
          />
          <p className="mt-3 text-muted-foreground max-w-sm leading-relaxed">{tagline}</p>
        </div>
        <div>
          <div className="uppercase tracking-[0.2em] text-[11px] text-muted-foreground mb-4">Platform</div>
          {/* Links are 44px tall so they're tappable on phones. */}
          <ul>
            <li><a href="/drops" className="inline-flex items-center min-h-[44px] hover:text-foreground text-muted-foreground">Shop drops</a></li>
            <li><a href="/#pricing" className="inline-flex items-center min-h-[44px] hover:text-foreground text-muted-foreground">Pricing</a></li>
            <li><a href="/tools" className="inline-flex items-center min-h-[44px] hover:text-foreground text-muted-foreground">Free tools</a></li>
            <li><a href="/dashboard" className="inline-flex items-center min-h-[44px] hover:text-foreground text-muted-foreground">Dashboard</a></li>
          </ul>
        </div>
        <div>
          <div className="uppercase tracking-[0.2em] text-[11px] text-muted-foreground mb-4">Company</div>
          <ul>
            <li><a href="mailto:hello@dropvine.pro" className="inline-flex items-center min-h-[44px] hover:text-foreground text-muted-foreground">Contact</a></li>
            <li><a href="/terms" className="inline-flex items-center min-h-[44px] hover:text-foreground text-muted-foreground">Terms of Service</a></li>
            <li><a href="/privacy" className="inline-flex items-center min-h-[44px] hover:text-foreground text-muted-foreground">Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      <div className="container pb-10 flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Dropvine</span>
      </div>
    </footer>
  )
}
