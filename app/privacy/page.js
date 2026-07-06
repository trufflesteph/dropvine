import Link from 'next/link'
import { DropvineLogo } from '@/components/dropvine/logo'
import { Footer } from '@/components/dropvine/footer'

export const metadata = {
  title: 'Privacy Policy — Dropvine',
}

export default function PrivacyPage() {
  return (
    <>
      <header className="border-b border-border">
        <div className="container py-5">
          <Link href="/" aria-label="Dropvine home"><DropvineLogo height={40} /></Link>
        </div>
      </header>
      <main className="container py-20 max-w-2xl">
        <h1 className="font-serif font-light text-5xl tracking-tighter">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground italic">Effective Date: July 1, 2026</p>
        <p className="mt-8 leading-relaxed text-muted-foreground">
          This Privacy Policy describes how Dropvine LLC ("Dropvine," "we," "us," or "our") collects, uses,
          and handles information when you use the Dropvine platform at dropvine.pro (the "Platform").
          By using the Platform, you agree to the practices described in this policy.
        </p>

        <Section title="1. Information We Collect">
          <Sub title="1.1 Vendor Account Information">
            <p>When you create a vendor account, we collect:</p>
            <ul>
              <li>Name and email address</li>
              <li>Business name, category, and location</li>
              <li>Profile information you provide (bio, logo, website, phone)</li>
              <li>Drop content you submit (titles, descriptions, photos, product information, pricing, fulfillment details)</li>
            </ul>
          </Sub>
          <Sub title="1.2 Shopper Information">
            <p>When a shopper places an order through a vendor's drop page, we collect:</p>
            <ul>
              <li>Name, email address, and phone number (as provided)</li>
              <li>Order details (products, quantities, pricing)</li>
              <li>Venmo handle (when provided for payment purposes)</li>
            </ul>
          </Sub>
          <Sub title="1.3 Contact Lists">
            Vendors may upload contact lists to the Platform for the purpose of sending drop
            announcements. These lists contain names, email addresses, and optionally phone numbers of
            the vendor's customers. Dropvine stores this information solely to provide the notification
            services described in this policy.
          </Sub>
          <Sub title="1.4 Usage Information">
            We collect information about how you use the Platform, including pages visited, features used,
            and actions taken. We use Google Analytics to collect anonymized usage data to improve the
            Platform. Google Analytics uses cookies and similar tracking technologies.
          </Sub>
          <Sub title="1.5 Technical Information">
            We automatically collect certain technical information when you use the Platform, including
            IP address, browser type, device type, and operating system.
          </Sub>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, operate, and improve the Platform</li>
            <li>Process vendor drop submissions and vendor-to-customer notifications</li>
            <li>Send order confirmation emails to shoppers on behalf of vendors</li>
            <li>Send drop announcement emails and SMS messages to vendor contact lists on behalf of vendors</li>
            <li>Communicate with you about your account, including transactional and service-related messages</li>
            <li>Analyze usage patterns to improve the Platform</li>
            <li>Comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="3. Contact Lists and Vendor Communications">
          <p>
            Dropvine sends emails and SMS messages to vendor contact lists solely at the direction of and
            on behalf of vendors. Dropvine does not use vendor contact lists for its own marketing
            purposes. Vendors are responsible for ensuring their contact lists are properly consented and
            compliant with applicable law.
          </p>
          <p>
            If you are a shopper who has received a communication from Dropvine on behalf of a vendor
            and wish to unsubscribe, you may do so by contacting the vendor directly or by using the
            unsubscribe mechanism in the communication.
          </p>
        </Section>

        <Section title="4. How We Share Your Information">
          <p>
            We do not sell your personal information. We may share your information in the following
            limited circumstances:
          </p>
          <Sub title="4.1 Service Providers">
            <p>We use third-party service providers to help operate the Platform, including:</p>
            <ul>
              <li>Supabase — database and file storage</li>
              <li>Vercel — hosting and infrastructure</li>
              <li>Resend — email delivery</li>
              <li>Twilio — SMS delivery</li>
              <li>Google Analytics — usage analytics</li>
            </ul>
            <p>
              These providers access information only as necessary to provide their services and are
              bound by confidentiality obligations.
            </p>
          </Sub>
          <Sub title="4.2 Vendors and Shoppers">
            When a shopper places an order through a vendor's drop page, the vendor receives the
            shopper's order information (name, email, order details) so they can fulfill the order.
            Vendors do not receive shopper payment information beyond what the shopper provides directly
            via Venmo or other payment methods.
          </Sub>
          <Sub title="4.3 Legal Requirements">
            We may disclose your information if required by law, legal process, or government request,
            or to protect the rights, property, or safety of Dropvine, our users, or others.
          </Sub>
          <Sub title="4.4 Business Transfers">
            If Dropvine LLC is involved in a merger, acquisition, or sale of assets, your information
            may be transferred as part of that transaction. We will notify you via email or prominent
            notice on the Platform before your information is transferred and becomes subject to a
            different privacy policy.
          </Sub>
        </Section>

        <Section title="5. Data Retention">
          <p>
            We retain your information for as long as your account is active. If you delete your
            account, we will delete or anonymize your personal information within 30 days, except where
            we are required to retain it for legal or compliance purposes.
          </p>
          <p>
            Vendor contact list data is retained as long as the associated vendor account is active and
            deleted within 30 days of account deletion.
          </p>
        </Section>

        <Section title="6. Cookies and Tracking">
          <p>The Platform uses cookies and similar tracking technologies for the following purposes:</p>
          <ul>
            <li>Authentication — to keep you logged in to your account</li>
            <li>Analytics — Google Analytics uses cookies to collect anonymized usage data</li>
          </ul>
          <p>
            You can control cookies through your browser settings. Disabling cookies may affect Platform
            functionality, including the ability to stay logged in.
          </p>
        </Section>

        <Section title="7. Your Rights and Choices">
          <p>You have the following rights regarding your personal information:</p>
          <ul>
            <li>Access — you may request a copy of the personal information we hold about you</li>
            <li>Correction — you may update or correct your account information at any time</li>
            <li>Deletion — you may request deletion of your account and associated data</li>
            <li>Portability — you may request your data in a portable format</li>
          </ul>
          <p>
            To exercise these rights, contact us at{' '}
            <a href="mailto:hello@dropvine.pro" className="underline underline-offset-2">hello@dropvine.pro</a>.
            We will respond to your request within 30 days.
          </p>
        </Section>

        <Section title="8. Data Security">
          <p>
            We use industry-standard security measures to protect your information, including encrypted
            data transmission (HTTPS), secure database storage via Supabase, and access controls
            limiting who can access your data. However, no method of transmission over the internet or
            electronic storage is completely secure, and we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>
            The Platform is not directed to children under 13, and we do not knowingly collect personal
            information from children under 13. If you believe we have collected information from a child
            under 13, please contact us at{' '}
            <a href="mailto:hello@dropvine.pro" className="underline underline-offset-2">hello@dropvine.pro</a>
            {' '}and we will delete it promptly.
          </p>
        </Section>

        <Section title="10. Oregon Privacy Rights">
          <p>
            Oregon residents may have additional rights under the Oregon Consumer Privacy Act (OCPA).
            If you are an Oregon resident and wish to exercise your rights under the OCPA, please contact
            us at{' '}
            <a href="mailto:hello@dropvine.pro" className="underline underline-offset-2">hello@dropvine.pro</a>.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes
            by posting the updated policy on the Platform and updating the effective date. Your continued
            use of the Platform after changes are posted constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="12. Contact Us">
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or our data
            practices, please contact us at:
          </p>
          <p className="mt-4">
            Dropvine LLC<br />
            <a href="mailto:hello@dropvine.pro" className="underline underline-offset-2">hello@dropvine.pro</a><br />
            dropvine.pro
          </p>
        </Section>
      </main>
      <Footer />
    </>
  )
}

function Section({ title, children }) {
  return (
    <section className="mt-12">
      <h2 className="font-serif font-light text-2xl tracking-tight mb-4">{title}</h2>
      <div className="space-y-4 text-muted-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

function Sub({ title, children }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
