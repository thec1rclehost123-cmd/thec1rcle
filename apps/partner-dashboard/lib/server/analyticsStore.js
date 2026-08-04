/**
 * Analytics Store
 *
 * Dashboard analytics are computed directly from Firestore because the API
 * gateway only exposes base analytics routes and does not support the
 * subcategory endpoints the dashboard expects.
 */

import { getApiClient } from './apiClient';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldPath } from 'firebase-admin/firestore';

const CANCELLED_STATUSES = new Set([
  'cancelled',
  'canceled',
  'refunded',
  'failed',
  'voided',
  'expired',
]);

const RANGE_DAYS = {
  '1d': 1,
  '7d': 7,
  '1w': 7,
  '30d': 30,
  '1m': 30,
  '90d': 90,
};

const SEEDED_ID_PREFIXES = [
  'ORD-EPITOME-',
  'RSVP-EPITOME-',
  'user_seed_',
  'promo_seed_',
  'host_seed_',
  'evt_epitome_',
  'assign_evt_epitome_',
  'link_promo_seed_',
  'queue_evt_epitome_',
  'bundle_evt_epitome_',
];

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function hasSeededPrefix(value) {
  const str = String(value || '');
  return SEEDED_ID_PREFIXES.some((prefix) => str.startsWith(prefix));
}

