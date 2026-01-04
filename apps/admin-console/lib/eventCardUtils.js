const fallbackGuests = ["Anaya", "Rohit", "Mira", "Neel"];

const normalizeGuestName = (guest) => {
  if (!guest) return null;
  if (typeof guest === "string") return guest;
  if (guest.name) return guest.name;
  if (guest.handle) return guest.handle;
  return null;
};

export const getGuestList = (event = {}, limit = 4) => {
  const guests = Array.isArray(event.guests) ? event.guests.map(normalizeGuestName).filter(Boolean) : [];
  const source = guests.length ? guests : fallbackGuests;
  return source.slice(0, limit);
};

export const getGuestInitials = (guest) => {
  if (!guest) return "GL";
  const clean = guest.trim();
  if (!clean) return "GL";
  const parts = clean.split(/\s+/);
  const letters = [parts[0]?.[0], parts[1]?.[0]].filter(Boolean).join("");
  return letters ? letters.toUpperCase() : clean.slice(0, 2).toUpperCase();
};

export const formatEventTime = (event = {}) => {
  if (event.time) return event.time;
  const start = event.startTime || event.startDateTime;
  if (!start) return "";
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(parsed);
  } catch (error) {
    return "";
  }
};

export const getEventHref = (event = {}) => {
  if (event.slug) return `/event/${event.slug}`;
  if (event.id) return `/event/${event.id}`;
  if (event.handle) return `/event/${event.handle}`;
  return "/event";
};
