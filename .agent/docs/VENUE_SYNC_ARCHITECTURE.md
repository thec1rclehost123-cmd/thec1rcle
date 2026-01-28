# Venue Data Synchronization - Architecture & Status

## Overview

This document outlines the data synchronization architecture between the three main platforms:
- **Partner Dashboard** (Admin/Management)
- **Guest Portal** (User Website)
- **Mobile App** (React Native)

All platforms read from and/or write to the shared **Firebase/Firestore** database.

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FIREBASE / FIRESTORE                               │
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐                 │
│  │    venues    │   │ profile_posts│   │profile_highlights│                │
│  │  collection  │   │  collection  │   │   collection    │                │
│  └──────────────┘   └──────────────┘   └─────────────────┘                 │
│          │                 │                    │                          │
└──────────┼─────────────────┼────────────────────┼──────────────────────────┘
           │                 │                    │
     ┌─────┴─────────────────┴────────────────────┴──────────┐
     │                  SHARED DATA LAYER                     │
     └──┬─────────────────────┬──────────────────────────┬───┘
        │                     │                          │
        ▼                     ▼                          ▼
┌───────────────┐    ┌───────────────────┐     ┌─────────────────┐
│   PARTNER     │    │   GUEST PORTAL    │     │   MOBILE APP    │
│   DASHBOARD   │    │   (User Website)  │     │   (React Native)│
└───────────────┘    └───────────────────┘     └─────────────────┘
   WRITES & READS       READS ONLY            READS + FOLLOW
   /api/profile         venueStore.js          venuesStore.ts
   profileStore.js      hostStore.js           profiles.ts (NEW)
