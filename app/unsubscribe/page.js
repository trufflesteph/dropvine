import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import UnsubscribeForm from './unsubscribe-form'

// /unsubscribe?t={token} — linked from the footer of every marketing email.
//
// Opening this page changes nothing (mail scanners open links on their
// own); only a button click posts to /api/unsubscribe. Layout follows
// /submitted: centred, serif headline, no nav.

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Unsubscribe — Dropvine',
  robots: { index: false, follow: false },
}

async function lookupBusinessName(creatorId) {
  if (!creatorId) return null
  try {
    const supa = getSupabaseAdmin()
    if (!supa) return null
    const { data } = await supa
      .from('direct_vendors')
      .select('business_name')
      .eq('creator_id', creatorId)
      .maybeSingle()
    return data?.business_name || null
  } catch {
    return null
  }
}

export default async function UnsubscribePage({ searchParams }) {
  const token = typeof searchParams?.t === 'string' ? searchParams.t : ''
  const parsed = verifyUnsubscribeToken(token)
  const businessName = parsed ? (await lookupBusinessName(parsed.vendorId)) || 'this maker' : null

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="font-serif text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-10">
          Dropvine
        </div>
        {parsed ? (
          <UnsubscribeForm token={token} businessName={businessName} hasVendor={!!parsed.vendorId} />
        ) : (
          <>
            <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter leading-[1.05] mb-6">
              This link isn&rsquo;t valid.
            </h1>
            <p className="text-base text-foreground/75 leading-relaxed max-w-md mx-auto">
              Use the unsubscribe link in your most recent email, or write to{' '}
              <a href="mailto:hello@dropvine.pro" className="underline underline-offset-2 hover:text-foreground transition-colors">
                hello@dropvine.pro
              </a>{' '}
              and we&rsquo;ll take you off the list.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
