import './globals.css'
import { Inter, Fraunces } from 'next/font/google'
import Script from 'next/script'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

// Asset URL hosted on Supabase Storage. Updating the file in the bucket
// auto-cascades to all sharers / browsers (no redeploy needed) — this is a
// content address, not a bundled asset.
const FAVICON_URL = 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/assets/favicon.png'
const SITE_TITLE = 'Dropvine — Sell more. Text less.'
const SITE_DESCRIPTION = 'Stop taking orders through DMs. Dropvine does the work for you. No transaction fees, ever.'

export const metadata = {
  title: SITE_TITLE,
  description: 'Set your products and pricing, pick a deadline, and let Dropvine do the rest. Your customers get a link, you get a clean order list — no DMs, no spreadsheets, no chaos.',
  // OpenGraph metadata — used by iMessage, Slack, Facebook, LinkedIn,
  // WhatsApp, etc. when someone pastes a Dropvine link. No `images` here —
  // app/opengraph-image.jsx generates og:image dynamically and Next.js
  // wires it in automatically.
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: 'https://dropvine.pro',
    type: 'website',
  },
  // Twitter / X card — image comes from the same dynamic opengraph-image.jsx.
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  // Browser favicon + iOS home-screen icon, all pointing at the same PNG
  // (Next.js's metadata API will inject the right <link> tags for each kind).
  icons: {
    icon: FAVICON_URL,
    shortcut: FAVICON_URL,
    apple: FAVICON_URL,
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans">
        {/* Google Analytics — afterInteractive so it never blocks first paint.
            Tag ID is hardcoded since it's public anyway and we want it loading
            on every page including static-rendered ones. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HC1SG3484H"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HC1SG3484H');
          `}
        </Script>
        <AuthProvider>
          {children}
          <Toaster position="bottom-center" toastOptions={{ style: { background: '#0E0E0C', color: '#FAFAF7', border: 'none', borderRadius: 2, fontSize: 13 } }} />
        </AuthProvider>
      </body>
    </html>
  )
}
