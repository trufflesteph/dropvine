'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export function Nav({ variant = 'light' }) {
  const { user, signOut } = useAuth() || {}
  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="container flex items-center justify-between py-6 md:py-8">
        <Link href="/" className="font-serif text-xl tracking-tighter">
          Dropvine<span className="align-super text-[8px] ml-0.5 text-muted-foreground">®</span>
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-sm">
          <Link href="/#how" className="text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
          <Link href="/#creators" className="text-muted-foreground hover:text-foreground transition-colors">Creators</Link>
          <Link href="/#example" className="text-muted-foreground hover:text-foreground transition-colors">Example</Link>
          <Link href="/#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2 md:gap-5 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Dashboard</Link>
              <button onClick={() => signOut?.()} className="text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Sign in</Link>
              <Link href="/signup" className="inline-flex items-center gap-2 border border-foreground px-4 py-2 hover:bg-foreground hover:text-background transition-colors">
                Start your drop <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
