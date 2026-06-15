/**
 * THE C1RCLE - Master CMS Engine
 * Centralizes content management for Venues (Highlights, Gallery, Menu, Facilities).
 */

import { randomUUID } from 'node:crypto';

// Collection Mapping
export const CMS_COLLECTIONS = {
  HIGHLIGHTS: 'profile_highlights',
  GALLERY: 'venue_gallery',
  MENU: 'venue_menu',
  FACILITIES: 'venue_facilities',
  VENUES: 'venues',
};

// Default facilities list
export const DEFAULT_FACILITIES = [
  { name: 'Parking', icon: 'car', isEnabled: false },
  { name: 'Valet', icon: 'key', isEnabled: false },
  { name: 'Rooftop', icon: 'sun', isEnabled: false },
  { name: 'Smoking Area', icon: 'cigarette', isEnabled: false },
  { name: 'Dance Floor', icon: 'music', isEnabled: false },
  { name: 'Bar', icon: 'wine', isEnabled: false },
  { name: 'Wheelchair Access', icon: 'accessibility', isEnabled: false },
  { name: 'VIP Area', icon: 'star', isEnabled: false },
  { name: 'Outdoor Seating', icon: 'tree', isEnabled: false },
  { name: 'Live Music', icon: 'mic', isEnabled: false },
];

/**
 * Sync Gallery photos to main Venue document for quick access.
 */
export async function syncGalleryToVenue(db, venueId) {
  const snap = await db
    .collection(CMS_COLLECTIONS.GALLERY)
    .where('venueId', '==', venueId)
    .orderBy('order', 'asc')
    .limit(9)
    .get();

  const photoUrls = snap.docs.map((doc) => doc.data().imageUrl).filter(Boolean);

  await db.collection(CMS_COLLECTIONS.VENUES).doc(venueId).update({
    photos: photoUrls,
    gallery: photoUrls,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Sync Menu images to main Venue document.
 */
export async function syncMenuToVenue(db, venueId) {
  const snap = await db
    .collection(CMS_COLLECTIONS.MENU)
    .where('venueId', '==', venueId)
    .orderBy('order', 'asc')
    .get();

  const urls = snap.docs.map((doc) => doc.data().imageUrl).filter(Boolean);

  await db.collection(CMS_COLLECTIONS.VENUES).doc(venueId).update({
    menuImages: urls,
    'menu.images': urls,
    updatedAt: new Date().toISOString(),
  });
}

// ─── Highlights ──────────────────────────────────────────────────

export async function createHighlight(db, venueId, data, actorId) {
  const id = randomUUID();
  const existingSnap = await db
    .collection(CMS_COLLECTIONS.HIGHLIGHTS)
    .where('profileId', '==', venueId)
    .orderBy('order', 'desc')
    .limit(1)
    .get();

  const maxOrder = existingSnap.empty ? 0 : existingSnap.docs[0].data().order || 0;

  const highlight = {
    id,
    profileId: venueId,
    profileType: 'venue',
    venueId,
    title: data.title || 'New Highlight',
    coverImage: data.images?.[0] || '',
    images: data.images || [],
    order: maxOrder + 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actorId,
  };

  await db.collection(CMS_COLLECTIONS.HIGHLIGHTS).doc(id).set(highlight);
  return highlight;
}

export async function updateHighlight(db, id, updates, actorId) {
  const allowed = ['title', 'coverImage', 'images', 'order', 'isActive'];
  const filtered = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  if (updates.images?.length > 0 && !updates.coverImage) {
    filtered.coverImage = updates.images[0];
  }

  filtered.updatedAt = new Date().toISOString();
  filtered.updatedBy = actorId;

  await db.collection(CMS_COLLECTIONS.HIGHLIGHTS).doc(id).update(filtered);
}

// ─── Gallery ─────────────────────────────────────────────────────

export async function addGalleryPhoto(db, venueId, imageUrl, caption = '') {
  const existingSnap = await db
    .collection(CMS_COLLECTIONS.GALLERY)
    .where('venueId', '==', venueId)
    .get();

  if (existingSnap.size >= 9) throw new Error('Maximum 9 photos in gallery');

  const id = randomUUID();
  const photo = {
    id,
    venueId,
    imageUrl,
    caption,
    order: existingSnap.size + 1,
    createdAt: new Date().toISOString(),
  };

  await db.collection(CMS_COLLECTIONS.GALLERY).doc(id).set(photo);
  await syncGalleryToVenue(db, venueId);
  return photo;
}

// ─── Facilities ──────────────────────────────────────────────────

export async function initializeVenueFacilities(db, venueId) {
  const batch = db.batch();
  const facilities = DEFAULT_FACILITIES.map((f, i) => ({
    id: randomUUID(),
    venueId,
    ...f,
    order: i,
    createdAt: new Date().toISOString(),
  }));

  facilities.forEach((f) => {
    batch.set(db.collection(CMS_COLLECTIONS.FACILITIES).doc(f.id), f);
  });

  await batch.commit();
  return facilities;
}

export default {
  CMS_COLLECTIONS,
  DEFAULT_FACILITIES,
  syncGalleryToVenue,
  syncMenuToVenue,
  createHighlight,
  updateHighlight,
  addGalleryPhoto,
  initializeVenueFacilities,
};