function isSeededRecord(record, explicitId = '') {
  if (hasSeededPrefix(explicitId)) return true;

  return [
    record?.id,
    record?.eventId,
    record?.orderId,
    record?.userId,
    record?.buyerId,
    record?.promoterId,
    record?.hostId,
    record?.creatorId,
  ].some(hasSeededPrefix);
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date?.getTime?.()) ? null : date;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startForRange(range = '30d') {
  if (!range || range === 'all') return null;
  const days = RANGE_DAYS[range] ?? 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function inRange(date, range = '30d') {
  const start = startForRange(range);
  if (!start) return true;
  if (!date) return true;
  return date >= start;
}

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function currencyAmount(rawValue) {
  const value = toNumber(rawValue);
  if (!value) return 0;
  return value > 1000 ? value / 100 : value;
}

function getEventDate(record) {
  return (
    toDate(record?.startDate) ||
    toDate(record?.date) ||
    toDate(record?.eventDate) ||
    toDate(record?.createdAt) ||
    null
  );
}

function getOrderDate(order) {
  return (
    toDate(order?.checkedInAt) ||
    toDate(order?.scannedAt) ||
    toDate(order?.confirmedAt) ||
    toDate(order?.createdAt) ||
    toDate(order?.updatedAt) ||
    null
  );
}

function getOrderAmount(order) {
  return currencyAmount(
    order?.totalAmount ?? order?.amount ?? order?.total ?? order?.grossAmount ?? order?.value ?? 0,
  );
}

function getOrderQuantity(order) {
  if (Array.isArray(order?.tickets)) {
    return order.tickets.reduce((sum, ticket) => sum + toNumber(ticket?.quantity || 1), 0);
  }
  return toNumber(order?.quantity ?? order?.ticketsCount ?? order?.guestsCount ?? 1);
}

function isActiveOrder(order) {
  const status = String(order?.status || '')
    .trim()
    .toLowerCase();
  return !CANCELLED_STATUSES.has(status);
}

function isCheckedIn(order) {
  const status = String(order?.status || '')
    .trim()
    .toLowerCase();
  return Boolean(
    order?.checkedInAt ||
    order?.scannedAt ||
    status === 'checked_in' ||
    status === 'checked-in' ||
    status === 'scanned',
  );
}

function getGuestKey(order, fallbackId) {
  return String(
    order?.userId ||
      order?.buyerId ||
      order?.email ||
      order?.buyerEmail ||
      order?.phone ||
      order?.buyerPhone ||
      fallbackId,
  );
}

function getGuestListDate(entry) {
  return (
    toDate(entry?.checkedInAt) ||
    toDate(entry?.createdAt) ||
    toDate(entry?.addedAt) ||
    toDate(entry?.updatedAt) ||
    null
  );
}

function getGuestAge(order) {
  const directAge = toNumber(order?.age ?? order?.guestAge);
  if (directAge > 0) return directAge;
  const dob = toDate(order?.dob || order?.birthDate || order?.dateOfBirth);
  if (!dob) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age > 0 ? age : 0;
}

function getAgeBand(age) {
  if (!age) return null;
  if (age <= 22) return '18–22';
  if (age <= 27) return '23–27';
  if (age <= 34) return '28–34';
  return '35+';
}

function getGender(order) {
  const value = String(order?.gender || order?.sex || '')
    .trim()
    .toLowerCase();
  if (value.startsWith('m')) return 'male';
  if (value.startsWith('f')) return 'female';
  if (value) return 'other';
  return null;
}

function getCity(order) {
  return String(order?.city || order?.location?.city || order?.address?.city || '').trim();
}

function getEventName(event) {
  return String(event?.title || event?.eventName || 'Untitled Event');
}

function getPartnerName(record, fallback) {
  return String(
    record?.hostName ||
      record?.creatorName ||
      record?.promoterName ||
      record?.venueName ||
      fallback,
  );
}

async function safeGet(promiseFactory) {
  try {
    return await promiseFactory();
  } catch {
    return { docs: [] };
  }
}

function dedupeDocs(snapshots) {
  const docs = [];
  const seen = new Set();
  for (const snapshot of snapshots) {
    for (const doc of snapshot?.docs || []) {
      const key = `${doc.ref.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push(doc);
    }
  }
  return docs;
}

async function getVenueEvents(db, venueId, range = '30d') {
  const snapshot = await safeGet(() =>
    db.collection('events').where('venueId', '==', venueId).limit(250).get(),
  );

  return snapshot.docs
    .map((doc) => normalizeEvent(doc))
    .filter((event) => !isSeededRecord(event, event.id))
    .filter((event) => inRange(event.date, range));
}

async function getHostEvents(db, hostId, range = '30d') {
  const [byHost, byCreator] = await Promise.all([
    safeGet(() => db.collection('events').where('hostId', '==', hostId).limit(250).get()),
    safeGet(() => db.collection('events').where('creatorId', '==', hostId).limit(250).get()),
  ]);

  return dedupeDocs([byHost, byCreator])
    .map((doc) => normalizeEvent(doc))
    .filter((event) => !isSeededRecord(event, event.id))
    .filter((event) => inRange(event.date, range));
}

function normalizeEvent(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    title: getEventName(data),
    date: getEventDate(data),
    venueId: String(data.venueId || ''),
    venueName: String(data.venueName || data.venue || ''),
    hostId: String(data.hostId || data.creatorId || ''),
    hostName: String(data.hostName || data.creatorName || ''),
    promoterId: String(data.promoterId || ''),
    promoterName: String(data.promoterName || ''),
    lifecycle: String(data.lifecycle || data.status || 'draft'),
    revenue: 0,
    tickets: 0,
    checkIns: 0,
    guestlistSignups: 0,
    capacity: toNumber(data.capacity ?? data.totalCapacity ?? data.stats?.capacity),
  };
}

async function getTicketScansForEventIds(db, eventIds) {
  if (!eventIds.length) return [];

  const chunks = [];
  for (let i = 0; i < eventIds.length; i += 30) {
    chunks.push(eventIds.slice(i, i + 30));
  }

  const snapshots = await Promise.all(
    chunks.map((batch) =>
      safeGet(() => db.collection('ticket_scans').where('eventId', 'in', batch).get()),
    ),
  );

  return dedupeDocs(snapshots)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((record) => !isSeededRecord(record, record.id));
}

async function getOrdersForEventIds(db, eventIds) {
  if (!eventIds.length) return [];

  const chunks = [];
  for (let i = 0; i < eventIds.length; i += 30) {
    chunks.push(eventIds.slice(i, i + 30));
  }

  const snapshots = await Promise.all(
    chunks.flatMap((chunk) => [
      safeGet(() => db.collection('orders').where('eventId', 'in', chunk).get()),
      safeGet(() => db.collection('rsvp_orders').where('eventId', 'in', chunk).get()),
    ]),
  );

  return dedupeDocs(snapshots)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((record) => !isSeededRecord(record, record.id));
}

async function getGuestListsForEventIds(db, eventIds) {
  if (!eventIds.length) return [];

  const snapshots = await Promise.all(
    chunk(eventIds, 30).map((batch) =>
      safeGet(() => db.collection('guest_lists').where('eventId', 'in', batch).get()),
    ),
  );

  return dedupeDocs(snapshots)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((record) => !isSeededRecord(record, record.id));
}

function enrichEventsWithBackendData(events, orders, guestLists, ticketScans = []) {
  const metricsByEventId = new Map(
    events.map((event) => [event.id, { revenue: 0, tickets: 0, checkIns: 0, guestlistSignups: 0 }]),
  );

  for (const order of orders) {
    if (!isActiveOrder(order)) continue;
    const eventId = String(order?.eventId || '');
    if (!metricsByEventId.has(eventId)) continue;
    const metrics = metricsByEventId.get(eventId);
    const quantity = Math.max(getOrderQuantity(order), 1);
    metrics.revenue += getOrderAmount(order);
    metrics.tickets += quantity;
  }

  for (const scan of ticketScans) {
    const eventId = String(scan?.eventId || '');
    if (!metricsByEventId.has(eventId)) continue;
    const metrics = metricsByEventId.get(eventId);
    metrics.checkIns += 1;
  }

  for (const entry of guestLists) {
    const eventId = String(entry?.eventId || '');
    if (!metricsByEventId.has(eventId)) continue;
    const metrics = metricsByEventId.get(eventId);
    metrics.guestlistSignups += 1;
    if (entry?.checkedIn) metrics.checkIns += 1;
  }

  return events.map((event) => {
    const metrics = metricsByEventId.get(event.id) || {
      revenue: 0,
      tickets: 0,
      checkIns: 0,
      guestlistSignups: 0,
    };
    return {
      ...event,
      revenue: metrics.revenue,
      tickets: metrics.tickets,
      checkIns: metrics.checkIns,
      guestlistSignups: metrics.guestlistSignups,
    };
  });
}

function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function buildDailySeries(events, range = '30d') {
  const start = startForRange(range);
  const buckets = new Map();

  for (const event of events) {
    if (start && event.date && event.date < start) continue;
    if (!event.date) continue;
    const key = event.date.toISOString().slice(0, 10);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        date: event.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        revenue: 0,
        tickets: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.revenue += event.revenue;
    bucket.tickets += event.tickets;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, ...row }) => row);
}

function buildFunnel(orders, guestLists, totals) {
  const guestlist =
    guestLists.length > 0
      ? guestLists.length
      : orders.filter((order) => String(order?.source || '').toLowerCase() === 'guestlist').length;
  return [
    { name: 'Impressions', count: 0 },
    { name: 'Page Views', count: 0 },
    { name: 'Guestlist Starts', count: guestlist },
    { name: 'Ticket Starts', count: totals.totalTicketsSold },
    { name: 'Purchases', count: totals.totalTicketsSold },
    { name: 'Arrived & Checked In', count: totals.totalCheckIns },
  ];
}

async function hydrateGuestProfiles(db, guestMap) {
  const missingGenderIds = [];
  const missingAgeIds = [];
  const missingCityIds = [];

  for (const [guestId, guest] of guestMap.entries()) {
    if (!guestId || guestId.includes('@')) continue;
    if (!guest.gender) missingGenderIds.push(guestId);
    if (!guest.age) missingAgeIds.push(guestId);
    if (!guest.city) missingCityIds.push(guestId);
  }

  const lookupIds = [...new Set([...missingGenderIds, ...missingAgeIds, ...missingCityIds])];
  if (!lookupIds.length) return;

  const userSnapshots = await Promise.all(
    chunk(lookupIds, 30).map((batch) =>
      db
        .collection('users')
        .where(FieldPath.documentId(), 'in', batch)
        .select('gender', 'sex', 'age', 'dob', 'birthDate', 'dateOfBirth', 'city')
        .get(),
    ),
  );

  for (const snapshot of userSnapshots) {
    for (const doc of snapshot.docs) {
      const user = doc.data() || {};
      const guest = guestMap.get(doc.id);
      if (!guest) continue;
      guest.gender = guest.gender || getGender(user);
      guest.age = guest.age || getGuestAge(user);
      guest.city = guest.city || getCity(user);
    }
  }
}

async function aggregateAudience(db, orders, guestLists = []) {
  const guestMap = new Map();

  for (const order of orders) {
    if (!isActiveOrder(order)) continue;
    const guestKey = getGuestKey(order, order.id);
    if (!guestMap.has(guestKey)) {
      guestMap.set(guestKey, {
        count: 0,
        gender: null,
        city: '',
        age: 0,
      });
    }
    const guest = guestMap.get(guestKey);
    guest.count += 1;
    guest.gender = guest.gender || getGender(order);
    guest.city = guest.city || getCity(order);
    guest.age = guest.age || getGuestAge(order);
  }

  for (const entry of guestLists) {
    const guestKey = getGuestKey(entry, entry.id);
    if (!guestMap.has(guestKey)) {
      guestMap.set(guestKey, {
        count: 0,
        gender: null,
        city: '',
        age: 0,
      });
    }
    const guest = guestMap.get(guestKey);
    guest.count += 1;
    guest.gender = guest.gender || getGender(entry);
    guest.city = guest.city || getCity(entry);
    guest.age = guest.age || getGuestAge(entry);
  }

  await hydrateGuestProfiles(db, guestMap);

  const genderRatio = { male: 0, female: 0, other: 0 };
  const topCities = new Map();
  const ageBandsObject = { '18–22': 0, '23–27': 0, '28–34': 0, '35+': 0 };
  let ageCount = 0;
  let ageSum = 0;
  let repeatGuests = 0;

  for (const guest of guestMap.values()) {
    if (guest.count > 1) repeatGuests += 1;
    if (guest.gender) genderRatio[guest.gender] += 1;
    if (guest.city) topCities.set(guest.city, (topCities.get(guest.city) || 0) + 1);
    if (guest.age > 0) {
      const band = getAgeBand(guest.age);
      if (band) ageBandsObject[band] += 1;
      ageCount += 1;
      ageSum += guest.age;
    }
  }

  const totalGuests = guestMap.size;
  const topCityRows = Array.from(topCities.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalGuests,
    totalUniqueGuests: totalGuests,
    repeatGuests,
    newGuests: Math.max(totalGuests - repeatGuests, 0),
    repeatGuestPct: totalGuests > 0 ? Math.round((repeatGuests / totalGuests) * 100) : 0,
    avgAge: ageCount > 0 ? Math.round(ageSum / ageCount) : 0,
    genderSplit: genderRatio,
    genderRatio,
    ageBands: ageBandsObject,
    topCities: topCityRows,
    topLocations: topCityRows,
    repeatVsNew: {
      new: Math.max(totalGuests - repeatGuests, 0),
      repeat: repeatGuests,
    },
    dataReady: totalGuests > 0,
  };
}

function aggregateOps(events, orders, guestLists = [], ticketScans = []) {
  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour: formatHour(hour),
    count: 0,
    scans: 0,
  }));
  const byDay = new Map();
  const capacityTimeline = [];

  let totalScans = 0;
  let successfulScans = 0;
  let totalCapacity = 0;
  let fillRateSum = 0;
  let fillRateCount = 0;
  let onlineEntries = 0;
  let walkInEntries = 0;

  for (const order of orders) {
    if (!isActiveOrder(order)) continue;
    const quantity = Math.max(getOrderQuantity(order), 1);
    const source = String(order?.source || order?.entrySource || '').toLowerCase();
    if (source.includes('walk')) {
      walkInEntries += quantity;
    }
  }

  for (const scan of ticketScans) {
    totalScans += 1;
    successfulScans += 1;
    const isWalk =
      String(scan.source || '')
        .toLowerCase()
        .includes('walk') ||
      String(scan.entryType || '')
        .toLowerCase()
        .includes('walk');
    if (isWalk) {
      walkInEntries += 1;
    } else {
      onlineEntries += 1;
    }
    const scanDate = scan.scannedAt ? new Date(scan.scannedAt) : null;
    if (scanDate && !Number.isNaN(scanDate.getTime())) {
      const hour = scanDate.getHours();
      hourlyCounts[hour].count += 1;
      hourlyCounts[hour].scans += 1;
    }
  }

  for (const entry of guestLists) {
    if (!entry?.checkedIn) continue;
    totalScans += 1;
    successfulScans += 1;
    onlineEntries += 1;
    const date = getGuestListDate(entry);
    if (date) {
      const hour = date.getHours();
      hourlyCounts[hour].count += 1;
      hourlyCounts[hour].scans += 1;
    }
  }

  for (const event of events) {
    totalCapacity += event.capacity;
    const fillRate = event.capacity > 0 ? (event.checkIns / event.capacity) * 100 : 0;
    if (event.capacity > 0) {
      fillRateSum += fillRate;
      fillRateCount += 1;
    }

    if (event.date) {
      capacityTimeline.push({
        date: event.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        fillRate: Math.round(fillRate),
      });

      const day = event.date.toLocaleDateString('en-IN', { weekday: 'short' });
      if (!byDay.has(day)) byDay.set(day, { day, totalFill: 0, events: 0 });
      const bucket = byDay.get(day);
      bucket.totalFill += fillRate;
      bucket.events += 1;
    }
  }

  const peak = hourlyCounts.reduce(
    (best, current, index) => (current.count > best.count ? { count: current.count, index } : best),
    { count: 0, index: null },
  );

  return {
    avgFillRate: fillRateCount > 0 ? fillRateSum / fillRateCount : 0,
    totalScans,
    successfulScans,
    rejectedScans: 0,
    duplicateScans: 0,
    peakEntryHour: peak.index,
    peakEntryVelocity: peak.count,
    peakHour: peak.index == null ? null : formatHour(peak.index),
    capacityUtilisation:
      totalCapacity > 0
        ? (events.reduce((sum, event) => sum + event.checkIns, 0) / totalCapacity) * 100
        : 0,
    capacityUtilization:
      totalCapacity > 0
        ? (events.reduce((sum, event) => sum + event.checkIns, 0) / totalCapacity) * 100
        : 0,
    dayOfWeekBreakdown: Array.from(byDay.values()).map((row) => ({
      day: row.day,
      avgFill: row.events > 0 ? Math.round(row.totalFill / row.events) : 0,
      events: row.events,
    })),
    scanVelocity: hourlyCounts.map((row) => ({ hour: row.hour, scans: row.scans })),
    entryCurve: hourlyCounts.map((row) => ({ hour: row.hour, count: row.count })),
    capacityTimeline,
    channelSplit: {
      online: onlineEntries,
      walkIn: walkInEntries,
    },
    dataReady: totalScans > 0 || fillRateCount > 0,
  };
}

function aggregateVenuePartners(events, orders) {
  const hosts = new Map();
  const promoters = new Map();

  for (const event of events) {
    const hostId = event.hostId || 'unknown-host';
    const hostName = event.hostName || 'Unknown Host';
    if (!hosts.has(hostId)) {
      hosts.set(hostId, {
        hostId,
        hostName,
        events: 0,
        revenue: 0,
        tickets: 0,
        checkins: 0,
        capacity: 0,
      });
    }
    const row = hosts.get(hostId);
    row.events += 1;
    row.revenue += event.revenue;
    row.tickets += event.tickets;
    row.checkins += event.checkIns;
    row.capacity += event.capacity;
  }

  for (const order of orders) {
    if (!isActiveOrder(order)) continue;
    const promoterId = String(order?.promoterId || order?.promoterCode || '');
    if (!promoterId) continue;
    const promoterName = getPartnerName(order, 'Unknown Promoter');
    if (!promoters.has(promoterId)) {
      promoters.set(promoterId, {
        promoterId,
        promoterName,
        sales: 0,
        revenue: 0,
        clicks: 0,
      });
    }
    const row = promoters.get(promoterId);
    row.sales += getOrderQuantity(order);
    row.revenue += getOrderAmount(order);
  }

  const hostRows = Array.from(hosts.values())
    .map((row) => ({
      ...row,
      fillRate: row.capacity > 0 ? (row.checkins / row.capacity) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const promoterRows = Array.from(promoters.values()).sort((a, b) => b.revenue - a.revenue);

  return {
    hosts: hostRows,
    promoters: promoterRows,
    topPartners: hostRows.slice(0, 5),
    dataReady: hostRows.length > 0 || promoterRows.length > 0,
  };
}

function aggregateHostPartners(events, orders) {
  const venues = new Map();
  const promoters = new Map();

  for (const event of events) {
    const venueId = event.venueId || 'unknown-venue';
    const venueName = event.venueName || 'Unknown Venue';
    if (!venues.has(venueId)) {
      venues.set(venueId, {
        partnerId: venueId,
        partnerName: venueName,
        events: 0,
        revenue: 0,
        tickets: 0,
        checkins: 0,
        capacity: 0,
      });
    }
    const row = venues.get(venueId);
    row.events += 1;
    row.revenue += event.revenue;
    row.tickets += event.tickets;
    row.checkins += event.checkIns;
    row.capacity += event.capacity;
  }

  for (const order of orders) {
    if (!isActiveOrder(order)) continue;
    const promoterId = String(order?.promoterId || order?.promoterCode || '');
    if (!promoterId) continue;
    const promoterName = getPartnerName(order, 'Unknown Promoter');
    if (!promoters.has(promoterId)) {
      promoters.set(promoterId, {
        promoterId,
        promoterName,
        sales: 0,
        revenue: 0,
      });
    }
    const row = promoters.get(promoterId);
    row.sales += getOrderQuantity(order);
    row.revenue += getOrderAmount(order);
  }

  const venueRows = Array.from(venues.values())
    .map((row) => ({
      ...row,
      fillRate: row.capacity > 0 ? (row.checkins / row.capacity) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    venues: venueRows,
    promoters: Array.from(promoters.values()).sort((a, b) => b.revenue - a.revenue),
    topPartners: venueRows.slice(0, 5),
    dataReady: venueRows.length > 0,
  };
}

function buildRecommendations(role, overview, audience, ops, partners) {
  if (!overview.dataReady) return [];

  const recommendations = [];

  if ((ops.avgFillRate || 0) < 60) {
    recommendations.push({
      impact: 'high',
      title: role === 'venue' ? 'Raise fill rate on weaker nights' : 'Tighten venue selection',
      desc: 'Recent events are leaving too much capacity empty. Concentrate future events into proven nights and lower-volume rooms.',
    });
  }

  if ((audience.repeatGuestPct || 0) < 25) {
    recommendations.push({
      impact: 'medium',
      title: 'Invest in repeat guest retention',
      desc: 'Most of your audience is first-time. Follow up with previous buyers and offer early access to lift repeat attendance.',
    });
  }

  const leadPartner = (role === 'venue' ? partners.hosts : partners.venues)?.[0];
  if (leadPartner?.revenue > 0) {
    recommendations.push({
      impact: 'medium',
      title:
        role === 'venue'
          ? `Double down on ${leadPartner.hostName}`
          : `Expand ${leadPartner.partnerName}`,
      desc: 'Your strongest partner is materially ahead of the rest. Use them as the benchmark for future programming and partnerships.',
    });
  }

  if ((overview.totalCheckIns || 0) < (overview.totalTicketsSold || 0) * 0.75) {
    recommendations.push({
      impact: 'medium',
      title: 'Reduce drop-off between purchase and arrival',
      desc: 'Check-ins are trailing ticket sales. Add day-of reminders, clearer entry instructions, and arrival-time nudges.',
    });
  }

  return recommendations.slice(0, 4);
}

function buildTopEvents(events) {
  return [...events]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date
        ? event.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : '—',
      venue: event.venueName || '—',
      revenue: event.revenue,
      issued: event.tickets,
      tickets: event.tickets,
      checkIns: event.checkIns,
      checkins: event.checkIns,
      capacity: event.capacity,
      occupancy: event.capacity > 0 ? (event.checkIns / event.capacity) * 100 : 0,
      sellThrough: event.capacity > 0 ? (event.tickets / event.capacity) * 100 : 0,
      avgTicketPrice: event.tickets > 0 ? event.revenue / event.tickets : 0,
    }));
}

async function buildOverviewPayload(role, events, orders, guestLists, range, db, ticketScans = []) {
  const topEvents = buildTopEvents(events);
  const eventRevenue = events.reduce((sum, event) => sum + event.revenue, 0);
  const eventTickets = events.reduce((sum, event) => sum + event.tickets, 0);
  const eventCheckIns = events.reduce((sum, event) => sum + event.checkIns, 0);
  const totalCapacity = events.reduce((sum, event) => sum + event.capacity, 0);
  const totalGuestlistSignups = events.reduce(
    (sum, event) => sum + (event.guestlistSignups || 0),
    0,
  );

  let orderRevenue = 0;
  let orderTickets = 0;
  let grossAmt = 0;
  let refundAmt = 0;
  for (const order of orders) {
    const amount = getOrderAmount(order);
    const status = String(order?.status || '')
      .trim()
      .toLowerCase();
    if (status === 'refunded') {
      refundAmt += amount;
      grossAmt += amount;
    } else if (isActiveOrder(order)) {
      grossAmt += amount;
      orderRevenue += amount;
      orderTickets += getOrderQuantity(order);
    }
  }
  const orderCheckIns = ticketScans.length;
  const refundRate = grossAmt > 0 ? (refundAmt / grossAmt) * 100 : 0;

  const guestlistCheckIns = guestLists.reduce((sum, entry) => sum + (entry?.checkedIn ? 1 : 0), 0);
  const totalRevenue = eventRevenue || orderRevenue;
  const totalTicketsSold = eventTickets || orderTickets;
  const totalCheckIns = eventCheckIns || orderCheckIns + guestlistCheckIns;
  const avgTicketPrice = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;
  const occupancyRate = totalCapacity > 0 ? (totalCheckIns / totalCapacity) * 100 : 0;
  const sellThroughRate = totalCapacity > 0 ? (totalTicketsSold / totalCapacity) * 100 : 0;
  const noShowRate =
    totalTicketsSold > 0
      ? (Math.max(totalTicketsSold - orderCheckIns, 0) / totalTicketsSold) * 100
      : 0;
  const audience = await aggregateAudience(db, orders, guestLists);
  const ops = aggregateOps(events, orders, guestLists, ticketScans);
  const partners =
    role === 'venue'
      ? aggregateVenuePartners(events, orders)
      : aggregateHostPartners(events, orders);
  const recommendations = buildRecommendations(
    role,
    {
      totalRevenue,
      totalTicketsSold,
      totalCheckIns,
      dataReady: totalRevenue > 0 || totalTicketsSold > 0 || totalCheckIns > 0,
    },
    audience,
    ops,
    partners,
  );
  const dailySeries = buildDailySeries(events, range);

  return {
    totalRevenue,
    totalNetPayable: totalRevenue,
    totalTicketsSold,
    ticketsSold: totalTicketsSold,
    totalCheckIns,
    checkins: totalCheckIns,
    totalEvents: events.length,
    guestlistSignups: totalGuestlistSignups,
    occupancyRate,
    sellThroughRate,
    avgTicketPrice,
    refundRate,
    noShowRate,
    repeatGuestRate: audience.repeatGuestPct,
    firstTimeGuestRate:
      audience.totalGuests > 0 ? (audience.newGuests / audience.totalGuests) * 100 : 0,
    totalUniqueGuests: audience.totalUniqueGuests,
    newGuests: audience.newGuests,
    repeatGuests: audience.repeatGuests,
    genderRatio: audience.genderRatio,
    ageBands: audience.ageBands,
    entryCurve: ops.entryCurve,
    totalScans: ops.totalScans,
    successfulScans: ops.successfulScans,
    rejectedScans: ops.rejectedScans,
    duplicateScans: ops.duplicateScans,
    peakEntryHour: ops.peakEntryHour,
    peakEntryVelocity: ops.peakEntryVelocity,
    capacityUtilization: ops.capacityUtilization,
    topEvents,
    revenueTimeline: dailySeries,
    ticketsTimeline: dailySeries.map((row) => ({ date: row.date, tickets: row.tickets })),
    funnel: buildFunnel(orders, guestLists, { totalTicketsSold, totalCheckIns }),
    recommendations,
    predictions: recommendations.map((recommendation, index) => ({
      id: `rec-${index + 1}`,
      type: 'recommendation',
      title: recommendation.title,
      body: recommendation.desc,
      confidence: 'medium',
      impact: recommendation.impact === 'high' ? 'high' : 'medium',
    })),
    promoters: (partners.promoters || []).map((promoter) => ({
      id: promoter.promoterId,
      name: promoter.promoterName,
      totalSales: promoter.sales,
      assignedEvents: 0,
      reliabilityScore: 50,
      crowdQualityScore: 50,
      revenueQualityScore: 50,
      compositeScore: 50,
    })),
    dataReady: totalRevenue > 0 || totalTicketsSold > 0 || totalCheckIns > 0,
  };
}

async function buildVenueAnalyticsBundle(venueId, range = '30d') {
  const db = getAdminDb();
  const baseEvents = await getVenueEvents(db, venueId, range);
  const eventIds = baseEvents.map((event) => event.id);
  const orders = await getOrdersForEventIds(db, eventIds);
  const guestLists = await getGuestListsForEventIds(db, eventIds);
  const ticketScans = await getTicketScansForEventIds(db, eventIds);
  const events = enrichEventsWithBackendData(baseEvents, orders, guestLists, ticketScans);
  const audience = await aggregateAudience(db, orders, guestLists);
  const overview = await buildOverviewPayload(
    'venue',
    events,
    orders,
    guestLists,
    range,
    db,
    ticketScans,
  );
  const ops = aggregateOps(events, orders, guestLists, ticketScans);
  const partners = aggregateVenuePartners(events, orders);
  return {
    overview,
    audience,
    ops,
    partners,
    strategy: {
      recommendations: buildRecommendations('venue', overview, audience, ops, partners),
      dataReady: events.length > 0,
    },
  };
}

async function buildHostAnalyticsBundle(hostId, range = '30d') {
  const db = getAdminDb();
  const baseEvents = await getHostEvents(db, hostId, range);
  const eventIds = baseEvents.map((event) => event.id);
  const orders = await getOrdersForEventIds(db, eventIds);
  const guestLists = await getGuestListsForEventIds(db, eventIds);
  const ticketScans = await getTicketScansForEventIds(db, eventIds);
  const events = enrichEventsWithBackendData(baseEvents, orders, guestLists, ticketScans);
  const audience = await aggregateAudience(db, orders, guestLists);
  const overview = await buildOverviewPayload(
    'host',
    events,
    orders,
    guestLists,
    range,
    db,
    ticketScans,
  );
  const ops = aggregateOps(events, orders, guestLists, ticketScans);
  const partners = aggregateHostPartners(events, orders);
  const recommendations = buildRecommendations('host', overview, audience, ops, partners);

  const totalEvents = events.length;
  const approvedEvents = events.filter((event) =>
    ['approved', 'live', 'scheduled', 'completed'].includes(event.lifecycle),
  ).length;
  const deniedEvents = events.filter((event) => event.lifecycle === 'denied').length;
  const cancelledEvents = events.filter((event) => event.lifecycle === 'cancelled').length;

  return {
    overview: {
      ...overview,
      total: totalEvents,
      approved: approvedEvents,
      denied: deniedEvents,
      cancelled: cancelledEvents,
      approvalRate:
        approvedEvents + deniedEvents > 0
          ? (approvedEvents / (approvedEvents + deniedEvents)) * 100
          : 0,
      dataReady: overview.dataReady || totalEvents > 0,
    },
    audience,
    ops,
    partners,
    reliability: {
      reliabilityScore:
        totalEvents > 0
          ? Math.max(0, Math.min(100, 100 - (cancelledEvents / totalEvents) * 100))
          : 0,
      cancelledEvents,
      approvedEvents,
      totalEvents,
      dataReady: totalEvents > 0,
    },
    strategy: {
      recommendations,
      dataReady: recommendations.length > 0,
    },
  };
}

/**
 * Venue overview analytics.
 */
export async function getVenueAnalytics(venueId, range = '30d') {
  const bundle = await buildVenueAnalyticsBundle(venueId, range);
  return bundle.overview;
}

export async function getVenueOverviewStats(venueId) {
  const overview = await getVenueAnalytics(venueId, '30d');
  return {
    weekendRevenue: overview.totalRevenue,
    activeEventsCount: overview.totalEvents,
    dataReady: overview.dataReady,
  };
}

/**
 * Host overview analytics.
 */
export async function getHostAnalytics(hostId, range = '30d') {
  const bundle = await buildHostAnalyticsBundle(hostId, range);
  return bundle.overview;
}

export async function getHostPerformanceAnalytics(hostId, _token) {
  const bundle = await buildHostAnalyticsBundle(hostId, '30d');
  return bundle.overview;
}

export async function getHostAudienceAnalytics(hostId, _token) {
  const bundle = await buildHostAnalyticsBundle(hostId, '30d');
  return bundle.audience;
}

export async function getPromoterTrustAnalytics(promoterId, token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics('promoter', promoterId, 'trust');
  } catch (error) {
    console.error('[AnalyticsStore] getPromoterTrustAnalytics failed:', error.message);
    return { trustScore: 0, dataReady: false };
  }
}

export async function getVenueStrategyAnalytics(venueId) {
  const bundle = await buildVenueAnalyticsBundle(venueId, '30d');
  return bundle.strategy;
}

export async function getVenueAudienceAnalytics(venueId, range = '30d') {
  const bundle = await buildVenueAnalyticsBundle(venueId, range);
  return bundle.audience;
}

export async function getVenueFunnelAnalytics(venueId, range = '30d') {
  const overview = await getVenueAnalytics(venueId, range);
  return {
    funnel: overview.funnel,
    totalRevenue: overview.totalRevenue,
    totalTicketsSold: overview.totalTicketsSold,
    totalCheckIns: overview.totalCheckIns,
    dataReady: overview.dataReady,
  };
}

export async function getVenueOpsAnalytics(venueId, range = '30d') {
  const bundle = await buildVenueAnalyticsBundle(venueId, range);
  return bundle.ops;
}

export async function getVenuePartnerAnalytics(venueId, range = '30d') {
  const bundle = await buildVenueAnalyticsBundle(venueId, range);
  return bundle.partners;
}

export async function getEventTimeline(eventId, token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics('event', eventId, 'timeline');
  } catch (error) {
    console.error('[AnalyticsStore] getEventTimeline failed:', error.message);
    return { events: [], dataReady: false };
  }
}

export async function getEventStudioInsights(eventId, token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics('event', eventId, 'studio-insights');
  } catch (error) {
    console.error('[AnalyticsStore] getEventStudioInsights failed:', error.message);
    return { suggestions: [], dataReady: false };
  }
}

export async function getPromoterAnalytics(promoterId, range = '30d', token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics('promoter', promoterId, range);
  } catch (error) {
    console.error('[AnalyticsStore] getPromoterAnalytics failed:', error.message);
    return { totalConversions: 0, trustScore: 0, dataReady: false };
  }
}

export async function getPromoterEventPerformance(promoterId, range = '30d', token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics('promoter', promoterId, 'event-performance');
  } catch (error) {
    console.error('[AnalyticsStore] getPromoterEventPerformance failed:', error.message);
    return { topEvents: [], dataReady: false };
  }
}

export async function getPromoterAudienceAnalytics(promoterId, range = '30d', token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics('promoter_audience', promoterId, range);
  } catch (error) {
    console.error('[AnalyticsStore] getPromoterAudienceAnalytics failed:', error.message);
    return { locations: [], demographics: {} };
  }
}

export async function getPromoterFunnelAnalytics(promoterId, range = '30d', token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics('promoter_funnel', promoterId, range);
  } catch (error) {
    console.error('[AnalyticsStore] getPromoterFunnelAnalytics failed:', error.message);
    return { views: 0, clicks: 0, conversions: 0 };
  }
}

export async function getPromoterStrategyAnalytics(promoterId, range = '30d', token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics('promoter_strategy', promoterId, range);
  } catch (error) {
    console.error('[AnalyticsStore] getPromoterStrategyAnalytics failed:', error.message);
    return { topEvents: [], conversionEfficiency: 0 };
  }
}

export async function getHostReliabilityAnalytics(hostId) {
  const bundle = await buildHostAnalyticsBundle(hostId, '30d');
  return bundle.reliability;
}

export async function getHostPartnerAnalytics(hostId, range = '30d') {
  const bundle = await buildHostAnalyticsBundle(hostId, range);
  return bundle.partners;
}

export async function getHostStrategyAnalytics(hostId) {
  const bundle = await buildHostAnalyticsBundle(hostId, '30d');
  return bundle.strategy;
}

export async function getHostOverviewStats(hostId) {
  const overview = await getHostAnalytics(hostId, '30d');
  return {
    totalPayouts: overview.totalRevenue,
    activeEvents: overview.totalEvents,
    dataReady: overview.dataReady,
  };
}

export async function getVenueRevenueAnalytics(venueId, range = '30d') {
  return getVenueAnalytics(venueId, range);
}

export default {
  getVenueAnalytics,
  getVenueOverviewStats,
  getVenueRevenueAnalytics,
  getVenueAudienceAnalytics,
  getVenueFunnelAnalytics,
  getVenueOpsAnalytics,
  getVenuePartnerAnalytics,
  getVenueStrategyAnalytics,
  getEventTimeline,
  getEventStudioInsights,
  getHostAnalytics,
  getHostPerformanceAnalytics,
  getHostAudienceAnalytics,
  getHostReliabilityAnalytics,
  getHostPartnerAnalytics,
  getHostStrategyAnalytics,
  getHostOverviewStats,
  getPromoterTrustAnalytics,
  getPromoterAnalytics,
  getPromoterEventPerformance,
  getPromoterAudienceAnalytics,
  getPromoterFunnelAnalytics,
  getPromoterStrategyAnalytics,
};
