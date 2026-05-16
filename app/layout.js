import './globals.css'
import { Inter, Fraunces } from 'next/font/google'
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

export const metadata = {
  title: 'Dropvine Direct — Orders, handled.',
  description: 'Set your products and pricing, pick a deadline, and let Dropvine do the rest. Your customers get a link, you get a clean order list — no DMs, no spreadsheets, no chaos.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans">
        <AuthProvider>
          {children}
          <Toaster position="bottom-center" toastOptions={{ style: { background: '#0E0E0C', color: '#FAFAF7', border: 'none', borderRadius: 2, fontSize: 13 } }} />
        </AuthProvider>
      </body>
    </html>
  )
}
