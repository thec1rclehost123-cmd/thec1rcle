import Link from 'next/link';

const effectiveDate = 'July 18, 2026';
const supportEmail = 'support@thec1rcle.com';

export const metadata = {
  title: 'Refund and Cancellation Policy | THE C1RCLE',
  description: 'How event cancellations, refund requests, and provider processing work on THE C1RCLE.',
  alternates: { canonical: '/refund' },
};

const sections = [
  {
    title: 'Check the event policy before paying',
    body: 'Each event may have its own cancellation, rescheduling, no-show, and refund terms. The policy shown on the event or final checkout screen, together with mandatory rights under applicable law, controls eligibility. Review the event, date, time, venue, age requirement, ticket tier, quantity, price, fees, taxes, and policy before authorizing payment.',
  },
  {
    title: 'Cancelled or materially changed events',
    body: 'If an organizer cancels an event or makes a material change, THE C1RCLE will communicate the available remedy after confirming the event and payment state. Depending on the circumstances and applicable law, this may include a refund, rescheduled access, replacement access, or another clearly disclosed option. Organizer or venue processing may not override non-waivable consumer rights.',
  },
  {
    title: 'User-requested cancellation',
    body: 'Eligibility for a user-requested cancellation depends on the event policy, request time, ticket state, whether access was transferred, shared, claimed, used, expired, or already refunded, and any applicable legal right. Submitting a request does not guarantee approval.',
  },
  {
    title: 'How a refund is completed',
    body: 'An approved request may remain pending while the payment provider processes it. A refund is complete only when provider records show it as processed. We will not ask you for a CVV, card number, UPI PIN, banking password, or OTP to process a refund. Funds are normally returned to the original payment method, and the bank or payment rail controls when the credit appears.',
  },
  {
    title: 'Tickets and access after refund',
    body: 'A processed full refund or valid cancellation may invalidate related tickets, QR access, assignments, share links, transfers, entitlements, wallet entries, and venue entry eligibility. Do not attempt to use, sell, transfer, or share access after it has been cancelled, revoked, or refunded.',
  },
  {
    title: 'Disputes and support',
    body: `Contact ${supportEmail} with your account phone or email, event name, order reference, and a short description. Do not email payment credentials. We may request verification and provider evidence. Chargeback and statutory complaint rights remain subject to applicable law and payment-provider rules.`,
  },
];

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#070707] px-5 pb-24 pt-28 text-white sm:px-8">
      <article className="mx-auto max-w-4xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#F44A22]">
          Payments · Tickets · India
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Refund and Cancellation Policy</h1>
        <p className="mt-5 text-sm text-white/55">Effective {effectiveDate}</p>
        <div className="mt-14 space-y-12">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
              <p className="mt-4 text-base leading-7 text-white/70">{section.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-16 flex flex-wrap gap-4 text-sm">
          <Link className="underline underline-offset-4" href="/terms">Terms of Service</Link>
          <Link className="underline underline-offset-4" href="/privacy">Privacy Policy</Link>
          <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>Contact support</a>
        </div>
      </article>
    </div>
  );
}
