import Link from 'next/link'
import { Fraunces, Manrope } from 'next/font/google'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabaseConfig } from '@/lib/supabase/server'
import { DROPVINE_LOGO_URL } from '@/components/dropvine/logo'
import { HOME_COPY_DEFAULTS, HOME_COPY_KEYS, resolveHomeCopy, featureLines } from '@/lib/site-config/home-copy'
import s from './page.module.css'

// Demo drop opened by "Open the demo drop". Wildflour Cookies' pre-order drop.
const DEMO_DROP_HANDLE = 'wildflour-may-21'

// Photo slots. An empty URL renders a plain placeholder box.
const PHOTOS = {
  hero: 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/assets/home_hero.jpg',
  founder: 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/assets/founder_hero.jpg',
  phoneHero: 'https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/assets/phone_hero.jpg',
}

const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], variable: '--font-sp-serif', display: 'swap' })
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sp-sans', display: 'swap' })

const TITLE = 'Dropvine — You bake. Dropvine handles the selling.'
const DESCRIPTION = 'Fill out one form and Dropvine builds your order page, emails your customers, and keeps every order in one place. Dropvine never takes a cut of your sales.'

// openGraph/twitter replace the root layout's objects wholesale, so url,
// type and card are repeated here. og:image still comes from
// app/opengraph-image.jsx.
export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://dropvine.pro',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

// Re-check site_config (logo + homepage copy) at most every 5 minutes.
export const revalidate = 300

// Logo (site_config.logo_url, the same one the nav uses) and the editable
// homepage copy (lib/site-config/home-copy.js), in one query. Anything missing
// or empty falls back to the bundled logo / default copy.
async function getSiteConfig() {
  const fallback = { logoUrl: DROPVINE_LOGO_URL, copy: { ...HOME_COPY_DEFAULTS } }
  const { url, key, configured } = getServerSupabaseConfig()
  if (!configured) return fallback
  try {
    const sb = createClient(url, key, {
      auth: { persistSession: false },
      global: { fetch: (input, init = {}) => fetch(input, { ...init, next: { revalidate } }) },
    })
    const { data, error } = await sb.from('site_config').select('key, value').in('key', ['logo_url', ...HOME_COPY_KEYS])
    if (error || !Array.isArray(data)) return fallback
    const values = Object.fromEntries(data.map((r) => [r.key, r.value]))
    return {
      logoUrl: (values.logo_url || '').trim() || DROPVINE_LOGO_URL,
      copy: resolveHomeCopy(values),
    }
  } catch {
    return fallback
  }
}

