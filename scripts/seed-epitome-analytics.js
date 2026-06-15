/**
 * SEED SCRIPT: Epitome Club - Friday Night Analytics Data
 * ========================================================
 * Seeds a realistic Indian nightclub Friday night event at Epitome Club, Pune
 * with comprehensive analytics data across ALL collections.
 *
 * Collections seeded:
 *   - events (3 events: 1 completed, 1 live, 1 upcoming)
 *   - orders (ticket purchases)
 *   - rsvp_orders (RSVP entries)
 *   - entitlements (issued & consumed)
 *   - ticket_assignments (claimed identities for guestlist)
 *   - ticket_scans (gate QR scans)
 *   - scan_ledger (scan results)
 *   - promoter_links (promoter referral links)
 *   - ledger_entries (financial transactions)
 *   - share_bundles (for pending claims)
 *   - event_queues (demand/queue joins)
 *   - event_surge_metrics (surge data)
 *
 * Usage: node scripts/seed-epitome-analytics.js
 */

import { getAdminDb } from '@c1rcle/core/admin';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

// Load .env from project root
config({ path: resolve(process.cwd(), '.env') });

// ─── Firebase Init (matches @c1rcle/core/admin.js key parsing) ───────────────
const db = getAdminDb();

// ─── Constants ───────────────────────────────────────────────────────────────
const VENUE_ID = 'venue_NPpsWyAw';
const VENUE_NAME = 'EPITOME';
const VENUE_CITY = 'Pune';
const VENUE_AREA = 'THE MILLS';
const OWNER_UID = 'NPpsWyAwQyT1X2ctWhXGxGLIByk1';

// Event dates — last Friday (completed), this Friday (live), next Friday (upcoming)
const now = new Date();
const dayOfWeek = now.getDay();
const lastFriday = new Date(now);
lastFriday.setDate(now.getDate() - ((dayOfWeek + 2) % 7) - 7);
lastFriday.setHours(21, 0, 0, 0);

const thisFriday = new Date(now);
thisFriday.setDate(now.getDate() + ((5 - dayOfWeek + 7) % 7 || 7));
thisFriday.setHours(21, 0, 0, 0);

// If today IS Friday, use today
const todayIsFriday = dayOfWeek === 5;
if (todayIsFriday) {
  thisFriday.setDate(now.getDate());
}

const nextFriday = new Date(thisFriday);
nextFriday.setDate(thisFriday.getDate() + 7);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ordId = (i) => `ORD-EPITOME-${String(i).padStart(4, '0')}`;
const rsvpId = (i) => `RSVP-EPITOME-${String(i).padStart(4, '0')}`;
const entId = (i) => `ENT-EPITOME-${String(i).padStart(4, '0')}`;
const scanId = (i) => `SCAN-EPITOME-${String(i).padStart(4, '0')}`;

const INDIAN_FIRST_NAMES_M = [
  'Aarav',
  'Vihaan',
  'Arjun',
  'Reyansh',
  'Aditya',
  'Sai',
  'Rohan',
  'Kabir',
  'Arnav',
  'Dhruv',
  'Harsh',
  'Ishaan',
  'Karan',
  'Yash',
  'Kunal',
  'Rahul',
  'Pranav',
  'Vivek',
  'Nikhil',
  'Siddharth',
  'Akash',
  'Dev',
  'Manish',
  'Rajesh',
  'Vikram',
  'Ankit',
  'Deepak',
  'Gaurav',
  'Sahil',
  'Mohit',
];
const INDIAN_FIRST_NAMES_F = [
  'Ananya',
  'Aadhya',
  'Myra',
  'Sara',
  'Aanya',
  'Diya',
  'Isha',
  'Kiara',
  'Riya',
  'Priya',
  'Shreya',
  'Neha',
  'Pooja',
  'Kavya',
  'Tanvi',
  'Sakshi',
  'Bhavna',
  'Nikita',
  'Aditi',
  'Sanya',
  'Meera',
  'Radhika',
  'Anjali',
  'Nisha',
  'Swati',
  'Deepika',
  'Komal',
  'Jhanvi',
  'Aisha',
  'Simran',
];
const LAST_NAMES = [
  'Sharma',
  'Patel',
  'Gupta',
  'Singh',
  'Kumar',
  'Joshi',
  'Verma',
  'Reddy',
  'Nair',
  'Mehta',
  'Deshmukh',
  'Pawar',
  'Kulkarni',
  'Jadhav',
  'Chavan',
  'Malhotra',
  'Kapoor',
  'Bhat',
  'Rao',
  'Thakur',
  'Chauhan',
  'Yadav',
  'Pandey',
  'Srivastava',
  'Banerjee',
  'Ghosh',
  'Das',
  'Chakraborty',
  'Mishra',
  'Saxena',
];
const CITIES = [
  'Pune',
  'Pune',
  'Pune',
  'Pune',
  'Pune',
  'Mumbai',
  'Mumbai',
  'Mumbai',
  'Nashik',
  'Nagpur',
  'Aurangabad',
  'Bangalore',
  'Delhi',
  'Hyderabad',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomAge = (min, max) => min + Math.floor(Math.random() * (max - min));
const dobFromAge = (age) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(Math.floor(Math.random() * 12));
  d.setDate(1 + Math.floor(Math.random() * 28));
  return d.toISOString().split('T')[0];
};

