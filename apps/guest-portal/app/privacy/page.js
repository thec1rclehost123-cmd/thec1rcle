import Link from 'next/link';

const effectiveDate = 'July 3, 2026';
const supportEmail = 'support@thec1rcle.com';

export const metadata = {
  title: 'Privacy Policy | THE C1RCLE',
  description:
    'Privacy Policy for THE C1RCLE, an India-only event discovery, ticketing, social, and venue access platform.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | THE C1RCLE',
    description:
      'How THE C1RCLE collects, uses, shares, protects, and retains personal data in India.',
    url: '/privacy',
    type: 'website',
  },
};

const summaryItems = [
  'THE C1RCLE currently operates only in India and is designed around Indian users, venues, hosts, promoters, and event operations.',
  'We process personal data to run event discovery, ticketing, payments, entry scanning, guest lists, social features, support, fraud prevention, and safety workflows.',
  'We do not sell your personal data. We share data only where needed to provide the service, comply with law, protect people, process payments, support events, or follow your instructions.',
  'You can request access, correction, deletion, consent withdrawal, grievance support, or other privacy assistance by contacting support@thec1rcle.com.',
];

const sections = [
  {
    title: '1. Who We Are And What This Policy Covers',
    body: [
      'This Privacy Policy explains how THE C1RCLE collects, uses, discloses, stores, protects, and otherwise processes personal data when you use THE C1RCLE websites, mobile applications, event pages, checkout flows, ticket wallet, scanner experiences, guest lists, social features, promoter links, communications, marketing, support channels, and related services.',
      'In this Policy, "THE C1RCLE", "we", "us", and "our" refer to the operator of THE C1RCLE platform. "You" refers to guests, app users, ticket buyers, attendees, hosts, venues, promoters, scanner staff, creators, partners, and any other person who uses or interacts with THE C1RCLE.',
      'THE C1RCLE is built for life offline in India. The platform currently supports events, venues, communities, and ticketing inside India only. If you access THE C1RCLE from outside India, you understand that the platform is still intended for India-based events and India-facing services.',
      'This Policy applies to personal data processed in digital form and to offline data that is later digitized for THE C1RCLE operations. It should be read with our Terms of Service, event-specific terms, refund policies, community guidelines, safety policies, and any additional notices shown at the time data is collected.',
    ],
  },
  {
    title: '2. Indian Privacy And Digital Law Alignment',
    body: [
      'THE C1RCLE is designed to align with applicable Indian digital privacy and platform laws, including the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000, and applicable rules, regulations, directions, and lawful government or court orders that may apply to our services.',
      'For India privacy purposes, THE C1RCLE may act as a Data Fiduciary where we determine why and how personal data is processed. Our service providers may act as Data Processors when they process personal data on our behalf. Event hosts, venues, promoters, payment providers, identity verification providers, and other partners may separately act as independent data fiduciaries or controllers for their own processing activities.',
      'Where consent is required, we aim to ask for clear consent for specified purposes. Where Indian law allows processing for certain legitimate uses, contractual necessity, safety, fraud prevention, legal compliance, or other lawful purposes, we may rely on those grounds.',
      'This Policy is written for transparency and product readiness. It is not a substitute for legal advice. THE C1RCLE should have this Policy reviewed by qualified Indian counsel before final launch or material commercial rollout.',
    ],
  },
  {
    title: '3. Personal Data We Collect From Guests And App Users',
    body: [
      'Account and contact data: name, display name, username, email address, phone number, password or authentication identifiers, login method, account status, referral code, support identifiers, and similar information used to create, verify, secure, and support your account.',
      'Profile data: profile photo, bio, interests, event preferences, city, college or community signals where provided, social profile details, linked social handles, privacy settings, notification settings, subscription status, and other information you add to your profile.',
      'Age, eligibility, and safety data: date of birth or age range where needed, age-gate confirmations, event eligibility signals, verification status, safety reports, moderation notes, account restrictions, incident details, blocked users, emergency contact details where you choose to provide them, and records needed for trust and safety decisions.',
      'Event and ticket data: events viewed, saved, liked, shared, joined, waitlisted, purchased, transferred, claimed, checked into, or attended; order IDs; ticket IDs; QR or wallet identifiers; guest-list status; RSVP status; queue or admission tokens; promoter codes; discounts; check-in status; scanned-at time; scanner device context; and related event activity.',
      'Transaction and payment data: checkout amount, cart items, ticket tier, taxes, fees, currency, payment status, refund status, payment provider reference, invoice or receipt details, and risk signals. Full card numbers, UPI credentials, net-banking passwords, and payment authentication secrets are processed by payment providers and are not meant to be stored by THE C1RCLE.',
      'Social and communication data: chats, group messages, direct messages, event chat activity, likes, matches, connection requests, photo-gallery posts, captions, reactions, reports, and other content you create, send, upload, or make available through THE C1RCLE.',
      'Location data: city, approximate location inferred from IP address, event location preferences, venue directions, and precise device location only where you grant permission for features such as nearby events, maps, safety tools, or location-based recommendations.',
      'Contacts and invite data: if you choose to sync contacts, invite friends, share referral links, or use social discovery features, we may process contact names, phone numbers, or invite metadata for those limited purposes. Please do not upload or share someone else\'s contact details unless you have permission to do so.',
      'Device and technical data: device type, operating system, app version, browser, IP address, language, time zone, mobile network, crash logs, performance logs, push notification token, cookie identifiers, session data, security logs, and fraud-prevention signals.',
      'Communications with us: support emails, in-app support requests, dispute details, feedback, survey responses, call or message records where applicable, and metadata about your communications with THE C1RCLE.',
    ],
  },
  {
    title: '4. Personal Data We Collect From Hosts, Venues, Promoters, And Operators',
    body: [
      'Host and venue account data: business name, venue name, representative name, role, email, phone number, address, city, legal or trade name, brand assets, social handles, event history, team members, role permissions, and dashboard activity.',
      'Event setup data: event title, description, poster, media, date, time, venue, age limits, capacity, ticket tiers, pricing, guest-list rules, refunds, queue rules, promoter allocations, scanner rules, entry windows, menus, terms, and other operational details needed to publish and operate events.',
      'Business and payout data: bank or payout details, tax or compliance details, settlement records, revenue share, invoices, refund data, chargeback data, KYC status, and information needed for finance, reconciliation, fraud prevention, or legal compliance.',
      'Scanner and staff data: staff names, staff roles, device identifiers, scanner sessions, check-in activity, permissions, audit logs, and operational records showing who accessed or changed event data.',
      'Partner communications: emails, dashboard requests, support tickets, approvals, rejection reasons, compliance notes, partnership status, and messages exchanged with THE C1RCLE.',
    ],
  },
  {
    title: '5. Data From Other Sources',
    body: [
      'We may receive personal data from event hosts, venues, promoters, ticket holders, friends who invite you, payment providers, authentication providers, analytics providers, fraud-prevention vendors, marketing partners, public sources, social platforms you connect, and service providers that help us operate THE C1RCLE.',
      'If another user buys or transfers a ticket for you, invites you to an event, adds you to a guest list, shares a referral link, or claims a ticket on your behalf, we may receive your name, phone number, email, ticket status, or other details needed to complete that action.',
      'If you sign in using a third-party service, we may receive profile details made available by that service, subject to your settings with that service.',
    ],
  },
  {
    title: '6. How We Use Personal Data',
    body: [
      'To provide the platform: create accounts, authenticate users, display events, enable checkout, issue tickets, maintain wallet access, manage waitlists, run guest lists, enable entry scanning, process transfers and claims, provide maps and venue information, and support event operations.',
      'To process payments and refunds: calculate prices, apply discounts, initiate payment, verify payment, issue receipts, process refunds, handle chargebacks, reconcile settlements, and maintain legally required accounting records.',
      'To personalize the experience: recommend events, cities, venues, categories, communities, social matches, waitlists, and content based on your preferences, activity, purchase history, location permissions, and privacy settings.',
      'To enable social features: show attendance context, group chats, direct messages, likes, profiles, galleries, matches, social discovery, and other community features according to your settings and feature design.',
      'To protect safety and trust: verify accounts, prevent fraud, detect abuse, moderate content, investigate reports, enforce rules, restrict unsafe accounts, protect tickets from duplication, manage entry integrity, and support urgent safety workflows.',
      'To communicate with you: send OTPs, security alerts, order confirmations, ticket updates, event reminders, waitlist updates, refund updates, support replies, policy updates, product notices, and marketing communications where permitted.',
      'To support hosts and venues: provide attendee lists, ticket scans, promoter tracking, guest-list tools, operational analytics, event performance data, payout reports, dispute support, and compliance records.',
      'To improve THE C1RCLE: analyze feature usage, debug app crashes, monitor performance, measure campaigns, run experiments, improve recommendations, test new features, and build better products.',
      'To comply with law and enforce rights: respond to lawful requests, comply with tax, accounting, cyber-security, consumer-protection, payment, or platform obligations, enforce our terms, defend legal claims, and cooperate with lawful investigations.',
    ],
  },
  {
    title: '7. How We Share Personal Data',
    body: [
      'With event hosts, venues, and authorized event teams: we may share attendee names, ticket status, guest-list status, check-in status, order context, seating or access information, and support context needed to operate the event.',
      'With promoters and partner teams: where you use a promoter link, code, guest-list allocation, referral, or invitation, we may share limited performance, attribution, and attendee information needed to honor that relationship and prevent misuse.',
      'With payment and financial providers: we share transaction details with payment gateways, banks, payout processors, refund processors, tax or accounting providers, and fraud-prevention partners as needed to process payments and settlements.',
      'With service providers: we use vendors for cloud hosting, data storage, authentication, analytics, crash reporting, email, SMS, push notifications, customer support, maps, content delivery, fraud detection, moderation, identity verification, and operational tooling. They process data only for services they provide to us, subject to contractual and security controls.',
      'With other users: profile information, event attendance context, social actions, messages, posts, reactions, and uploaded content may be visible to other users depending on your actions, the feature, and your privacy settings.',
      'With authorities, courts, or lawful requesters: we may disclose data where required by applicable law, legal process, court order, government direction, law enforcement request, cyber-security obligation, or to protect rights, safety, property, and platform integrity.',
      'In business transactions: if THE C1RCLE is involved in a merger, acquisition, financing, restructuring, sale of assets, or similar transaction, personal data may be shared with relevant counterparties and advisers, subject to appropriate safeguards.',
      'With your instruction or consent: we may share data when you ask us to do so, connect another service, invite another person, transfer a ticket, claim a ticket, export data, or otherwise direct a disclosure.',
      'We do not sell personal data. We do not share SMS opt-in consent or messaging consent status with third parties for their independent marketing or advertising purposes.',
    ],
  },
  {
    title: '8. Cookies, Analytics, Advertising, And Tracking',
    body: [
      'THE C1RCLE websites may use cookies, pixels, SDKs, local storage, mobile identifiers, and similar technologies to keep you signed in, remember preferences, secure sessions, measure performance, understand traffic, attribute campaigns, detect fraud, and improve the platform.',
      'We may use analytics and crash-reporting tools to understand how the website and app are used, diagnose issues, and improve reliability. Where required, we will provide consent controls or opt-out choices for optional cookies or tracking technologies.',
      'We may use marketing and attribution tools to understand whether campaigns, promoter links, or referrals are effective. We do not use this to sell your personal data.',
      'Your browser, device, or operating system may let you block cookies, reset identifiers, restrict tracking, or limit location access. Some features may not work properly if required technologies are disabled.',
    ],
  },
  {
    title: '9. Location, Contacts, Camera, Photos, And Device Permissions',
    body: [
      'THE C1RCLE asks for device permissions only when a feature needs them. For example, location may support nearby event discovery, maps, safety tools, or personalized recommendations; camera and photo library permissions may support profile photos, event galleries, verification, or scanner tools; contacts may support invites or social discovery.',
      'You can deny or revoke device permissions through your device settings. Revoking a permission may limit the relevant feature but should not prevent you from using unrelated parts of the platform.',
      'If you upload photos, videos, posters, documents, or other media, you are responsible for ensuring that you have the rights and consent needed to share that content on THE C1RCLE.',
    ],
  },
  {
    title: '10. User Content, Event Content, And Public Information',
    body: [
      'Some information on THE C1RCLE is intended to be public or semi-public, including public event pages, venue pages, host pages, event posters, event descriptions, public promoter pages, and content you choose to post in shared spaces.',
      'Other users may save, screenshot, copy, or share content that you make visible to them. We cannot control all downstream use by other users, hosts, venues, or third-party platforms.',
      'We may remove or restrict content that violates our terms, safety rules, community guidelines, law, venue requirements, or the rights of others.',
    ],
  },
  {
    title: '11. Data Retention',
    body: [
      'We keep personal data for as long as needed to provide THE C1RCLE, fulfill the purposes described in this Policy, comply with legal, tax, accounting, payment, safety, fraud-prevention, dispute, audit, and regulatory obligations, and enforce our terms.',
      'Ticketing, order, payment, refund, scan, settlement, and audit records may be retained for longer periods because they are needed for financial reconciliation, venue disputes, fraud prevention, taxation, chargebacks, legal claims, and event safety reviews.',
      'Chat, social, profile, marketing, and preference data may be deleted, anonymized, or restricted when it is no longer needed, when you delete your account, or when we no longer have a lawful basis to process it, subject to legal and safety exceptions.',
      'Where deletion is not immediately possible from backups, logs, or archival systems, we will isolate or phase out the data according to our retention and security practices.',
    ],
  },
  {
    title: '12. Security',
    body: [
      'We use administrative, technical, and organizational safeguards designed to protect personal data, including access controls, encryption in transit where appropriate, authentication controls, audit logs, monitoring, role-based permissions, and separation of sensitive operational systems.',
      'Payment credentials are intended to be handled by payment providers, not stored directly by THE C1RCLE. Ticket QR and scanner systems are designed to reduce unauthorized duplication and misuse.',
      'No internet, mobile, payment, or event platform can guarantee absolute security. You are responsible for keeping your login credentials secure, protecting your device, and telling us promptly if you believe your account or ticket has been compromised.',
      `Security or privacy concerns can be reported to ${supportEmail}.`,
    ],
  },
  {
    title: '13. Cross-Border Processing And Indian Users',
    body: [
      'THE C1RCLE is an India-only service, but some service providers, infrastructure, support tools, analytics tools, communication systems, or payment partners may process data in India or other jurisdictions, subject to applicable Indian law and transfer restrictions.',
      'Where personal data is transferred or processed outside India, we aim to use appropriate contractual, technical, and organizational safeguards and to follow applicable Indian legal requirements.',
      'If Indian law restricts transfers of certain categories of data or requires additional safeguards, THE C1RCLE will take steps designed to comply with those requirements as they apply to our platform.',
    ],
  },
  {
    title: '14. Children And Age-Restricted Events',
    body: [
      'THE C1RCLE is not intended for children. Because the platform is focused on nightlife, ticketed events, venues, social discovery, and age-restricted experiences, users must generally be at least 18 years old to create an account or use the service, unless a specific feature clearly allows otherwise under applicable law.',
      'Some events may be restricted to users who are 21 or older or who meet venue-specific eligibility requirements. Hosts and venues may require age or identity checks at entry.',
      'We do not knowingly collect personal data from children in a manner prohibited by Indian law. If you believe a child has provided personal data to THE C1RCLE, contact us at support@thec1rcle.com so we can review and take appropriate action.',
    ],
  },
  {
    title: '15. Your Privacy Rights And Choices',
    body: [
      'Subject to applicable law, you may request information about personal data we process about you, access relevant information, correct inaccurate or incomplete data, update your account details, request deletion or erasure, withdraw consent where processing is based on consent, opt out of marketing, or raise a privacy grievance.',
      'You may also have the right under Indian digital personal data law to nominate another person to exercise certain rights if you die or become incapacitated, once the relevant legal mechanism applies to the request.',
      'You can update many account, profile, notification, location, and privacy settings directly inside the app. You can also use device settings to control location, contacts, camera, photos, notifications, and tracking permissions.',
      'Withdrawing consent may limit or disable features that need the relevant data. For example, if you withdraw location permission, nearby recommendations may not work; if you withdraw consent needed to operate your account, certain services may no longer be available.',
      `To exercise privacy rights or ask a privacy question, email ${supportEmail}. We may need to verify your identity before acting on a request. We may reject or limit requests where permitted by law, including where data must be retained for legal, safety, security, fraud-prevention, payment, tax, or dispute purposes.`,
    ],
  },
  {
    title: '16. Marketing And Communications Choices',
    body: [
      'We may send service messages such as OTPs, security alerts, ticket confirmations, event changes, refund updates, waitlist updates, account notices, and support replies. These are not optional marketing messages.',
      'Where permitted, we may send promotional messages about events, features, venues, communities, offers, or partners. You can opt out of marketing emails or messages using unsubscribe options, in-app controls, device controls, or by contacting support@thec1rcle.com.',
      'Opting out of marketing does not stop service, safety, transactional, payment, or legal communications.',
    ],
  },
  {
    title: '17. Third-Party Links, Venues, Hosts, And Payment Providers',
    body: [
      'THE C1RCLE may link to third-party websites, maps, payment pages, social platforms, venue pages, host pages, app stores, or partner services. Their privacy practices are governed by their own policies.',
      'Event hosts, venues, promoters, photographers, artists, security teams, and other event participants may collect data directly from you at or around an event. THE C1RCLE is not responsible for independent data practices that are outside our control.',
      'When you pay through a payment provider, that provider may process payment data under its own terms and privacy policy. THE C1RCLE receives payment status and transaction references needed to complete the order.',
    ],
  },
  {
    title: '18. Grievance Redressal And Contact',
    body: [
      `For privacy, data, account, safety, support, or grievance requests, contact THE C1RCLE at ${supportEmail}.`,
      'Please include your name, account phone number or email, the nature of your request, the relevant event or order ID if applicable, and enough information for us to verify and respond to the request.',
      'We aim to respond within a reasonable time and in accordance with applicable Indian law. If a request relates to a host, venue, payment provider, or other independent partner, we may direct you to that party or coordinate where appropriate.',
    ],
  },
  {
    title: '19. Changes To This Policy',
    body: [
      'We may update this Privacy Policy as THE C1RCLE evolves, as features change, as laws change, or as our data practices mature.',
      'When we make material changes, we will update the effective date and may notify you by email, in-app notice, website banner, or another appropriate method.',
      'Your continued use of THE C1RCLE after an updated Policy becomes effective means the updated Policy applies to your continued use, subject to any consent requirements under applicable law.',
    ],
  },
];

