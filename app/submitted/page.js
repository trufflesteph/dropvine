import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// Static landing page shown to vendors after a successful Tally form submission.
// Visited via the Tally form's redirect URL → https://dropvine.pro/submitted.
//
// Server component — no client state, no interactivity beyond the link.
// Layout matches the platform aesthetic (Inter sans, Cormorant Garamond serif
// via Fraunces, neutral background, #4CAF50 primary green) and is intentionally
// minimal: no nav, no footer, no sidebar.
const DROPVINE_GREEN = '#4CAF50'
const DROPVINE_GREEN_HOVER = '#43A047'

export const metadata = {
  title: 'Drop submitted — Dropvine',
  description: "Your drop has been submitted. Check your email to preview and publish.",
  // Keep search engines from indexing this transactional thank-you page.
  robots: { index: false, follow: false },
}

export default function SubmittedPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="font-serif text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-10">
          Dropvine
        </div>

        <h1 className="font-serif font-light text-5xl md:text-6xl tracking-tighter leading-[1.05] mb-6">
          You&rsquo;re almost live.
        </h1>

        <p className="text-lg md:text-xl text-foreground/85 mb-8 leading-snug">
          Your drop has been submitted.
        </p>

        <p className="text-base text-foreground/75 leading-relaxed mb-12 max-w-md mx-auto">
          Check your email &mdash; we&rsquo;ve sent you a link to preview your
          drop page and publish it when you&rsquo;re ready. Once you publish,
          your contact list will be notified automatically.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-white px-8 py-4 text-sm font-medium tracking-wide rounded-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: DROPVINE_GREEN }}
        >
          Go to your dashboard <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="mt-8 text-xs text-muted-foreground leading-relaxed">
          Don&rsquo;t see the email? Check your spam folder or contact{' '}
          <a
            href="mailto:hello@dropvine.pro"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            hello@dropvine.pro
          </a>
          .
        </p>
      </div>
    </main>
  )
}