function generatePerson(index) {
  const isFemale = Math.random() < 0.42; // Realistic nightclub ratio ~42% women
  const firstName = isFemale ? pick(INDIAN_FIRST_NAMES_F) : pick(INDIAN_FIRST_NAMES_M);
  const lastName = pick(LAST_NAMES);
  const age = randomAge(19, 32);
  return {
    id: `user_seed_${String(index).padStart(3, '0')}`,
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 99)}@gmail.com`,
    phone: `+91${9000000000 + Math.floor(Math.random() * 999999999)}`,
    gender: isFemale ? 'female' : 'male',
    age,
    dob: dobFromAge(age),
    city: pick(CITIES),
  };
}

// ─── Generate People ─────────────────────────────────────────────────────────
const people = Array.from({ length: 280 }, (_, i) => generatePerson(i));

// ─── Event Definitions ──────────────────────────────────────────────────────

const EVENT_1_ID = 'evt_epitome_neon_noir';
const EVENT_2_ID = 'evt_epitome_bass_temple';
const EVENT_3_ID = 'evt_epitome_after_dark';

const PROMOTER_1_ID = 'promo_seed_ravi';
const PROMOTER_2_ID = 'promo_seed_neha';
const HOST_1_ID = 'host_seed_arjun';

const makeEvent = (
  id,
  title,
  subtitle,
  startDate,
  lifecycle,
  status,
  ticketsSold,
  viewsCount,
  poster,
) => {
  const endDate = new Date(new Date(startDate).getTime() + 6 * 60 * 60 * 1000); // 6h event
  const tickets = [
    {
      id: `${id}-stag`,
      name: 'Stag Entry',
      description: 'Single male entry with 1 complimentary drink',
      price: 1500,
      quantity: 150,
      remaining: 150 - Math.floor(ticketsSold * 0.45),
      isFree: false,
      salesStart: new Date(new Date(startDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      salesEnd: startDate.toISOString(),
      minPerOrder: 1,
      maxPerOrder: 4,
      genderRequirement: 'male',
      requiredGender: 'male',
      promoterEnabled: true,
      overrideCommission: false,
      promoterCommissionType: 'percent',
      promoterCommission: 15,
      overrideDiscount: false,
      promoterDiscountType: 'percent',
      promoterDiscount: 10,
      scheduledPrices: [],
    },
    {
      id: `${id}-couple`,
      name: 'Couple Entry',
      description: 'Couple entry with 2 complimentary drinks',
      price: 2500,
      quantity: 100,
      remaining: 100 - Math.floor(ticketsSold * 0.35),
      isFree: false,
      salesStart: new Date(new Date(startDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      salesEnd: startDate.toISOString(),
      minPerOrder: 1,
      maxPerOrder: 3,
      genderRequirement: 'couple',
      isCouple: true,
      promoterEnabled: true,
      overrideCommission: false,
      promoterCommissionType: 'percent',
      promoterCommission: 15,
      overrideDiscount: false,
      promoterDiscountType: 'percent',
      promoterDiscount: 10,
      scheduledPrices: [],
    },
    {
      id: `${id}-vip`,
      name: 'VIP Table (4 pax)',
      description: 'Premium table for 4 with a bottle of premium spirit + mixers',
      price: 8000,
      quantity: 15,
      remaining: 15 - Math.floor(ticketsSold * 0.05),
      isFree: false,
      salesStart: new Date(new Date(startDate).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      salesEnd: startDate.toISOString(),
      minPerOrder: 1,
      maxPerOrder: 2,
      genderRequirement: 'any',
      promoterEnabled: true,
      overrideCommission: true,
      promoterCommissionType: 'percent',
      promoterCommission: 10,
      overrideDiscount: false,
      promoterDiscountType: 'percent',
      promoterDiscount: 0,
      scheduledPrices: [],
    },
    {
      id: `${id}-ladies`,
      name: 'Ladies Free Entry',
      description: 'Complimentary entry for women before 11 PM',
      price: 0,
      quantity: 80,
      remaining: 80 - Math.floor(ticketsSold * 0.15),
      isFree: true,
      rsvpOnly: true,
      salesStart: new Date(new Date(startDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      salesEnd: startDate.toISOString(),
      minPerOrder: 1,
      maxPerOrder: 5,
      genderRequirement: 'female',
      requiredGender: 'female',
      promoterEnabled: true,
      overrideCommission: false,
      promoterCommissionType: 'percent',
      promoterCommission: 0,
      scheduledPrices: [],
    },
  ];

  const priceRange = { min: 0, max: 8000, currency: 'INR' };
  const gradient = ['#0d0d0d', '#1a0a2e'];
  const accentColor = '#a855f7';

  return {
    id,
    slug: id,
    title,
    summary: subtitle,
    description: `${title} at ${VENUE_NAME}. ${subtitle}. Featuring top DJs, immersive lighting, premium cocktails, and an unforgettable Friday night experience in Pune.`,
    category: 'Parties',
    tags: ['Nightlife', 'Clubbing', 'EDM', 'Bollywood', 'HipHop', 'Friday', 'Pune'],
    host: VENUE_NAME,
    hostId: OWNER_UID,
    location: `${VENUE_NAME}, ${VENUE_AREA}`,
    venue: VENUE_NAME,
    venueId: VENUE_ID,
    city: VENUE_CITY,
    cityKey: 'pune',
    country: 'India',
    date: startDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    time: '9:00 pm - 3:00 am',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    startTime: '21:00',
    endTime: '03:00',
    timezone: 'Asia/Kolkata',
    image: poster,
    poster,
    gradient,
    accentColor,
    spotifyTrack: '',
    guests: ['DJ Ravish', 'DJ Chetas', 'MC Altaf', 'Nucleya'],
    gallery: [poster],
    tickets,
    tables: [],
    promoCodes: [
      { code: 'EPITOME20', discountType: 'percent', discountValue: 20, maxUses: 50, usedCount: 12 },
      { code: 'FRIDAY500', discountType: 'flat', discountValue: 500, maxUses: 30, usedCount: 8 },
    ],
    priceRange,
    isRSVP: false,
    promoterVisibility: true,
    promoterSettings: {
      enabled: true,
      useDefaultCommission: true,
      defaultCommission: 15,
      defaultCommissionType: 'percent',
      buyerDiscountsEnabled: true,
      useDefaultDiscount: true,
      defaultDiscount: 10,
      defaultDiscountType: 'percent',
    },
    defaultScheduledPrices: [],
    settings: {
      showExplore: true,
      password: false,
      passwordCode: '',
      activity: true,
      recurring: false,
      showGuestlist: false,
      visibility: 'public',
    },
    stats: {
      rsvps: Math.floor(ticketsSold * 1.8),
      views: viewsCount,
      saves: Math.floor(viewsCount * 0.12),
      shares: Math.floor(viewsCount * 0.04),
    },
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date(new Date(startDate).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    lifecycle,
    creatorRole: 'venue',
    creatorId: OWNER_UID,
    slotRequest: null,
    approvalNotes: '',
    rejectionReason: '',
    auditTrail: [
      {
        action: 'created',
        actor: { uid: OWNER_UID, role: 'venue' },
        timestamp: new Date(new Date(startDate).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        notes: '',
      },
      {
        action: 'transitioned_to_scheduled',
        actor: { uid: OWNER_UID, role: 'venue' },
        timestamp: new Date(new Date(startDate).getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Event published',
      },
    ],
    status,
    heatScore: Math.floor(200 + ticketsSold * 2 + viewsCount * 0.1),
    keywords: [
      'epitome',
      'neon',
      'noir',
      'friday',
      'nightclub',
      'pune',
      'party',
      'edm',
      'bollywood',
    ],
    publishedAt: new Date(new Date(startDate).getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    capacity: 500,
    publicSnapshot: {
      title,
      summary: subtitle,
      date: startDate.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: '9:00 pm - 3:00 am',
      location: `${VENUE_NAME}, ${VENUE_AREA}`,
      venue: VENUE_NAME,
      cityKey: 'pune',
      host: VENUE_NAME,
      priceRange,
      tags: ['Nightlife', 'EDM', 'Friday'],
      isActive: true,
      statusLabel: status,
      category: 'Parties',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
};

// ─── Build Events ────────────────────────────────────────────────────────────

const event1 = makeEvent(
  EVENT_1_ID,
  'NEON NOIR',
  "Pune's most electric Friday night. Neon-lit chaos meets premium sound.",
  lastFriday,
  'completed',
  'past',
  165,
  4820,
  'https://images.unsplash.com/photo-1571266028243-e4c78e580e36?w=800&q=80',
);

const event2 = makeEvent(
  EVENT_2_ID,
  'BASS TEMPLE',
  'Feel the bass in your bones. Heavy drops. Dark vibes. No mercy.',
  thisFriday,
  'live',
  'live',
  92,
  2340,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
);

const event3 = makeEvent(
  EVENT_3_ID,
  'AFTER DARK',
  'The afterhours experience. Underground. Intimate. Relentless.',
  nextFriday,
  'scheduled',
  'upcoming',
  28,
  890,
  'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800&q=80',
);

// ─── Generate Orders for Event 1 (completed) ────────────────────────────────

function generateOrders(eventId, eventData, guests, count) {
  const orders = [];
  const eventStart = new Date(eventData.startDate);

  for (let i = 0; i < count; i++) {
    const person = guests[i % guests.length];
    const ticketType = Math.random();
    let selectedTicket, qty;

    if (ticketType < 0.45) {
      // Stag
      selectedTicket = eventData.tickets[0];
      qty = 1;
    } else if (ticketType < 0.8) {
      // Couple
      selectedTicket = eventData.tickets[1];
      qty = 1;
    } else {
      // VIP
      selectedTicket = eventData.tickets[2];
      qty = 1;
    }

    const subtotal = selectedTicket.price * qty;
    const orderDate = new Date(eventStart.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

    // Some orders have promoter attribution
    let promoterAttribution = null;
    if (Math.random() < 0.35) {
      const isPromo1 = Math.random() < 0.6;
      const promoId = isPromo1 ? PROMOTER_1_ID : PROMOTER_2_ID;
      const promoName = isPromo1 ? 'Ravi Promotions' : 'Neha Events';
      const commissionRate = 15;
      promoterAttribution = {
        linkId: `link_${promoId}_${eventId}`,
        code: isPromo1 ? 'RAVI15' : 'NEHA15',
        promoterId: promoId,
        promoterName: promoName,
        commissionRate,
        commissionAmount: Math.round((subtotal * commissionRate) / 100),
      };
    }

    orders.push({
      id: ordId(i + 1 + (eventId === EVENT_1_ID ? 0 : eventId === EVENT_2_ID ? 200 : 400)),
      eventId,
      eventTitle: eventData.title,
      eventImage: eventData.image,
      eventDate: eventData.date,
      eventTime: eventData.time,
      eventLocation: eventData.location,
      userId: person.id,
      userEmail: person.email,
      userName: person.name,
      tickets: [
        {
          ticketId: selectedTicket.id,
          name: selectedTicket.name,
          price: selectedTicket.price,
          quantity: qty,
          subtotal,
        },
      ],
      totalAmount: subtotal,
      currency: 'INR',
      paymentMethod: Math.random() < 0.7 ? 'upi' : 'card',
      status: 'confirmed',
      promoterCode: promoterAttribution?.code || null,
      promoterAttribution,
      isRSVP: false,
      createdAt: orderDate.toISOString(),
      updatedAt: orderDate.toISOString(),
      paymentDetails: {
        razorpayOrderId: `order_${randomUUID().slice(0, 14)}`,
        razorpayPaymentId: `pay_${randomUUID().slice(0, 14)}`,
        method: Math.random() < 0.7 ? 'upi' : 'card',
      },
    });
  }
  return orders;
}

// ─── Generate RSVPs (Ladies Free Entry) ──────────────────────────────────────

function generateRSVPs(eventId, eventData, guests, count) {
  const rsvps = [];
  const femalePeople = guests.filter((p) => p.gender === 'female');
  const eventStart = new Date(eventData.startDate);

  for (let i = 0; i < count; i++) {
    const person = femalePeople[i % femalePeople.length];
    const ladiesTicket = eventData.tickets.find((t) => t.name === 'Ladies Free Entry');
    const rsvpDate = new Date(eventStart.getTime() - Math.random() * 5 * 24 * 60 * 60 * 1000);

    rsvps.push({
      id: rsvpId(i + 1 + (eventId === EVENT_1_ID ? 0 : eventId === EVENT_2_ID ? 100 : 200)),
      eventId,
      eventTitle: eventData.title,
      eventImage: eventData.image,
      eventDate: eventData.date,
      eventTime: eventData.time,
      eventLocation: eventData.location,
      userId: person.id,
      userEmail: person.email,
      userName: person.name,
      tickets: [
        {
          ticketId: ladiesTicket.id,
          name: ladiesTicket.name,
          price: 0,
          quantity: 1,
          subtotal: 0,
        },
      ],
      totalAmount: 0,
      currency: 'INR',
      status: 'confirmed',
      isRSVP: true,
      confirmedAt: rsvpDate.toISOString(),
      createdAt: rsvpDate.toISOString(),
      updatedAt: rsvpDate.toISOString(),
    });
  }
  return rsvps;
}

// ─── Generate Entitlements ───────────────────────────────────────────────────

function generateEntitlements(eventId, orders, rsvps, checkInRate) {
  const entitlements = [];
  const eventStart = new Date(orders[0]?.createdAt || new Date());
  let idx = 0;

  const allItems = [
    ...orders.map((o) => ({ ...o, source: 'order' })),
    ...rsvps.map((r) => ({ ...r, source: 'rsvp' })),
  ];

  for (const item of allItems) {
    const isCheckedIn = Math.random() < checkInRate;
    const checkInTime = new Date(
      new Date(eventStart).getTime() + Math.random() * 4 * 60 * 60 * 1000, // random checkin within first 4h
    );

    entitlements.push({
      id: entId(idx + 1),
      eventId,
      orderId: item.id,
      userId: item.userId,
      tierId: item.tickets[0].ticketId,
      tierName: item.tickets[0].name,
      state: isCheckedIn ? 'CONSUMED' : 'ISSUED',
      issuedAt: item.createdAt,
      consumedAt: isCheckedIn ? checkInTime.toISOString() : null,
      source: item.source === 'rsvp' ? 'rsvp' : 'purchase',
      requiredGender: item.tickets[0].name.includes('Ladies')
        ? 'female'
        : item.tickets[0].name.includes('Stag')
          ? 'male'
          : 'any',
    });
    idx++;
  }
  return entitlements;
}

// ─── Generate Ticket Scans ───────────────────────────────────────────────────

function generateTicketScans(eventId, entitlements) {
  const scans = [];
  let idx = 0;

  for (const ent of entitlements) {
    if (ent.state === 'CONSUMED') {
      scans.push({
        id: scanId(idx + 1),
        eventId,
        entitlementId: ent.id,
        userId: ent.userId,
        result: 'GRANTED',
        scannedAt: ent.consumedAt,
        scannedBy: 'scanner_epitome_01',
        gate: pick(['Main Gate', 'VIP Entrance', 'Side Entry']),
        device: 'Scanner App v2.1',
      });
      idx++;
    }

    // Add some denied scans (duplicate scan attempts, expired, etc.)
    if (Math.random() < 0.08) {
      const scanTime = new Date(
        new Date(ent.issuedAt).getTime() + Math.random() * 6 * 60 * 60 * 1000,
      );
      scans.push({
        id: scanId(idx + 1),
        eventId,
        entitlementId: ent.id,
        userId: ent.userId,
        result: 'DENIED',
        reason: pick(['ALREADY_CONSUMED', 'EXPIRED', 'INVALID_QR', 'WRONG_EVENT']),
        scannedAt: scanTime.toISOString(),
        scannedBy: 'scanner_epitome_01',
        gate: pick(['Main Gate', 'VIP Entrance']),
        device: 'Scanner App v2.1',
      });
      idx++;
    }
  }
  return scans;
}

// ─── Generate Ticket Assignments (Guestlist Data) ────────────────────────────

function generateTicketAssignments(eventId, entitlements, personPool) {
  const assignments = [];

  for (let i = 0; i < entitlements.length; i++) {
    const ent = entitlements[i];
    const person = personPool[i % personPool.length];

    assignments.push({
      id: `assign_${eventId}_${i}`,
      eventId,
      orderId: ent.orderId,
      tierId: ent.tierId,
      tierName: ent.tierName,
      redeemerId: ent.userId,
      userName: person.name,
      status: ent.state === 'CONSUMED' ? 'used' : 'active',
      claimedAt: ent.issuedAt,
      requiredGender: ent.requiredGender,
      gender: person.gender,
      dob: person.dob,
      city: person.city,
      promoterId: Math.random() < 0.3 ? pick([PROMOTER_1_ID, PROMOTER_2_ID]) : null,
    });
  }
  return assignments;
}

// ─── Generate Ledger Entries ─────────────────────────────────────────────────

function generateLedgerEntries(eventId, orders) {
  const entries = [];
  for (const order of orders) {
    if (order.totalAmount > 0) {
      // CAPTURED
      entries.push({
        id: `LED_${order.id}_CAP`,
        type: 'credit',
        state: 'CAPTURED',
        amount: order.totalAmount,
        currency: 'INR',
        metadata: {
          eventId,
          orderId: order.id,
          userId: order.userId,
          paymentMethod: order.paymentMethod,
        },
        timestamp: order.createdAt,
        description: `Payment for ${order.tickets[0].name}`,
      });

      // Platform fee
      const platformFee = Math.round(order.totalAmount * 0.12);
      entries.push({
        id: `LED_${order.id}_FEE`,
        type: 'debit',
        state: 'PLATFORM_FEE',
        amount: -platformFee,
        currency: 'INR',
        metadata: {
          eventId,
          orderId: order.id,
          feeRate: 12,
        },
        timestamp: order.createdAt,
        description: 'Platform fee (12%)',
      });
    }
  }

  // Add some refunds (~5% of orders)
  const refundCount = Math.floor(orders.length * 0.05);
  for (let i = 0; i < refundCount; i++) {
    const refundedOrder = orders[Math.floor(Math.random() * orders.length)];
    entries.push({
      id: `LED_REFUND_${i}`,
      type: 'debit',
      state: 'REFUNDED',
      amount: -refundedOrder.totalAmount,
      currency: 'INR',
      metadata: {
        eventId,
        orderId: refundedOrder.id,
        reason: 'Customer requested cancellation',
      },
      timestamp: new Date(
        new Date(refundedOrder.createdAt).getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
      description: `Refund for order ${refundedOrder.id}`,
    });
  }

  return entries;
}

// ─── Generate Promoter Links ─────────────────────────────────────────────────

function generatePromoterLinks(eventId) {
  return [
    {
      id: `link_${PROMOTER_1_ID}_${eventId}`,
      eventId,
      promoterId: PROMOTER_1_ID,
      promoterName: 'Ravi Promotions',
      code: 'RAVI15',
      commissionRate: 15,
      isActive: true,
      clicks: Math.floor(Math.random() * 300 + 150),
      conversions: Math.floor(Math.random() * 40 + 20),
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: `link_${PROMOTER_2_ID}_${eventId}`,
      eventId,
      promoterId: PROMOTER_2_ID,
      promoterName: 'Neha Events',
      code: 'NEHA15',
      commissionRate: 15,
      isActive: true,
      clicks: Math.floor(Math.random() * 200 + 100),
      conversions: Math.floor(Math.random() * 30 + 15),
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

// ─── Generate Event Queues (Demand Data) ──────────────────────────────────────

function generateEventQueues(eventId, eventStart, count) {
  const queues = [];
  for (let i = 0; i < count; i++) {
    const person = people[Math.floor(Math.random() * people.length)];
    const joinedAt = new Date(eventStart.getTime() - Math.random() * 2 * 60 * 60 * 1000);
    const isConverted = Math.random() < 0.65;

    queues.push({
      id: `queue_${eventId}_${i}`,
      eventId,
      userId: person.id,
      userName: person.name,
      joinedAt: joinedAt.toISOString(),
      status: isConverted ? 'consumed' : 'expired',
      position: i + 1,
      tierId: pick([`${eventId}-stag`, `${eventId}-couple`, `${eventId}-vip`]),
    });
  }
  return queues;
}

// ─── Generate Share Bundles (Pending Claims) ─────────────────────────────────

function generateShareBundles(eventId, orders) {
  const bundles = [];
  // Create bundles for ~20% of couple/VIP orders
  const eligibleOrders = orders.filter(
    (o) => o.tickets[0].name.includes('Couple') || o.tickets[0].name.includes('VIP'),
  );

  for (let i = 0; i < Math.min(eligibleOrders.length * 0.2, 10); i++) {
    const order = eligibleOrders[i];
    const slotsCount = order.tickets[0].name.includes('VIP') ? 3 : 1;
    const slots = Array.from({ length: slotsCount }, (_, si) => ({
      slotIndex: si,
      claimStatus: Math.random() < 0.6 ? 'claimed' : 'unclaimed',
      requiredGender: 'any',
    }));

    bundles.push({
      id: `bundle_${eventId}_${i}`,
      eventId,
      orderId: order.id,
      tierId: order.tickets[0].ticketId,
      status: slots.every((s) => s.claimStatus === 'claimed') ? 'exhausted' : 'active',
      slots,
      createdAt: order.createdAt,
    });
  }
  return bundles;
}

// ─── MAIN SEED FUNCTION ──────────────────────────────────────────────────────

async function seedAll() {
  console.log('🎯 Starting Epitome Club Analytics Seed...\n');

  const events = [event1, event2, event3];

  // Event 1: Completed (NEON NOIR) - Full analytics
  const orders1 = generateOrders(EVENT_1_ID, event1, people.slice(0, 165), 140);
  const rsvps1 = generateRSVPs(EVENT_1_ID, event1, people, 45);
  const ents1 = generateEntitlements(EVENT_1_ID, orders1, rsvps1, 0.82); // 82% check-in rate
  const scans1 = generateTicketScans(EVENT_1_ID, ents1);
  const assigns1 = generateTicketAssignments(EVENT_1_ID, ents1, people);
  const ledger1 = generateLedgerEntries(EVENT_1_ID, orders1);
  const links1 = generatePromoterLinks(EVENT_1_ID);
  const queues1 = generateEventQueues(EVENT_1_ID, lastFriday, 85);
  const bundles1 = generateShareBundles(EVENT_1_ID, orders1);

  // Event 2: Live (BASS TEMPLE) - Partial analytics
  const orders2 = generateOrders(EVENT_2_ID, event2, people.slice(80, 180), 82);
  const rsvps2 = generateRSVPs(EVENT_2_ID, event2, people, 30);
  const ents2 = generateEntitlements(EVENT_2_ID, orders2, rsvps2, 0.45); // partial check-in (live)
  const scans2 = generateTicketScans(EVENT_2_ID, ents2);
  const assigns2 = generateTicketAssignments(EVENT_2_ID, ents2, people.slice(80));
  const ledger2 = generateLedgerEntries(EVENT_2_ID, orders2);
  const links2 = generatePromoterLinks(EVENT_2_ID);
  const queues2 = generateEventQueues(EVENT_2_ID, thisFriday, 55);
  const bundles2 = generateShareBundles(EVENT_2_ID, orders2);

  // Event 3: Upcoming (AFTER DARK) - Pre-sales only
  const orders3 = generateOrders(EVENT_3_ID, event3, people.slice(160, 200), 24);
  const rsvps3 = generateRSVPs(EVENT_3_ID, event3, people, 12);
  const ents3 = generateEntitlements(EVENT_3_ID, orders3, rsvps3, 0); // no check-ins yet
  const ledger3 = generateLedgerEntries(EVENT_3_ID, orders3);
  const links3 = generatePromoterLinks(EVENT_3_ID);
  const queues3 = generateEventQueues(EVENT_3_ID, nextFriday, 20);

  // ─── Batch Write ─────────────────────────────────────────────────────────
  const BATCH_SIZE = 450; // Firestore limit is 500

  async function batchWrite(collection, docs) {
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);
      for (const doc of chunk) {
        const ref = db.collection(collection).doc(doc.id);
        batch.set(ref, doc, { merge: true });
      }
      await batch.commit();
    }
    console.log(`   ✅ ${collection}: ${docs.length} documents`);
  }

  // Write Events
  console.log('📌 Seeding Events...');
  await batchWrite('events', events);

  // Write Orders
  console.log('💰 Seeding Orders...');
  await batchWrite('orders', [...orders1, ...orders2, ...orders3]);

  // Write RSVPs
  console.log('📋 Seeding RSVPs...');
  await batchWrite('rsvp_orders', [...rsvps1, ...rsvps2, ...rsvps3]);

  // Write Entitlements
  console.log('🎟️  Seeding Entitlements...');
  await batchWrite('entitlements', [...ents1, ...ents2, ...ents3]);

  // Write Ticket Scans
  console.log('📷 Seeding Ticket Scans...');
  await batchWrite('ticket_scans', [...scans1, ...scans2]);

  // Write Scan Ledger (same data, different collection name)
  console.log('📊 Seeding Scan Ledger...');
  await batchWrite('scan_ledger', [...scans1, ...scans2]);

  // Write Ticket Assignments (Guestlist)
  console.log('👥 Seeding Ticket Assignments...');
  await batchWrite('ticket_assignments', [...assigns1, ...assigns2]);

  // Write Share Bundles
  console.log('🔗 Seeding Share Bundles...');
  await batchWrite('share_bundles', [...bundles1, ...bundles2]);

  // Write Ledger Entries
  console.log('💳 Seeding Ledger Entries...');
  await batchWrite('ledger_entries', [...ledger1, ...ledger2, ...ledger3]);

  // Write Promoter Links
  console.log('📢 Seeding Promoter Links...');
  await batchWrite('promoter_links', [...links1, ...links2, ...links3]);

  // Write Event Queues
  console.log('🚦 Seeding Event Queues...');
  await batchWrite('event_queues', [...queues1, ...queues2, ...queues3]);

  // ─── Summary ─────────────────────────────────────────────────────────────
  const totalOrders = orders1.length + orders2.length + orders3.length;
  const totalRevenue = [...orders1, ...orders2, ...orders3].reduce((s, o) => s + o.totalAmount, 0);
  const totalRsvps = rsvps1.length + rsvps2.length + rsvps3.length;
  const totalEnts = ents1.length + ents2.length + ents3.length;
  const totalScans = scans1.length + scans2.length;
  const totalCheckedIn = [...ents1, ...ents2].filter((e) => e.state === 'CONSUMED').length;

  console.log('\n' + '─'.repeat(60));
  console.log('🎉 SEED COMPLETE - Epitome Club Analytics Data');
  console.log('─'.repeat(60));
  console.log(`