```

---

## Collection Mappings

### 1. venues Collection
| Field | Partner Dashboard | Guest Portal | Mobile App |
|-------|-------------------|--------------|------------|
| `name` | ✅ updateProfile | ✅ getVenueBySlug | ✅ Venue interface |
| `slug` | ✅ updateProfile | ✅ fallback to ID | ✅ getVenue |
| `bio` | ✅ updateProfile | ✅ displayed | ✅ Venue.bio |
| `description` | ✅ updateProfile | ✅ displayed | ✅ Venue.description |
| `coverImage` | ✅ updateProfile | ✅ displayed | ✅ Venue.coverImage |
| `profileImage` | ✅ updateProfile | ✅ displayed | ✅ Venue.profileImage |
| `photos` | ✅ updateProfile | ✅ gallery | ✅ Venue.photos |
| `tags` | ✅ updateProfile | ✅ filtering | ✅ Venue.tags |
| `vibes` | ✅ updateProfile | ✅ filtering | ✅ Venue.vibes |
| `genres` | ✅ updateProfile | ✅ filtering | ✅ Venue.genres |
| `venueType` | ✅ updateProfile | ✅ displayed | ✅ Venue.venueType |
| `amenities` | ✅ updateProfile | ✅ displayed | ✅ Venue.amenities |
| `capacity` | ✅ updateProfile | ✅ displayed | ✅ Venue.capacity |
| `openingHours` | ✅ updateProfile | ✅ displayed | ✅ Venue.openingHours |
| `socialLinks` | ✅ updateProfile | ✅ displayed | ✅ Venue.socialLinks |
| `city` | ✅ updateProfile | ✅ displayed | ✅ Venue.city |
| `neighborhood` | ✅ updateProfile | ✅ filtering | ✅ Venue.neighborhood |
| `address` | ✅ updateProfile | ✅ displayed | ✅ Venue.address |
| `phone` | ✅ updateProfile | ✅ displayed | ✅ Venue.phone |
| `email` | ✅ updateProfile | ✅ displayed | ✅ Venue.email |
| `website` | ✅ updateProfile | ✅ displayed | ✅ Venue.website |
| `whatsapp` | ✅ updateProfile | ✅ displayed | ✅ Venue.whatsapp |
| `ctas` | ✅ updateProfile | ⚠️ not rendered | ✅ Venue.ctas |
| `mediaGallery` | ✅ updateProfile | ⚠️ not rendered | ✅ Venue.mediaGallery |
| `videos` | ✅ updateProfile | ⚠️ not rendered | ✅ Venue.videos |
| `collaborations` | ✅ updateProfile | ⚠️ not rendered | ✅ Venue.collaborations |
| `pinnedEventIds` | ✅ updateProfile | ⚠️ not rendered | ✅ Venue.pinnedEventIds |

### 2. profile_posts Collection
| Feature | Partner Dashboard | Guest Portal | Mobile App |
|---------|-------------------|--------------|------------|
| Create | ✅ createPost | ❌ | ❌ |
| Read | ✅ getProfilePosts | ✅ partnerProfileStore | ✅ profiles.ts |
| Delete | ✅ deletePost | ❌ | ❌ |

### 3. profile_highlights Collection
| Feature | Partner Dashboard | Guest Portal | Mobile App |
|---------|-------------------|--------------|------------|
| Create | ✅ createHighlight | ❌ | ❌ |
| Read | ✅ getProfileHighlights | ✅ partnerProfileStore | ✅ profiles.ts |
| Delete | ✅ deleteHighlight | ❌ | ❌ |

---

## Key Files

### Partner Dashboard (Source of Truth)
- **API**: `/api/profile/route.ts` - Handles all profile CRUD
- **Store**: `/lib/server/profileStore.js` - Database operations
- **UI**: `/venue/page-management/page.tsx` - Management interface

### Guest Portal (Consumer)
- **Store**: `/lib/server/venueStore.js` - Venue data retrieval
- **Store**: `/lib/server/hostStore.js` - Host data retrieval
- **Store**: `/lib/server/partnerProfileStore.js` - Posts & Highlights
- **Page**: `/venue/[slug]/page.jsx` - Venue detail page

### Mobile App (Consumer)
- **Store**: `/store/venuesStore.ts` - Venue list & follow
- **API**: `/lib/api/venues.ts` - Venue CRUD operations
- **API**: `/lib/api/profiles.ts` - Posts & Highlights (NEW)
- **UI**: `/app/(tabs)/venues.tsx` - Venue discovery

---

## Synchronization Rules

### When Partner Updates Venue Profile:
1. Partner Dashboard calls `/api/profile` with action `updateProfile`
2. `profileStore.js` updates the `venues` collection in Firestore
3. Guest Portal reads updated data via `venueStore.js`
4. Mobile App reads updated data via `venuesStore.ts`

### When Partner Creates a Post:
1. Partner Dashboard calls `/api/profile` with action `createPost`
2. `profileStore.js` creates document in `profile_posts` collection
3. Guest Portal reads via `partnerProfileStore.js`
4. Mobile App reads via `profiles.ts`

### Slug/ID Resolution:
- Documents may have explicit `slug` field OR use document `id`
- All platforms support fallback: `slug || id`
- URLs work with either value

---

## Data Serialization

All platforms handle Firestore-specific types (Timestamps, etc.):
- **Partner Dashboard**: Server-side JS, handles natively
- **Guest Portal**: `serializeDoc()` helper converts for RSC
- **Mobile App**: `serializeDoc()` helper in `profiles.ts`

---

## Follow/Engagement Flow

User follows are tracked in `venue_follows` collection:
```
venue_follows/{venueId}_{userId}
├── venueId
├── userId
└── createdAt
```

Both Guest Portal and Mobile App can:
- Follow/unfollow venues
- Check follow status
- Update follow counts atomically

---

## Verified Sync Status

| Feature | Status |
|---------|--------|
| Core venue data | ✅ SYNCED |
| Profile images | ✅ SYNCED |
| Social links | ✅ SYNCED |
| Tags & filtering | ✅ SYNCED |
| Posts | ✅ SYNCED |
| Highlights | ✅ SYNCED |
| Follow counts | ✅ SYNCED |
| Slug routing | ✅ SYNCED |
| CTAs | ⚠️ Needs UI |
| Videos | ⚠️ Needs UI |
| Media Gallery | ⚠️ Needs UI |

---

## Future Enhancements

1. **Real-time Updates**: Consider Firestore listeners for live sync
2. **Caching**: Implement client-side caching for offline support
3. **CTA Rendering**: Add CTA buttons to Guest Portal venue pages
4. **Video Gallery**: Render videos on venue detail pages
5. **Media Gallery**: Implement tabbed gallery (Photos/Flyers/Press)