function PhotoSlot({ src, alt, className = '', style }) {
  return (
    <div className={`${s.photo} ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} /> : null}
    </div>
  )
}

const STEPS = [
  { n: '1', title: "Tell us what you're baking.", body: 'One short form: your menu, prices, how many you can make, and when orders close.' },
  { n: '2', title: 'Your order page goes live.', body: 'Dropvine builds a page for your drop and emails your customer list. Share the link anywhere.' },
  { n: '3', title: 'Orders come in, organized.', body: "Customers order and pay you directly on Venmo. Every order lands in one list. Check Venmo, mark it paid, and bake exactly what's been ordered." },
]

const FEATURES = [
  { title: 'An order page for every drop.', body: 'Your photo, menu, prices, pickup details, and a countdown to when orders close.' },
  { title: 'Your customers hear about it.', body: "Dropvine emails your list when a drop opens, while it's open, and before it closes. Texts are coming soon." },
  { title: 'It stops at sold out.', body: "Set how many you can bake. When they're gone, they're gone. No overselling, no apology messages." },
  { title: 'One clean order list.', body: "Every order with the customer's name, items, and Venmo note. Mark it paid, mark it picked up, done." },
]

const MODES = [
  { name: 'Pre-order', body: 'Customers commit and pay before you bake.' },
  { name: 'Deposit', body: 'A small payment now, the rest at pickup.' },
  { name: 'Waitlist', body: 'Collect names before you open.' },
  { name: 'Reservation', body: 'Hold a spot for a class or tasting, pay later.' },
  { name: 'Announcement', body: 'Share a pop-up or update, no ordering needed.' },
]

const FAQS = [
  { q: 'Do I need a website?', a: 'No. Your drop page is your shop. Share the link on Instagram, Facebook, or by text.' },
  { q: 'How do customers pay?', a: 'Directly to you on Venmo. Dropvine shows them the amount and a short note to include, so you can match each payment to its order. We recommend a Venmo business profile.' },
  { q: 'What if someone orders and never pays?', a: "Their order shows as unpaid and holds those items. If you think they've walked away, cancel it. The items go back on sale and the customer gets an email." },
  { q: 'Do I need a customer list to start?', a: 'No. Share your drop link anywhere. If you have a list, upload it and Dropvine emails it for you.' },
  { q: 'What happens after the free trial?', a: "Near the end of your 30 days, we'll reach out so you can pick the plan that fits. Nothing is charged automatically." },
  { q: 'Does Dropvine handle cottage food rules?', a: "No. You're responsible for following your state's rules on labeling and selling. Dropvine is the tool you sell with." },
  { q: "I'm not a baker. Can I use Dropvine?", a: 'Yes. It works for any small-batch maker who sells in drops.' },
]

export default async function HomePage() {
  const { logoUrl, copy } = await getSiteConfig()

  return (
    <div className={`${fraunces.variable} ${manrope.variable} ${s.page}`}>

      <header className={s.header}>
        <div className={`${s.wrap} ${s.headerInner}`}>
          <Link href="/" aria-label="Dropvine home" className={s.logoLink}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Dropvine" />
          </Link>
          <nav className={s.navLinks} aria-label="Main">
            <Link href="/drops" className={s.navLink}>Shop drops</Link>
            <a href="#pricing" className={s.navLink}>Pricing</a>
            <Link href="/login" className={s.navLink}>Log in</Link>
          </nav>
          <Link href="/signup" className={`${s.btn} ${s.btnSmall} ${s.headerBtn}`}>Start free trial</Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className={s.hero}>
          <div className={`${s.wrap} ${s.split}`}>
            <div className={s.heroCopy}>
              <p className={s.eyebrow}>{copy.home_hero_eyebrow}</p>
              <h1 className={s.heroH1}>{copy.home_hero_headline_1} <span style={{ color: '#2F5128' }}>{copy.home_hero_headline_2}</span></h1>
              <p className={s.body} style={{ fontSize: 20, maxWidth: 520 }}>{copy.home_hero_subtext}</p>
              <div className={s.heroActions}>
                <Link href="/signup" className={s.btn}>{copy.home_hero_cta}</Link>
                <a href="#demo" className={s.textLink}>See a real drop →</a>
              </div>
              <p style={{ margin: 0, fontSize: 15, color: '#5E544A' }}>{copy.home_hero_note}</p>
            </div>
            <div className={s.heroVisual}>
              <PhotoSlot src={PHOTOS.hero} alt="A sunlit kitchen counter with cinnamon rolls on a cooling rack, cupcakes, frosted cookies and a mixing bowl" className={s.heroPhoto} />
              <div className={s.phone}>
                <div className={s.phoneScreen}>
                  <PhotoSlot src={PHOTOS.phoneHero} alt="A weekend bake spread" className={s.phonePhoto} />
                  <div className={s.phoneBody}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#2F5128' }}>OPEN NOW · PRE-ORDER</p>
                    <p className={s.serif} style={{ margin: 0, fontSize: 22, lineHeight: 1.1, color: '#1D3461' }}>Weekend Bake Box</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6B5F54' }}>by Maple &amp; Rye Bakery</p>
                    <div style={{ background: '#F2E8D8', borderRadius: 10, padding: '8px 10px', fontSize: 11, color: '#3B342E' }}>Orders close in <strong>2d 4h</strong></div>
                    <div className={s.phoneRow}><span>Cinnamon rolls (4)</span><span>$16 · 3 left</span></div>
                    <div className={s.phoneRow}><span>Decorated sugar cookies (6)</span><span>$18 · 5 left</span></div>
                    <div style={{ background: '#2F5128', color: '#FFFFFF', borderRadius: 999, textAlign: 'center', padding: 10, fontSize: 12, fontWeight: 700 }}>Pre-order via Venmo →</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section style={{ background: '#F2E8D8', padding: '96px 0' }}>
          <div className={`${s.wrap} ${s.split}`}>
            <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p className={s.eyebrow}>Sound familiar?</p>
              <h2 className={s.h2}>Your inbox isn't an order system.</h2>
              <p className={s.body}>You post the menu, and the messages start. By 11pm you're tallying orders on a sticky note, and someone always slips through.</p>
              <p className={`${s.body} ${s.serif}`} style={{ fontSize: 22, color: '#1D3461' }}>You started baking because you love it. Not to answer messages all night.</p>
            </div>
            <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className={`${s.bubble} ${s.bubbleIn}`}>Is the sourdough still available?</div>
              <div className={`${s.bubble} ${s.bubbleOut}`}>Can I get two? And a dozen cookies?</div>
              <div className={`${s.bubble} ${s.bubbleIn}`}>I sent the Venmo, did you get it?</div>
              <div className={`${s.bubble} ${s.bubbleOut}`}>Wait, is pickup Saturday or Sunday?</div>
              <p style={{ margin: '6px 0 0', alignSelf: 'flex-end', fontSize: 13, fontWeight: 700, color: '#8A521C' }}>47 unread</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className={s.section}>
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.heading} style={{ maxWidth: 640 }}>
              <p className={s.eyebrow}>How it works</p>
              <h2 className={s.h2}>Three steps. Then go bake.</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28 }}>
              {STEPS.map((step) => (
                <div key={step.n} className={s.stepCard}>
                  <p className={s.serif} style={{ margin: 0, fontSize: 44, color: '#4C7DB4', lineHeight: 1 }}>{step.n}</p>
                  <h3 className={s.h3} style={{ fontSize: 24 }}>{step.title}</h3>
                  <p className={s.body} style={{ fontSize: 16 }}>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* See a real drop */}
        <section id="demo" style={{ padding: '0 0 104px' }}>
          <div className={s.wrap}>
            <div className={s.demoBand}>
              <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 className={s.h2} style={{ color: '#FBF6EE' }}>See a real drop.</h2>
                <p className={s.body} style={{ color: '#E4E9F2' }}>Click through a live order page the way your customers will.</p>
              </div>
              <Link href={`/l/${DEMO_DROP_HANDLE}`} className={s.btnCream}>Open the demo drop →</Link>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className={s.sectionTan}>
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.heading} style={{ maxWidth: 720 }}>
              <p className={s.eyebrow}>What you get</p>
              <h2 className={s.h2}>From "I'm baking this week" to "all spoken for."</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '40px 48px' }}>
              {FEATURES.map((f) => (
                <div key={f.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h3 className={s.h3} style={{ fontSize: 22 }}>{f.title}</h3>
                  <p className={s.body} style={{ fontSize: 16 }}>{f.body}</p>
                </div>
              ))}
            </div>
            <div style={{ background: '#FBF6EE', borderRadius: 24, padding: 36, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 className={s.h3} style={{ fontSize: 24 }}>Five ways to sell</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 20 }}>
                {MODES.map((m) => (
                  <div key={m.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: '#2F5128' }}>{m.name}</p>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{m.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className={s.serif} style={{ margin: 0, fontStyle: 'italic', fontSize: 19, color: '#5E544A' }}>Not a baker? Dropvine works the same way for candle makers, potters, jam makers, and other small-batch makers.</p>
          </div>
        </section>

        {/* Fees */}
        <section className={s.section}>
          <div className={s.wrap} style={{ display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p className={s.eyebrow}>Fees</p>
              <h2 className={s.h2}>Dropvine never takes a cut.</h2>
              <p className={s.body}>Most order platforms charge a percentage of every sale, or add a fee to your customer's order. Dropvine is one flat monthly price, whether you sell ten cookies or a thousand. Your customers pay you directly, with nothing extra added at checkout.</p>
            </div>
            <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1D3461' }}>A month with $2,000 in orders, at $25 each</p>
              <div style={{ overflowX: 'auto', background: '#FFFFFF', border: '1px solid #EADFCC', borderRadius: 20 }}>
                <table className={s.table}>
                  <thead>
                    <tr style={{ background: '#F2E8D8', textAlign: 'left' }}>
                      <th></th>
                      <th>Your customers pay in fees</th>
                      <th>You pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>A typical percentage-based platform</td>
                      <td>$144</td>
                      <td>$82 in card processing</td>
                    </tr>
                    <tr style={{ background: '#F3F7EF' }}>
                      <td style={{ fontWeight: 700, color: '#2F5128' }}>Dropvine Maker</td>
                      <td style={{ fontWeight: 700, color: '#2F5128' }}>$0</td>
                      <td>$10, plus about $46 in Venmo business fees</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#6B5F54' }}>Based on published fees as of October 2026. Venmo's fee goes to Venmo, not Dropvine.</p>
            </div>
          </div>
        </section>

        {/* Founder */}
        <section className={s.sectionTan}>
          <div className={`${s.wrap} ${s.split}`}>
            <PhotoSlot src={PHOTOS.founder} alt="Stephanie Baturoni in her chocolate shop" className={s.founderPhoto} style={{ flex: '1 1 340px', minHeight: 420 }} />
            <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p className={s.eyebrow}>Why Dropvine</p>
              <h2 className={s.h2}>Built by someone who's been there.</h2>
              <p className={s.body}>I ran Portland Truffle, an artisan chocolate business. I had a customer list I almost never used. That list was my best shot at sales: people who already loved what I made and kept coming back. But selling to them meant hours of messages, spreadsheets, and chasing payments. And the tools that could help all wanted a cut of every sale.</p>
              <p className={s.body}>So I built the one I wished I'd had. Dropvine sells to your regulars for you, and it never takes a cut.</p>
              <p className={s.serif} style={{ margin: 0, fontStyle: 'italic', fontSize: 20, color: '#1D3461' }}>Stephanie Baturoni, Founder</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className={s.section}>
          <div className={`${s.wrap} ${s.stack}`}>
            <div className={s.heading} style={{ alignItems: 'center', textAlign: 'center' }}>
              <p className={s.eyebrow}>Pricing</p>
              <h2 className={s.h2}>{copy.home_pricing_headline}</h2>
              <p className={s.body}>{copy.home_pricing_subtext}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'stretch' }}>
              <div className={s.priceCard} style={{ background: '#FFFFFF', border: '1px solid #EADFCC' }}>
                <h3 className={s.h3} style={{ fontSize: 28 }}>Maker</h3>
                <p style={{ margin: 0 }}><span className={s.serif} style={{ fontSize: 44, color: '#1D3461' }}>{copy.home_tier_maker_price}</span><span style={{ fontSize: 16, color: '#6B5F54' }}> {copy.home_tier_maker_period}</span></p>
                <p style={{ margin: 0, fontSize: 15, color: '#5E544A' }}>{copy.home_tier_maker_tagline}</p>
                <ul>
                  {featureLines(copy.home_tier_maker_features).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <Link href="/signup" className={`${s.btn} ${s.btnOutline}`}>Start free trial</Link>
              </div>
              <div className={s.priceCard} style={{ background: '#FFFFFF', border: '2px solid #2F5128', position: 'relative' }}>
                <p className={s.pill} style={{ background: '#E3EDDC', color: '#2F5128' }}>Your trial includes this</p>
                <h3 className={s.h3} style={{ fontSize: 28 }}>Shop</h3>
                <p style={{ margin: 0 }}><span className={s.serif} style={{ fontSize: 44, color: '#1D3461' }}>{copy.home_tier_shop_price}</span><span style={{ fontSize: 16, color: '#6B5F54' }}> {copy.home_tier_shop_period}</span></p>
                <p style={{ margin: 0, fontSize: 15, color: '#5E544A' }}>{copy.home_tier_shop_tagline}</p>
                <ul>
                  {featureLines(copy.home_tier_shop_features).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <Link href="/signup" className={s.btn}>Start free trial</Link>
              </div>
              <div className={s.priceCard} style={{ background: '#1D3461', color: '#F3F0EA' }}>
                <p className={s.pill} style={{ background: '#F2E8D8', color: '#8A521C' }}>{copy.home_premium_badge}</p>
                <h3 className={s.h3} style={{ fontSize: 28, color: '#FBF6EE' }}>Premium Shop Annual</h3>
                <p style={{ margin: 0 }}><span className={s.serif} style={{ fontSize: 44, color: '#FBF6EE' }}>{copy.home_tier_premium_price}</span><span style={{ fontSize: 16, color: '#C9D3E4' }}> {copy.home_tier_premium_period}</span><span style={{ fontSize: 15, color: '#C9D3E4', textDecoration: 'line-through', marginLeft: 10 }}>{copy.home_premium_original_price}</span></p>
                <p style={{ margin: 0, fontSize: 15, color: '#DDE3EE' }}>{copy.home_tier_premium_tagline} {copy.home_premium_deadline_note}</p>
                <ul>
                  {featureLines(copy.home_tier_premium_features).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <a href="#premium-waitlist" className={s.btnCream}>Join the waitlist</a>
              </div>
            </div>
            <p style={{ margin: 0, textAlign: 'center', fontSize: 15, color: '#5E544A' }}>Every plan: Dropvine never takes a cut of your sales. Cancel anytime.</p>
          </div>
        </section>

        {/* FAQ */}
        <section className={s.sectionTan}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div className={s.heading}>
              <p className={s.eyebrow}>Questions</p>
              <h2 className={s.h2}>Good to know.</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px 56px' }}>
              {FAQS.map((f) => (
                <div key={f.q} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 className={s.faqQ}>{f.q}</h3>
                  <p className={s.faqA}>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free tools */}
        <section className={s.section}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className={s.heading}>
              <p className={s.eyebrow}>Free tools</p>
              <h2 className={s.h2}>Free tools for bakers.</h2>
            </div>
            <p className={s.body}>Cost calculator and pricing calculator. Free to download.</p>
            <Link href="/tools" className={s.textLink} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>Browse the free tools →</Link>
          </div>
        </section>

        {/* Final call to action */}
        <section style={{ background: '#2F5128', padding: '96px 0' }}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', textAlign: 'center' }}>
            <h2 className={s.h2} style={{ color: '#FBF6EE', maxWidth: 760 }}>{copy.home_final_headline}</h2>
            <Link href="/signup" className={s.btnCream} style={{ padding: '0 30px', color: '#2F5128' }}>{copy.home_final_cta}</Link>
            <p style={{ margin: 0, fontSize: 15, color: '#DCE7D5' }}>Dropvine never takes a cut.</p>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerInner}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Dropvine" className={s.footerLogo} />
          <nav className={s.footerNav} aria-label="Footer">
            <Link href="/drops" className={s.footerLink}>Shop drops</Link>
            <a href="#pricing" className={s.footerLink}>Pricing</a>
            <Link href="/tools" className={s.footerLink}>Free tools</Link>
            <Link href="/login" className={s.footerLink}>Log in</Link>
            <a href="mailto:hello@dropvine.pro" className={s.footerLink}>Contact</a>
            <Link href="/terms" className={s.footerLink}>Terms</Link>
            <Link href="/privacy" className={s.footerLink}>Privacy</Link>
          </nav>
          <p style={{ margin: 0, fontSize: 13, color: '#6B5F54' }}>© 2026 Dropvine LLC</p>
        </div>
      </footer>
    </div>
  )
}
