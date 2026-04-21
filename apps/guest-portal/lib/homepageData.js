import { cache } from "react";
import { getAdminDb, isFirebaseConfigured } from "./firebase/admin";
import { formatEventTime, getEventHref } from "./eventCardUtils";
import { fetchFeaturedEvents, fetchPublicEvents } from "./server/publicDiscoveryBridge.js";

export const heroVideoSrc = "/background-video.mp4";

const SELECTS_COLLECTION = "homepage_selects";
const INTERVIEWS_COLLECTION = "homepage_interviews";
const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY || "Pune";
const FALLBACK_CATEGORIES = [
  "Parties",
  "Fitness",
  "Art",
  "Fashion",
  "Tech",
  "Popups",
  "Campus",
  "Afters",
  "Community",
  "Culinary",
  "Health & Wellness",
  "Music",
  "Events",
  "Connections"
];

const toPlainDocument = (doc) => ({
  id: doc.id,
  ...doc.data()
});

const loadCollection = async (collectionName) => {
  if (!isFirebaseConfigured()) {
    return [];
  }
  const db = getAdminDb();
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return [];
  return snapshot.docs.map(toPlainDocument);
};

const mapHeroCards = (events) =>
  events.map((event) => ({
    id: event.id,
    title: event.title,
    location: event.location,
    venue: event.venue || event.location || event.city,
    time: formatEventTime(event),
    image: event.image,
    description: event.description || event.shortDescription || event.about,
    guests: event.guests || [],
    href: getEventHref(event)
  }));

const mapEventGrid = (events) => events.slice(0, 8);

const getCategoryFilters = (events = []) => {
  const unique = Array.from(
    new Set(
      events
        .map((event) => event.category)
        .filter(Boolean)
        .map((category) => category.trim())
    )
  );

  if (unique.length) return unique;
  return [...FALLBACK_CATEGORIES];
};

const buildStats = (events, city) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthEvents = events.filter((event) => {
    if (!event.startDate) return false;
    const date = new Date(event.startDate);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const weeklyRegistrations = events.reduce((count, event) => {
    const updatedAt = event.updatedAt ? new Date(event.updatedAt) : now;
    if (updatedAt < sevenDaysAgo) return count;
    const stats = event.stats || {};
    if (typeof stats.rsvps === "number") return count + stats.rsvps;
    if (Array.isArray(event.guests)) return count + event.guests.length;
    return count;
  }, 0);

  return {
    eventsThisMonth: monthEvents.length,
    weeklyRegistrations,
    city
  };
};

const getCity = (city) => city || DEFAULT_CITY;

export const getHomepageContent = cache(async (city) => {
  const selectedCity = getCity(city);
  const [featuredEvents, events, selects, interviews] = await Promise.all([
    fetchFeaturedEvents({ limit: 6, city: selectedCity }, { cache: "force-cache" }).then((result) => result?.items || []),
    fetchPublicEvents({ city: selectedCity, limit: 30, sort: "heat" }, { cache: "force-cache" }).then((result) => result?.items || []),
    loadCollection(SELECTS_COLLECTION),
    loadCollection(INTERVIEWS_COLLECTION),
  ]);
  const heroCards = mapHeroCards(featuredEvents);
  const eventGrid = mapEventGrid(events);
  const categories = getCategoryFilters(events);
  const stats = buildStats(events, selectedCity);

  return {
    heroCards,
    eventGrid,
    categoryFilters: categories,
    selects,
    interviews,
    stats
  };
});
