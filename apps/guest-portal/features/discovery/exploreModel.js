export const SEED_TTL_MS = 5 * 60 * 1000;

export const sortTabs = ['Trending', 'This Week', 'New', 'Soonest', 'Price Low to High'];

export const dateFilters = [
  { label: 'Any date', value: 'any' },
  { label: 'Today', value: 'today' },
  { label: 'This weekend', value: 'weekend' },
  { label: 'Custom', value: 'custom' },
];

export const priceFilters = [
  { label: 'All prices', value: 'all' },
  { label: 'Free RSVP', value: 'free' },
  { label: 'Paid', value: 'paid' },
];

export const curatedCategoryOptions = [
  { label: 'All vibes', value: 'all', description: 'Show everything' },
  { label: 'Campus', value: 'campus', description: 'College quads & fresher nights' },
  { label: 'Party', value: 'party', description: 'Venues, edits, blowouts' },
  { label: 'Afters', value: 'afters', description: 'Late nights & underground' },
  { label: 'Brunch', value: 'brunch', description: 'Day parties, sun-kissed' },
  { label: 'Art', value: 'art', description: 'Galleries & pop-up shows' },
  { label: 'Community', value: 'community', description: 'Markets & meet-ups' },
];

export const curatedCategoryMatchers = {
  campus: ['campus', 'college', 'university', 'freshers'],
  party: ['party', 'venue', 'night', 'dj', 'dance'],
  afters: ['after', 'afterhours', 'late', 'underground'],
  brunch: ['brunch', 'day party', 'sunrise', 'cookout'],
  art: ['art', 'gallery', 'exhibit', 'creative', 'design'],
  community: ['community', 'market', 'meetup', 'collective', 'venue'],
};

export const pageSize = 12;

export const slugify = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');

export const formatTypeLabel = (value = '') =>
  value
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

export const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const toEventEndDate = (value) => {
  if (!value) return null;
  const normalized =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T23:59:59.999Z`
      : value;
  return toDate(normalized);
};

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const getStartingPrice = (event) => {
  if (typeof event.startingPrice === 'number') return event.startingPrice;
  if (typeof event.priceMin === 'number') return event.priceMin;
  if (typeof event.priceRange?.min === 'number') return event.priceRange.min;
  if (typeof event.price === 'number') return event.price;
  return 0;
};

export const getEventTime = (event) => {
  const date = toDate(event.startDateTime || event.startDate);
  if (date) return date.getTime();
  return Number.MAX_SAFE_INTEGER;
};

export const sortComparators = {
  Trending: (a, b) =>
    (b.heatScore ?? b.stats?.heatScore ?? 0) - (a.heatScore ?? a.stats?.heatScore ?? 0),
  'This Week': (a, b) => {
    const now = Date.now();
    const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
    const timeA = getEventTime(a);
    const timeB = getEventTime(b);
    const aInWeek = timeA >= now && timeA <= weekAhead;
    const bInWeek = timeB >= now && timeB <= weekAhead;
    if (aInWeek && !bInWeek) return -1;
    if (!aInWeek && bInWeek) return 1;
    return timeA - timeB;
  },
  New: (a, b) =>
    new Date(b.createdAt || b.stats?.createdAt || 0) -
    new Date(a.createdAt || a.stats?.createdAt || 0),
  Soonest: (a, b) => getEventTime(a) - getEventTime(b),
  'Price Low to High': (a, b) => getStartingPrice(a) - getStartingPrice(b),
};
