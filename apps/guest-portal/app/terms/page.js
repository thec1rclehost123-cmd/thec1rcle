import Link from 'next/link';

const effectiveDate = 'July 18, 2026';
const supportEmail = 'support@thec1rcle.com';

export const metadata = {
  title: 'Terms of Service | THE C1RCLE',
  description:
    'Terms governing THE C1RCLE event discovery, ticketing, social, and venue-access services in India.',
  alternates: { canonical: '/terms' },
};

const sections = [
  {
    title: '1. Agreement and eligibility',
    body: [
      'These Terms govern your use of THE C1RCLE websites, consumer mobile applications, event discovery, ticketing, wallet, transfer, sharing, social, support, and related services in India. By creating an account, accepting these Terms, or using the service, you agree to these Terms and the Privacy Policy.',
      'You must provide accurate information and be legally capable of entering this agreement. THE C1RCLE is an 18+ nightlife product unless a specific service or event is expressly marked otherwise. An event may impose a higher age, identity, dress, safety, or entry requirement. A ticket does not override applicable law or venue rules.',
    ],
  },
  {
    title: '2. Accounts and security',
    body: [
      'You are responsible for activity under your account and for keeping your device, OTP, credentials, ticket links, and wallet access secure. Do not create a misleading identity, impersonate another person, share authentication codes, evade a restriction, or use another person’s ticket without authorization.',
      `Report suspected compromise, unauthorized payment, or unsafe account activity promptly to ${supportEmail}. We may require identity or ownership verification before changing an account, ticket, transfer, refund, or data-rights request.`,
    ],
  },
  {
    title: '3. Events, hosts, and venues',
    body: [
      'THE C1RCLE helps users discover and access events operated by hosts, venues, organizers, and other partners. The event page should identify material details such as date, time, venue, age requirement, ticket tier, price, fees, and applicable event terms before purchase.',
      'Hosts and venues are responsible for lawful event operation, permits, capacity, safety, alcohol service, accessibility, advertised programming, and venue-specific entry decisions. THE C1RCLE may suspend or remove an event or partner where required for safety, fraud prevention, legal compliance, or platform integrity.',
    ],
  },
  {
    title: '4. Prices, checkout, and payments',
    body: [
      'The final checkout screen displays the ticket price, applicable fees, taxes, discounts, and total payable in Indian rupees before payment authorization. Prices and availability may change until a reservation and payment are successfully completed.',
      'Payments are processed by authorized payment providers. Do not close the payment flow merely because the app is waiting for confirmation; an uncertain payment may still have been captured. THE C1RCLE may verify provider records before issuing a ticket, retrying fulfillment, cancelling an unpaid reservation, or processing a refund.',
    ],
  },
  {
    title: '5. Tickets, transfers, sharing, and entry',
    body: [
      'A ticket is valid only while THE C1RCLE records it as active for the current owner or authorized claimant. Do not duplicate, alter, resell unlawfully, or use a revoked, refunded, transferred, expired, or already-used ticket. A screenshot or copied code does not prove current ownership.',
      'Transfers and share links are subject to the state shown in the app. A sender may lose access when a transfer or claim completes. Expired, declined, revoked, cancelled, or already-claimed links may not be usable. We may reverse or freeze a ticket state to correct fraud, duplication, payment reversal, or a system integrity issue.',
    ],
  },
  {
    title: '6. Cancellations and refunds',
    body: [
      'Refund eligibility depends on the event-specific policy shown before purchase, the reason for cancellation or material change, the ticket state, provider confirmation, and rights that cannot be excluded under applicable law. Details are provided in the Refund and Cancellation Policy.',
      'A refund is not complete merely because a request was submitted or approved. It is complete only after the payment provider reports a processed refund. Bank or payment-rail posting time may follow provider timelines. Refunded or cancelled access may invalidate related tickets, shares, transfers, entitlements, and entry eligibility.',
    ],
  },
  {
    title: '7. Social features and acceptable use',
    body: [
      'You may not harass, threaten, discriminate, stalk, exploit, defraud, spam, impersonate, distribute malware, expose private information, infringe rights, facilitate unlawful activity, manipulate tickets or payments, or upload illegal or unsafe content.',
      'Use available report and block tools where appropriate. We may investigate, preserve evidence, restrict visibility, remove content, suspend accounts, protect users, assist an event operator, or respond to lawful orders. Enforcement may consider context, severity, repeated behavior, safety, and appeal information.',
    ],
  },
  {
    title: '8. Content and intellectual property',
    body: [
      'You retain ownership of content you lawfully upload. You grant THE C1RCLE a non-exclusive license to host, process, reproduce, display, adapt for technical delivery, and distribute that content only as needed to operate, secure, promote, and improve the service according to your actions and settings.',
      'Do not upload content you do not have the right to use. THE C1RCLE names, marks, software, interface, and original platform materials remain protected by applicable intellectual-property law.',
    ],
  },
  {
    title: '9. Availability, changes, and termination',
    body: [
      'We work to keep the service reliable but do not promise uninterrupted availability. Maintenance, network or provider outages, venue changes, safety events, legal requirements, or emergencies may affect features. We may change or discontinue a feature with notice where reasonably practicable.',
      'You may stop using the service or request account deletion. We may restrict or terminate access for material breach, fraud, safety risk, unlawful conduct, payment abuse, or legal obligation. Clauses that must survive—including payment, dispute, safety, records, intellectual property, and liability provisions—continue as applicable.',
    ],
  },
  {
    title: '10. Complaints, governing law, and updates',
    body: [
      `Contact ${supportEmail} for account, event, payment, refund, privacy, safety, or grievance support. Include the relevant order or event reference but never send a card number, CVV, OTP, password, or payment credential.`,
      'These Terms are governed by applicable Indian law. Mandatory consumer rights and competent statutory forums remain available. Any contractual venue, dispute process, company identity, registered address, grievance officer details, and liability language must be confirmed in the final counsel-approved version before commercial launch.',
      'We may update these Terms to reflect product, legal, safety, or operational changes. Material updates will carry a new effective date and, where required, renewed notice or acceptance.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#070707] px-5 pb-24 pt-28 text-white sm:px-8">
      <article className="mx-auto max-w-4xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#F44A22]">
          India · Consumer service terms
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Terms of Service</h1>
        <p className="mt-5 text-sm text-white/55">Effective {effectiveDate}</p>
        <p className="mt-8 max-w-3xl text-base leading-7 text-white/70">
          Read these Terms together with our{' '}
          <Link className="text-white underline underline-offset-4" href="/privacy">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link className="text-white underline underline-offset-4" href="/refund">
            Refund and Cancellation Policy
          </Link>
          .
        </p>

        <div className="mt-14 space-y-12">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-white/70">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <h2 className="text-xl font-bold">Contact</h2>
          <p className="mt-3 text-white/70">
            Email{' '}
            <a className="text-white underline underline-offset-4" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
            .
          </p>
        </div>
      </article>
    </div>
  );
}
