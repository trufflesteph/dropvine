export function Footer() {
  return (
    <footer className="border-t border-border mt-32">
      <div className="container py-14 md:py-20 grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
        <div className="col-span-2 md:col-span-2">
          <div className="font-serif text-2xl tracking-tighter">Dropvine</div>
          <p className="mt-3 text-muted-foreground max-w-sm leading-relaxed">
            The anticipation engine for considered drops. Built for makers who release in moments, not catalogs.
          </p>
        </div>
        <div>
          <div className="uppercase tracking-[0.2em] text-[11px] text-muted-foreground mb-4">Platform</div>
          <ul className="space-y-2">
            <li><a href="/#how" className="hover:text-foreground text-muted-foreground">How it works</a></li>
            <li><a href="/#pricing" className="hover:text-foreground text-muted-foreground">Pricing</a></li>
            <li><a href="/#creators" className="hover:text-foreground text-muted-foreground">Creators</a></li>
            <li><a href="/dashboard" className="hover:text-foreground text-muted-foreground">Studio</a></li>
          </ul>
        </div>
        <div>
          <div className="uppercase tracking-[0.2em] text-[11px] text-muted-foreground mb-4">Company</div>
          <ul className="space-y-2">
            <li><a href="/manifesto" className="hover:text-foreground text-muted-foreground">Manifesto</a></li>
            <li><a href="/press" className="hover:text-foreground text-muted-foreground">Press</a></li>
            <li><a href="/contact" className="hover:text-foreground text-muted-foreground">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="container pb-10 flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Dropvine</span>
        <span className="font-serif italic">The anticipation engine.</span>
      </div>
    </footer>
  )
}
