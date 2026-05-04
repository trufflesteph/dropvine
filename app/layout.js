import './globals.css'
import { Inter, Fraunces } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from 'sonner'
import { SpeedInsights } from '@vercel/speed-insights/next'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata = {
  title: 'Dropvine — Timed launches for the considered',
  description: 'A quiet platform for creators to release their work on their own clock. Waitlists, reservations, and countdowns — designed like an object.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans">
        <AuthProvider>
          {children}
          <Toaster position="bottom-center" toastOptions={{ style: { background: '#0E0E0C', color: '#FAFAF7', border: 'none', borderRadius: 2, fontSize: 13 } }} />
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