📍 Venue:       ${VENUE_NAME} (${VENUE_ID})
📍 City:        ${VENUE_CITY}, ${VENUE_AREA}

🎉 Events:
   1. NEON NOIR      — ${lastFriday.toDateString()} (Completed)
   2. BASS TEMPLE    — ${thisFriday.toDateString()} (Live)
   3. AFTER DARK     — ${nextFriday.toDateString()} (Upcoming)

📊 Analytics Summary:
   Orders:         ${totalOrders}
   Revenue:        ₹${totalRevenue.toLocaleString('en-IN')}
   RSVPs:          ${totalRsvps}
   Entitlements:   ${totalEnts}
   Check-ins:      ${totalCheckedIn}
   Scans:          ${totalScans}
   Ledger Entries: ${ledger1.length + ledger2.length + ledger3.length}

🔗 Promoter Links: 6 (2 per event)
🚦 Queue Joins:    ${queues1.length + queues2.length + queues3.length}

💡 Analytics Dashboards That Should Light Up:
   ✅ Overview     — Revenue, tickets, check-ins, top events
   ✅ Reach        — Funnel (Discovery → RSVP → Paid → Check-in)
   ✅ Engagement   — Turnout rates, no-show rates
   ✅ Revenue      — Gross, fees, refunds, net payable
   ✅ Audience     — Age bands, gender ratio, city breakdown
   ✅ Ops          — Entry curve, peak hours, scan denials
   ✅ Attribution  — Host & promoter leaderboards
   ✅ Timeline     — Minute-by-minute heartbeat
   ✅ Strategy     — AI recommendations
`);
}

seedAll().catch(console.error);