function Section({ section, index }) {
  return (
    <section className="border-t border-white/10 py-10 md:py-12">
      <div className="mb-5 flex items-start gap-4">
        <span className="mt-1 font-mono text-xs uppercase tracking-[0.28em] text-orange">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="font-heading text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
          {section.title}
        </h2>
      </div>
      <div className="space-y-5 pl-0 text-base leading-8 text-white/70 md:pl-16">
        {section.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] px-4 pb-28 pt-32 text-white sm:px-6 md:px-12 md:pt-40">
      <div className="mx-auto max-w-5xl">
        <header className="mb-14 md:mb-20">
          <div className="mb-6 inline-flex border border-orange/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.32em] text-orange">
            India Privacy Notice
          </div>
          <h1 className="max-w-4xl font-heading text-5xl font-black uppercase leading-none tracking-tight md:text-7xl">
            THE C1RCLE Privacy Policy
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/60">
            Effective as of {effectiveDate}. This policy explains how THE C1RCLE handles
            personal data for an India-only event discovery, ticketing, social, venue, and entry
            access platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.22em] text-white/40">
            <span>India only</span>
            <span>/</span>
            <span>DPDP-oriented</span>
            <span>/</span>
            <span>Event ticketing</span>
            <span>/</span>
            <span>Social safety</span>
          </div>
        </header>

        <section className="mb-16 border-y border-white/10 py-8">
          <h2 className="mb-6 font-heading text-xl font-black uppercase tracking-tight text-white">
            Quick Summary
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {summaryItems.map((item) => (
              <p key={item} className="border-l border-orange/50 pl-4 text-sm leading-7 text-white/60">
                {item}
              </p>
            ))}
          </div>
        </section>

        <nav aria-label="Privacy Policy sections" className="mb-16">
          <h2 className="mb-5 text-xs font-black uppercase tracking-[0.3em] text-white/40">
            Sections
          </h2>
          <ol className="grid gap-x-6 gap-y-3 text-sm text-white/60 md:grid-cols-2">
            {sections.map((section) => (
              <li key={section.title}>{section.title}</li>
            ))}
          </ol>
        </nav>

        <div>
          {sections.map((section, index) => (
            <Section key={section.title} section={section} index={index} />
          ))}
        </div>

        <section className="mt-16 border border-white/10 p-6 md:p-10">
          <h2 className="font-heading text-2xl font-black uppercase tracking-tight text-white">
            Contact THE C1RCLE
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/60">
            For privacy requests, account support, data questions, safety escalations, or grievance
            redressal, email{' '}
            <a href={`mailto:${supportEmail}`} className="font-bold text-orange hover:text-orange-light">
              {supportEmail}
            </a>
            . For event-specific questions, include your event name, order ID, ticket ID, or the
            phone number/email used on THE C1RCLE.
          </p>
          <div className="mt-8">
            <Link
              href="/terms"
              className="text-xs font-black uppercase tracking-[0.28em] text-white/50 transition-colors hover:text-white"
            >
              View Terms of Service
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
