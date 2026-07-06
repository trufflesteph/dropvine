import Link from 'next/link'
import { DropvineLogo } from '@/components/dropvine/logo'
import { Footer } from '@/components/dropvine/footer'

export const metadata = {
  title: 'Terms of Service — Dropvine',
}

export default function TermsPage() {
  return (
    <>
      <header className="border-b border-border">
        <div className="container py-5">
          <Link href="/" aria-label="Dropvine home"><DropvineLogo height={40} /></Link>
        </div>
      </header>
      <main className="container py-20 max-w-2xl">
        <h1 className="font-serif font-light text-5xl tracking-tighter">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground italic">Effective Date: July 1, 2026</p>
        <p className="mt-8 leading-relaxed text-muted-foreground">
          These Terms of Service ("Terms") govern your access to and use of the Dropvine platform,
          including the website at dropvine.pro and all associated services (collectively, the "Platform"),
          operated by Dropvine LLC, an Oregon limited liability company ("Dropvine," "we," "us," or "our").
          By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree,
          do not use the Platform.
        </p>

        <Section title="1. About Dropvine">
          <p>
            Dropvine is a software platform that helps independent vendors, makers, bakers, instructors,
            and small business owners manage limited-availability product and service drops. Dropvine
            provides tools for creating drop pages, collecting customer interest and orders, and
            communicating with contact lists. Dropvine is not a payment processor, marketplace, or retail
            platform.
          </p>
        </Section>

        <Section title="2. Accounts">
          <Sub title="2.1 Vendor Accounts">
            To submit drops and access vendor features, you must create an account. You agree to provide
            accurate, current, and complete information and to keep it updated. You are responsible for
            maintaining the security of your account credentials.
          </Sub>
          <Sub title="2.2 Account Eligibility">
            You must be at least 18 years old and capable of forming a binding contract to create an
            account. By creating an account, you represent that you meet these requirements.
          </Sub>
          <Sub title="2.3 Account Termination">
            We reserve the right to suspend or terminate accounts that violate these Terms, engage in
            fraudulent activity, or harm other users or the Platform.
          </Sub>
        </Section>

        <Section title="3. Vendor Responsibilities">
          <Sub title="3.1 Your Content and Drops">
            You are solely responsible for all content you submit to the Platform, including drop
            descriptions, product information, pricing, photos, and fulfillment details. You represent that
            your content is accurate and does not infringe any third-party rights.
          </Sub>
          <Sub title="3.2 Contact Lists">
            <p>
              You are solely responsible for your contact lists uploaded to the Platform. By uploading a
              contact list, you represent and warrant that:
            </p>
            <ul>
              <li>All contacts have consented to receive communications from you about your products and services</li>
              <li>Your use of the contact list complies with all applicable laws, including the CAN-SPAM Act and any applicable state laws</li>
              <li>You own or have the right to use all contact data you upload</li>
            </ul>
            <p>Dropvine is not responsible for the content of your contact lists or any communications sent to your contacts.</p>
          </Sub>
          <Sub title="3.3 Payments">
            Dropvine does not process payments between vendors and customers. Vendors are solely
            responsible for collecting payment from customers, whether through Venmo, Stripe, or any
            other payment method. Dropvine charges no transaction fees. Any disputes between vendors
            and customers regarding payment are solely between those parties.
          </Sub>
          <Sub title="3.4 Fulfillment">
            Vendors are solely responsible for fulfilling orders placed through the Platform. Dropvine is
            not responsible for vendor fulfillment, product quality, or any disputes between vendors and
            their customers.
          </Sub>
        </Section>

        <Section title="4. Prohibited Uses">
          <p>You agree not to use the Platform to:</p>
          <ul>
            <li>Violate any applicable law or regulation</li>
            <li>Sell illegal products or services</li>
            <li>Upload contact lists without the consent of those contacts</li>
            <li>Send spam or unsolicited communications</li>
            <li>Infringe the intellectual property rights of any third party</li>
            <li>Transmit malicious code or interfere with the Platform's operation</li>
            <li>Misrepresent your identity or affiliation</li>
            <li>Engage in any fraudulent activity</li>
          </ul>
        </Section>

        <Section title="5. Platform Availability">
          <p>
            Dropvine provides the Platform on an "as is" and "as available" basis. We do not guarantee
            uninterrupted or error-free operation. We reserve the right to modify, suspend, or discontinue
            any part of the Platform at any time with or without notice.
          </p>
        </Section>

        <Section title="6. Intellectual Property">
          <Sub title="6.1 Your Content">
            You retain ownership of all content you submit to the Platform. By submitting content, you
            grant Dropvine a limited, non-exclusive, royalty-free license to use, display, and distribute
            your content solely as necessary to operate the Platform and provide services to you.
          </Sub>
          <Sub title="6.2 Dropvine's Intellectual Property">
            All Platform software, design, trademarks, and content created by Dropvine are the property
            of Dropvine LLC. You may not copy, modify, distribute, or create derivative works from
            Dropvine's intellectual property without written permission.
          </Sub>
        </Section>

        <Section title="7. Privacy">
          <p>
            Your use of the Platform is also governed by our{' '}
            <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>,
            available at dropvine.pro/privacy, which is incorporated into these Terms by reference.
          </p>
        </Section>

        <Section title="8. Disclaimer of Warranties">
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, DROPVINE DISCLAIMS ALL WARRANTIES, EXPRESS OR
            IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. DROPVINE DOES NOT WARRANT THAT THE PLATFORM WILL MEET YOUR REQUIREMENTS
            OR THAT IT WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, DROPVINE LLC SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR
            USE OF THE PLATFORM, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. DROPVINE'S TOTAL
            LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM THESE TERMS OR YOUR USE OF THE PLATFORM SHALL
            NOT EXCEED THE AMOUNT YOU PAID TO DROPVINE IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR
            $100, WHICHEVER IS GREATER.
          </p>
        </Section>

        <Section title="10. Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless Dropvine LLC and its members, officers,
            employees, and agents from any claims, damages, losses, liabilities, and expenses (including
            reasonable attorneys' fees) arising out of or related to your use of the Platform, your
            content, your contact lists, your drops, or your violation of these Terms.
          </p>
        </Section>

        <Section title="11. Governing Law and Dispute Resolution">
          <p>
            These Terms are governed by the laws of the State of Oregon, without regard to conflict of
            law principles. Any disputes arising from these Terms or your use of the Platform shall be
            resolved in the state or federal courts located in Clackamas County, Oregon, and you consent
            to the personal jurisdiction of those courts.
          </p>
        </Section>

        <Section title="12. Changes to These Terms">
          <p>
            We may update these Terms from time to time. We will notify you of material changes by
            posting the updated Terms on the Platform and updating the effective date. Your continued use
            of the Platform after changes are posted constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>If you have questions about these Terms, please contact us at:</p>
          <p className="mt-4 not-italic">
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
