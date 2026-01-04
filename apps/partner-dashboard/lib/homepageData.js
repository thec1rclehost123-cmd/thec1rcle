import { cache } from "react";
import { getAdminDb, isFirebaseConfigured } from "./firebase/admin";
import { DEFAULT_CITY, getCategoryFilters, listEvents } from "./server/eventStore";
import { formatEventTime, getEventHref } from "./eventCardUtils";

export const heroVideoSrc = "/background-video.mp4";

const SELECTS_COLLECTION = "homepage_selects";
const INTERVIEWS_COLLECTION = "homepage_interviews";

const selectsSeed = [
  {
    title: "2025 Activities",
    description: "Curation of immersive outdoor + culture drops.",
    cta: "View Selects",
    image: "/events/select-activities.svg",
    href: "/explore?category=activities",
    slug: "2025-activities"
  },
  {
    title: "2025 Art Circuits",
    description: "Intimate showcases for the indie art scene.",
    cta: "View Selects",
    image: "/events/select-art.svg",
    href: "/explore?category=art",
    slug: "2025-art-circuits"
  }
];

const interviewsSeed = [
  {
    slug: "pune-street-crew",
    title: "Interview: Pune Street Crew",
    excerpt: "How Pune's late-night collectives are shaping a new sonic identity across KP and Kalyani Nagar.",
    image: "/events/interview-crew.svg"
  },
  {
    slug: "underground-fashion-labs",
    title: "Interview: Underground Fashion Labs",
    excerpt: "Inside the ateliers building the next wave of South Asian couture pop-ups.",
    image: "/events/interview-fashion.svg"
  }
];

const slugify = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

const toPlainDocument = (doc) => ({
  id: doc.id,
  ...doc.data()
});

const loadCollectionWithSeed = async (collectionName, seed) => {
  if (!isFirebaseConfigured()) {
    return seed;
  }
  const db = getAdminDb();
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty && seed?.length) {
    const batch = db.batch();
    seed.forEach((item) => {
      const docId = item.slug || slugify(item.title);
      batch.set(db.collection(collectionName).doc(docId), {
        ...item,
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
    return seed;
  }
  return snapshot.docs.map(toPlainDocument);
};

const mapHeroCards = (events) =>
  events.slice(0, 4).map((event) => ({
    id: event.id,
    title: event.title,
    location: event.location,
    venue: event.venue || event.location || event.city,
    time: formatEventTime(event),
    image: event.image,
    guests: event.guests || [],
    href: getEventHref(event)
  }));

const mapEventGrid = (events) => events.slice(0, 8);

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
  const events = await listEvents({ city: selectedCity, limit: 12, sort: "heat" });
  const heroCards = mapHeroCards(events);
  const eventGrid = mapEventGrid(events);
  const categories = getCategoryFilters(events);
  const selects = await loadCollectionWithSeed(SELECTS_COLLECTION, selectsSeed);
  const interviews = await loadCollectionWithSeed(INTERVIEWS_COLLECTION, interviewsSeed);
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
