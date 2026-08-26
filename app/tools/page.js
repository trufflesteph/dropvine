import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, CircleDollarSign } from 'lucide-react'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'

const tools = [
  {
    name: 'Cost Calculator',
    description: 'See what it really costs to make and sell each product, from ingredients and supplies to your time.',
    image: '/cost-calculator-banner.png',
    href: '/dropvine-cost-calculator.xlsx',
    status: 'View / download',
    download: true,
    downloadName: 'dropvine-cost-calculator.xlsx',
  },
  {
    name: 'Pricing Calculator',
    description: 'Find a price that covers your costs, pays you fairly, and still makes sense for your customers.',
    Icon: CircleDollarSign,
    image: '/pricing-calculator-banner.png',
    href: '/dropvine-pricing-calculator.xlsx',
    status: 'View / download',
    download: true,
    downloadName: 'dropvine-pricing-calculator.xlsx',
  },
]

export const metadata = {
  title: 'Tools | Dropvine',
  description: 'Simple business tools to help you price your work and sell with confidence.',
}

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <section className="container pt-40 pb-24 md:pt-48 md:pb-32">
          <div className="max-w-3xl">
            <p className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">Dropvine tools</p>
            <h1 className="font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">
              Make the numbers <em className="font-light">work for you.</em>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Practical tools for small businesses that want to understand their costs, price with confidence, and keep more of what they earn.
            </p>
          </div>

          <div className="mt-20 grid gap-px border border-border bg-border md:grid-cols-2">
            {tools.map(({ name, description, Icon, image, href, status, download, downloadName }) => {
              const Card = download ? 'a' : Link
              return (
              <Card
                key={name}
                href={href}
                target={download ? '_blank' : undefined}
                rel={download ? 'noopener noreferrer' : undefined}
                download={download ? downloadName : undefined}
                className={`group flex min-h-[310px] flex-col justify-between bg-background transition-colors hover:bg-secondary ${image ? 'p-0' : 'p-8 md:p-10'}`}
              >
                {image && (
                  <div className="relative h-36 w-full overflow-hidden md:h-44">
                    <Image src={image} alt={`${name} banner`} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                )}
                <div className={image ? 'p-8 md:p-10' : 'flex items-start justify-between gap-6'}>
                  {!image && (
                    <div className="flex w-full items-start justify-between gap-6">
                      <div className="flex h-12 w-12 items-center justify-center border border-olive text-olive">
                        <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <ArrowUpRight className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" size={22} strokeWidth={1.5} aria-hidden="true" />
                    </div>
                  )}
                  {image && <ArrowUpRight className="float-right text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" size={22} strokeWidth={1.5} aria-hidden="true" />}
                </div>
                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.16em] text-olive">{status}</p>
                  <h2 className="font-serif text-3xl tracking-tight">{name}</h2>
                  <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{description}</p>
                  {download && <p className="mt-6 text-sm text-olive underline underline-offset-4">Open workbook</p>}
                </div>
              </Card>
              )
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}