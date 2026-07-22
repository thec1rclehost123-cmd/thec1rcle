import Link from 'next/link';

const supportEmail = 'support@thec1rcle.com';

export const metadata = {
  title: 'Delete Your Account | THE C1RCLE',
  description: 'Instructions for deleting a THE C1RCLE account and associated personal data.',
  alternates: { canonical: '/account-deletion' },
};

export default function AccountDeletionPage() {
  return (
    <div className="min-h-screen bg-[#070707] px-5 pb-24 pt-28 text-white sm:px-8">
      <article className="mx-auto max-w-4xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#F44A22]">
          Account and data rights
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Delete your account</h1>
        <p className="mt-8 max-w-3xl text-base leading-7 text-white/70">
          You can request deletion inside THE C1RCLE or by contacting support. Account deletion is
          permanent and may remove your access immediately. Resolve active tickets, transfers,
          refunds, disputes, or event access before continuing.
        </p>

        <div className="mt-14 space-y-12">
          <section>
            <h2 className="text-2xl font-bold">Delete inside the mobile app</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-6 text-base leading-7 text-white/70">
              <li>Sign in to the account you want to delete.</li>
              <li>Open Profile, then Settings.</li>
              <li>Open Account Settings and select Delete Account.</li>
              <li>Review the warning and confirm deletion.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Request deletion without the app</h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              Email{' '}
              <a className="text-white underline underline-offset-4" href={`mailto:${supportEmail}?subject=Account%20Deletion%20Request`}>
                {supportEmail}
              </a>{' '}
              from the email associated with your account, or include the account phone number and
              ask for an account-deletion request. Do not send an OTP, password, payment credential,
              card number, CVV, or UPI PIN. We may verify account ownership before acting.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">What is deleted or retained</h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              Deletion is intended to remove or de-identify the account profile, photos, social
              activity, preferences, device tokens, and other personal data that is no longer
              required. Limited order, payment, refund, ticket, fraud, safety, dispute, tax,
              accounting, security, or audit records may be retained where necessary for applicable
              law, legal claims, reconciliation, or protection against abuse. Retained data is
              restricted to those purposes and removed or anonymized when the retention need ends.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Need help?</h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              If deletion fails or you need a copy or correction of your data, contact{' '}
              <a className="text-white underline underline-offset-4" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              . See the <Link className="text-white underline underline-offset-4" href="/privacy">Privacy Policy</Link> for more information.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
