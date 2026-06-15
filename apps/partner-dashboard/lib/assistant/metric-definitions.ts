/**
 * Partner Dashboard AI Assistant — Canonical Metric Definitions
 *
 * Single source of truth for what every tracked metric MEANS.
 * Used by:
 *   - The assistant's definition tool (user asks "what is net revenue?")
 *   - The orchestrator's system prompt (grounding the model in correct semantics)
 *   - Future: shared across finance pages, analytics pages, and onboarding
 *
 * All definitions must be:
 *   - Precise and unambiguous
 *   - Consistent with lib/finance/definitions.ts
 *   - Written at operator analyst level (not end-consumer marketing language)
 */

export interface MetricDefinition {
  term: string;
  aliases: string[]; // Alternative names the user might use
  definition: string; // Canonical definition
  formula?: string; // If calculated, how
  scope?: string; // What it includes / excludes
  freshness: 'live' | 'settled' | 'estimated' | 'pending';
  roles?: string[]; // Which roles see this metric
  relatedTerms?: string[];
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    term: 'Gross Revenue',
    aliases: ['gross', 'total revenue', 'top line', 'total earned'],
    definition:
      'Total money collected from all inflow sources before any deductions. Includes ticket sales, cover charges, table bookings, bottle service, food & beverage, and tips.',
    formula: 'ticket_sale + cover_payment + table_booking + bottle_booking + tip',
    scope: 'Does NOT subtract fees, refunds, chargebacks, or commissions. This is raw inflow only.',
    freshness: 'live',
    relatedTerms: ['net revenue', 'ticket revenue', 'cover revenue'],
  },
  {
    term: 'Net Revenue',
    aliases: ['net', 'net earned', 'take-home revenue', 'cleared revenue'],
    definition:
      'Gross revenue minus all deductions: processor fees, platform fees, refunds, and chargebacks. This is what the partner actually retains before payouts to collaborators.',
    formula: 'gross_revenue - processor_fees - platform_fees - refunds - chargebacks',
    scope:
      'Does NOT subtract promoter commissions or host/venue partner obligations. Those are tracked separately as partner obligations.',
    freshness: 'estimated',
    relatedTerms: ['gross revenue', 'available balance', 'pending payout'],
  },
  {
    term: 'Ticket Revenue',
    aliases: ['ticket sales', 'presale revenue', 'online ticket revenue'],
    definition:
      'Revenue from pre-sold tickets purchased by guests through the platform before or during the event.',
    freshness: 'settled',
    scope:
      'Includes all ticket tiers (general, VIP, early-bird). Excludes walk-in cover charges and door sales.',
    relatedTerms: ['cover revenue', 'gross revenue'],
  },
  {
    term: 'Cover Revenue',
    aliases: ['cover', 'door revenue', 'walk-in revenue', 'cover charge'],
    definition:
      'Revenue collected at the door from guests who pay a cover charge on entry, typically via cash or UPI at point of entry.',
    freshness: 'live',
    scope:
      'Tracked via door-scan events. May have a brief sync delay of up to 5 minutes for live events.',
    relatedTerms: ['ticket revenue', 'entry count'],
  },
  {
    term: 'Table Revenue',
    aliases: ['table bookings', 'reservation revenue', 'vip table revenue'],
    definition:
      'Revenue from confirmed table reservations and minimum spends booked through the platform.',
    freshness: 'settled',
    relatedTerms: ['bottle service', 'gross revenue'],
  },
  {
    term: 'Processing Fees',
    aliases: ['processor fees', 'razorpay fees', 'gateway fees', 'payment fees'],
    definition:
      'Fees charged by the payment processor (Razorpay) for handling online card and UPI transactions. Typically 2–3% of the transaction value.',
    freshness: 'settled',
    scope:
      'Applied only to online transactions. Cash transactions at door do not incur processor fees.',
    relatedTerms: ['platform fees', 'net revenue'],
  },
  {
    term: 'Platform Fees',
    aliases: ['c1rcle fees', 'service fees', 'commission', 'platform commission'],
    definition:
      "C1RCLE's service commission on each transaction. Applied as a percentage of gross revenue per event, per the partner's subscription tier.",
    freshness: 'settled',
    relatedTerms: ['processing fees', 'net revenue'],
  },
  {
    term: 'Refunds',
    aliases: ['refunded', 'customer refunds', 'cancellation refunds'],
    definition:
      'Money returned to customers due to order cancellations, event cancellations, or customer service decisions. Reduces gross revenue.',
    freshness: 'settled',
    scope:
      'Initiated refunds appear as pending; completed refunds are settled. Refunds do not restore processor fees already charged.',
    relatedTerms: ['chargebacks', 'net revenue'],
  },
  {
    term: 'Chargebacks',
    aliases: ['disputes', 'disputed charges', 'forced reversals'],
    definition:
      'Payments disputed and forcibly reversed by the customer through their bank. Unlike refunds, chargebacks carry an additional dispute fee and directly impact platform trust scores.',
    freshness: 'settled',
    relatedTerms: ['refunds', 'net revenue'],
  },
  {
    term: 'Pending Payout',
    aliases: ['pending', 'queued payout', 'next payout', 'awaiting payout'],
    definition:
      'Earnings that have been earned and cleared, queued for the next payout cycle but not yet disbursed to the bank account.',
    freshness: 'pending',
    scope:
      'Funds enter pending state after the settlement window closes (typically T+1 after the event). They remain pending until the scheduled payout run.',
    relatedTerms: ['settled payout', 'available balance', 'payout schedule'],
  },
  {
    term: 'Settled Payout',
    aliases: ['paid out', 'disbursed', 'transferred', 'settled', 'cleared'],
    definition:
      'Funds that have been successfully transferred to the registered bank account or UPI ID. These are final and complete.',
    freshness: 'settled',
    relatedTerms: ['pending payout', 'payout schedule'],
  },
  {
    term: 'Available Balance',
    aliases: ['available', 'withdrawable balance', 'balance available'],
    definition:
      'The amount currently eligible for manual withdrawal. Equal to cleared earnings minus reserve balance and any active holds.',
    freshness: 'live',
    formula: 'settled_revenue - reserve_balance - active_holds',
    relatedTerms: ['reserve balance', 'pending payout'],
  },
  {
    term: 'Reserve Balance',
    aliases: ['reserve', 'held reserve', 'chargeback reserve', 'dispute buffer'],
    definition:
      'A portion of earnings held back by the platform to cover potential future chargebacks and disputes. Released over time as the dispute window closes.',
    freshness: 'live',
    scope:
      'Not withdrawable until the reserve hold period expires. Typically 15–30 days after the event.',
    relatedTerms: ['available balance', 'chargebacks'],
  },
  {
    term: 'Partner Obligations',
    aliases: [
      'owed to partners',
      'partner debt',
      'host obligations',
      'promoter obligations',
      'unpaid obligations',
    ],
    definition:
      'Total amount the venue owes to partner hosts and promoters based on agreed commission rates and event performance. Visible only to venue OWNER and FINANCE_ADMIN roles.',
    freshness: 'estimated',
    roles: ['OWNER', 'FINANCE_ADMIN'],
    relatedTerms: ['commission', 'partner settlement'],
  },
  {
    term: 'Commission',
    aliases: ['promoter commission', 'referral commission', 'affiliate commission', 'my earnings'],
    definition:
      "The promoter's share of revenue attributed to their referral links and guest-list entries. Calculated as a percentage of net ticket revenue from attributed conversions.",
    freshness: 'estimated',
    scope:
      'Commission becomes final (settled) only after the event closes and refund window expires. Pre-event commission is estimated.',
    relatedTerms: ['commission override', 'partner obligations', 'attributed sales'],
  },
  {
    term: 'Commission Override',
    aliases: ['custom commission', 'manual commission', 'special rate'],
    definition:
      'A manually set commission rate that overrides the default tier-based rate for a specific event or promoter relationship.',
    freshness: 'settled',
    relatedTerms: ['commission', 'partner obligations'],
  },
  {
    term: 'Attendance Rate',
    aliases: ['show-up rate', 'check-in rate', 'door conversion', 'showed up'],
    definition:
      'Percentage of ticket holders and RSVP confirmations who actually checked in at the event. Calculated as: (actual check-ins / confirmed ticket + guestlist count) × 100.',
    formula: '(check_ins / (tickets_sold + guestlist_confirmed)) × 100',
    freshness: 'live',
    relatedTerms: ['no-show rate', 'check-in count', 'scan count'],
  },
  {
    term: 'No-Show Rate',
    aliases: ['no-shows', 'absent guests', 'did not arrive'],
    definition:
      'Percentage of confirmed guests (ticket holders + guestlist) who did NOT check in. Inverse of attendance rate.',
    formula: '100 - attendance_rate',
    freshness: 'live',
    relatedTerms: ['attendance rate', 'check-in count'],
  },
  {
    term: 'Scan Count',
    aliases: ['scans', 'qr scans', 'ticket scans', 'validated entries'],
    definition:
      'Total number of QR code scan events recorded by the scanner app. Includes valid and invalid scans. Does not equal check-in count if any scans were rejected.',
    freshness: 'live',
    relatedTerms: ['check-in count', 'entry count', 'attendance rate'],
  },
  {
    term: 'Check-In Count',
    aliases: ['check-ins', 'checked in', 'entries', 'validated guests'],
    definition:
      'Total number of guests successfully verified and admitted. Each person counted once even if re-scanned.',
    freshness: 'live',
    relatedTerms: ['scan count', 'attendance rate', 'entry count'],
  },
  {
    term: 'Partner ROI',
    aliases: ['host roi', 'promoter roi', 'return on investment', 'roi'],
    definition:
      'Net revenue attributed to a specific host or promoter divided by the commissions and obligations paid to them. Measures efficiency of the partner relationship.',
    formula: 'attributed_net_revenue / (commissions_paid + obligations_owed)',
    freshness: 'estimated',
    roles: ['OWNER', 'MANAGER', 'FINANCE_ADMIN'],
    relatedTerms: ['commission', 'net revenue', 'partner obligations'],
  },
  {
    term: 'Heat Score',
    aliases: ['event heat', 'momentum', 'buzz score'],
    definition:
      'An internal composite score indicating the momentum and demand intensity of an event, derived from view velocity, ticket sales rate, and social engagement signals.',
    freshness: 'live',
    scope:
      'Estimated metric. Higher scores indicate higher demand; used for Tonight Pulse and explore ranking.',
    relatedTerms: ['attendance rate', 'ticket revenue'],
  },
  {
    term: 'Payout Schedule',
    aliases: ['payout frequency', 'when do i get paid', 'payout timing'],
    definition:
      'The frequency at which accumulated pending earnings are disbursed. Options: daily, weekly, monthly, or manual (on request). Set in Finance > Payout Settings.',
    freshness: 'settled',
    relatedTerms: ['pending payout', 'settled payout'],
  },
  {
    term: 'Conversion Rate',
    aliases: ['link conversions', 'referral conversion', 'promoter conversion'],
    definition:
      'For promoters: the percentage of link clicks that resulted in a completed ticket purchase. Calculated per tracking link or aggregated across all links for a period.',
    formula: '(purchases / link_clicks) × 100',
    freshness: 'live',
    relatedTerms: ['attributed sales', 'commission', 'click count'],
  },
];

/** Look up a metric definition by term or alias. Returns null if not found. */
export function findMetricDefinition(query: string): MetricDefinition | null {
  const normalized = query.toLowerCase().trim();
  return (
    METRIC_DEFINITIONS.find(
      (def) =>
        def.term.toLowerCase() === normalized ||
        def.aliases.some((a) => a.toLowerCase() === normalized) ||
        def.term.toLowerCase().includes(normalized) ||
        normalized.includes(def.term.toLowerCase()),
    ) ?? null
  );
}

/** Build the definitions section of the orchestrator system prompt. */
export function buildDefinitionsPrompt(): string {
  return METRIC_DEFINITIONS.map(
    (d) => `${d.term}: ${d.definition}${d.formula ? ` Formula: ${d.formula}` : ''}`,
  ).join('\n');
}
