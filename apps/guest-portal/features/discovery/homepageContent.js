import { formatEventTime, getEventHref } from '../../lib/eventCardUtils';

export const heroVideoSrc = '/background-video.mp4';

const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Pune';
const FALLBACK_CATEGORIES = [
  'Parties',
  'Fitness',
  'Art',
  'Fashion',
  'Tech',
  'Popups',
  'Campus',
  'Afters',
  'Community',
  'Culinary',
  'Health & Wellness',
  'Music',
  'Events',
  'Connections',
];

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
    href: getEventHref(event),
  }));

const mapEventGrid = (events) => events.slice(0, 8);

const getCategoryFilters = (events = []) => {
  const unique = Array.from(
    new Set(
      events
        .map((event) => event.category)
        .filter(Boolean)
        .map((category) => category.trim()),
    ),
  );

  return unique.length ? unique : [...FALLBACK_CATEGORIES];
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
    if (typeof stats.rsvps === 'number') return count + stats.rsvps;
    if (Array.isArray(event.guests)) return count + event.guests.length;
    return count;
  }, 0);
  return { eventsThisMonth: monthEvents.length, weeklyRegistrations, city };
};

export function getHomepageCity(city) {
  return city || DEFAULT_CITY;
}

export function buildHomepageContent({
  featuredEvents = [],
  events = [],
  selects = [],
  interviews = [],
  city,
} = {}) {
  const selectedCity = getHomepageCity(city);

  return {
    heroCards: mapHeroCards(featuredEvents),
    eventGrid: mapEventGrid(events),
    categoryFilters: getCategoryFilters(events),
    selects,
    interviews,
    stats: buildStats(events, selectedCity),
  };
}
