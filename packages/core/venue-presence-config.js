import { z } from 'zod';

export const VenuePresenceConfigSchema = z
  .object({
    name: z.string().max(120),
    description: z.string().max(2000),
    price: z.string().max(80),
    images: z.array(z.string().url()).max(12),
    bookingConfig: z
      .object({
        enabled: z.boolean(),
        capacity: z.number().int().min(0).max(100000),
        timings: z.array(z.string().max(100)).max(50),
        contact: z.string().max(120),
      })
      .strict(),
  })
  .strict();

export const DEFAULT_VENUE_PRESENCE_CONFIG = Object.freeze({
  name: '',
  description: '',
  price: '',
  images: [],
  bookingConfig: {
    enabled: false,
    capacity: 100,
    timings: [],
    contact: '',
  },
});

function mergePresenceConfig(value = {}) {
  return {
    ...DEFAULT_VENUE_PRESENCE_CONFIG,
    ...value,
    bookingConfig: {
      ...DEFAULT_VENUE_PRESENCE_CONFIG.bookingConfig,
      ...(value.bookingConfig || {}),
    },
  };
}

export async function getVenuePresenceConfig(db, venueId) {
  const [pageDoc, venueDoc] = await Promise.all([
    db.collection('venue_pages').doc(venueId).get(),
    db.collection('venues').doc(venueId).get(),
  ]);
  const pageData = pageDoc.exists ? pageDoc.data() || {} : {};
  const venueData = venueDoc.exists ? venueDoc.data() || {} : {};
  return mergePresenceConfig(pageData.presenceConfig || venueData.presenceConfig || {});
}

export async function saveVenuePresenceConfig(db, venueId, input) {
  const presenceConfig = VenuePresenceConfigSchema.parse(input);
  const updatedAt = new Date().toISOString();
  await Promise.all([
    db
      .collection('venue_pages')
      .doc(venueId)
      .set({ venueId, presenceConfig, updatedAt }, { merge: true }),
    db.collection('venues').doc(venueId).set({ presenceConfig, updatedAt }, { merge: true }),
  ]);
  return presenceConfig;
}
