# Page Management — Feature Specification

> CMS for Cultural Brands on THE C1RCLE

## Overview

Page Management is the editorial control system that allows Hosts and Venues to shape their public-facing identity on THE C1RCLE user website. It transforms partner profiles from basic listings into rich, contextual brand presences that build credibility and foster audience relationships.

---

## Control Surfaces

### Partner Dashboard (Editing)
- **Host Page Management**: `/host/page-management`
- **Venue Page Management**: `/venue/page-management`

### Guest Portal (Public Display)
- **Hosts Discovery**: `/hosts`
- **Host Detail Page**: `/host/[slug]`
- **Venues Discovery**: `/explore` (venues tab)
- **Venue Detail Page**: `/venue/[slug]`

---

## Managed Content Layers

### 🎭 Identity Layer
| Field | Host | Venue | Description |
|-------|------|-------|-------------|
| `displayName` | ✅ | ✅ | Stage name or brand |
| `photoURL` | ✅ | ✅ | Profile photo / Logo |
| `coverURL` | ✅ | ✅ | Banner/cover image |
| `tagline` | ✅ | ✅ | One-liner description |
| `slug` | ✅ | ✅ | URL handle |
| `role` | ✅ | — | DJ, Promoter, Collective, etc. |
| `venueType` | — | ✅ | Nightclub, Rooftop, Lounge, etc. |
| `isVerified` | ✅ | ✅ | Verification badge |

### 🎵 Sound & Style Layer
| Field | Host | Venue | Description |
|-------|------|-------|-------------|
| `genres` | ✅ | ✅ | Music genres (Techno, House, etc.) |
| `styleTags` | ✅ | ✅ | Vibe tags (Underground, Intimate, etc.) |

### 📍 Location & Contact
| Field | Host | Venue | Description |
|-------|------|-------|-------------|
| `city` | ✅ | ✅ | Primary city |
| `address` | — | ✅ | Full street address |
| `phone` | — | ✅ | Contact phone |
| `email` | ✅ | ✅ | Booking/reservations email |
| `website` | ✅ | ✅ | External website URL |
| `socialLinks` | ✅ | ✅ | Instagram, Twitter, SoundCloud, Spotify, YouTube |

### 🏢 Venue-Specific
| Field | Description |
|-------|-------------|
| `capacity` | Guest capacity |
| `openingHours` | Operating hours |
| `amenities` | Parking, WiFi, VIP, Food, etc. |

### 📝 Narrative Layer
| Field | Host | Venue | Description |
|-------|------|-------|-------------|
| `bio` | ✅ | ✅ | Extended bio/description |
| `collaborations` | ✅ | — | Artist partnerships |
| `affiliations` | ✅ | ✅ | Residencies, partnerships |
| `pressSnippets` | ✅ | — | Media quotes and features |
| `achievements` | ✅ | — | Awards, milestones |

### 📸 Content Layer
| Field | Host | Venue | Description |
|-------|------|-------|-------------|
| `photos` | ✅ | ✅ | Photo gallery |
| `videos` | ✅ | ✅ | Aftermovies, recaps, promos |
| Posts | ✅ | ✅ | Timeline updates (stored separately) |
| Highlights | ✅ | ✅ | Story-style pinned content |

### 📊 Engagement Layer (Phase 2)
| Metric | Description |
|--------|-------------|
| `followersCount` | Current follower count |
| `totalLikes` | Cumulative engagement |
| `totalViews` | Page view count |
| `postsCount` | Number of posts |

---

## Technical Architecture

### Data Storage
- **Firestore Collections**:
  - `hosts` — Host profile documents
  - `clubs` — Venue profile documents
  - `host_posts`, `club_posts` — Timeline posts
  - `host_highlights`, `club_highlights` — Story highlights
  - `follows` — Follow relationships

### API Endpoints
```
GET  /api/profile?profileId=X&type=host|venue&stats=true
POST /api/profile
     action: updateProfile | createPost | deletePost | createHighlight | deleteHighlight
```

### Backend Store
`apps/partner-dashboard/lib/server/profileStore.js`
- `getProfile(id, type)` — Fetch profile with metadata
- `updateProfile(id, type, updates, user)` — Safe field updates
- `createPost(id, type, data, user)` — Create timeline post
- `deletePost(id, type, postId, user)` — Remove post
- `createHighlight(id, type, data, user)` — Create highlight
- `deleteHighlight(id, type, highlightId, user)` — Remove highlight
- `getProfileStats(id, type)` — Aggregate engagement stats

---

## UI Components

### Partner Dashboard Tabs
1. **Identity** — Core info, role, cover image, genres, social links
2. **Content** — Posts, highlights, press snippets
3. **Media** — Photo gallery, videos/aftermovies
4. **Engagement** — Follower stats, analytics preview

### Design System
- Apple Pro / Operator aesthetic
- Rounded surfaces (radius-2xl, radius-3xl)
- Subtle shadows and borders
- Slate-900 accent for dark interactive elements
- Orange gradient for Host, Emerald gradient for Venue
- Tab navigation with animated transitions

---

## Public Page Features

### Host Detail Page
- Hero with cover image + avatar
- Role badge + genre tags
- Follower/event count stats
- Bio section
- Style tags
- Upcoming events grid
- Videos/aftermovies section
- Past events gallery
- Social links footer

### Venue Detail Page
- Hero with cover image + logo
- Venue type badge + genres
- Location + opening hours
- Capacity + follower stats
- Bio section
- Amenities pills
- Upcoming events grid
- Videos/tours section
- Photo gallery
- Contact footer

---

## Implementation Checklist

### ✅ Completed
- [x] Enhanced profileStore with new fields
- [x] Host Page Management UI (4 tabs)
- [x] Venue Page Management UI (4 tabs)
- [x] Host public page with enhanced hero
- [x] Venue public page with enhanced hero
- [x] Genres/style tags support
- [x] Extended social links (SoundCloud, Spotify, Twitter)
- [x] Video/aftermovie management
- [x] Amenities for venues
- [x] Photo gallery management
- [x] Posts & highlights system
- [x] Engagement stats preview

### 🔜 Future Enhancements
- [ ] Auto-sync photos from past events
- [ ] Event photo categorization (photos vs flyers vs press)
- [ ] Advanced engagement analytics
- [ ] Audience demographics
- [ ] Press snippet management UI
- [ ] Collaborations/affiliations section
- [ ] Real-time page view tracking
- [ ] Edge-cache invalidation triggers

---

## Design Philosophy

> **"Page Management is where operational identity becomes cultural presence."**

### Principles
1. **Professional over playful** — This is a business tool, not a creative sandbox
2. **Clarity over complexity** — Every field serves discoverability or credibility
3. **Atomic updates** — Changes publish immediately, no complex workflows
4. **Preview before publish** — See exactly what guests will see
5. **Mobile-first editing** — Works beautifully on any device

### Behavior Differences
| Aspect | Host Page | Venue Page |
|--------|-----------|------------|
| Focus | Portfolio, culture, events | Space, hospitality, calendar |
| Identity | "Curator identity" | "Operator identity" |
| Accent | Orange (#F44A22) | Emerald (#10B981) |
| Primary content | Music, performances | Atmosphere, amenities |

---

## Outcome

When Page Management is fully realized:
- **Hosts** become recognizable brands in culture channels
- **Venues** become trusted destinations with rich context
- **Guests** gain confidence in ticket purchases through credibility signals
- **THE C1RCLE** accumulates cultural identity as hosts build persistent presence

---

*Last Updated: January 2026*
*Feature Owner: Partner Experience Team*
