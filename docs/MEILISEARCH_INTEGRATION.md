# Meilisearch Integration - Production Deployment Guide

## Overview

C1RCLE uses **Meilisearch** for instant, typo-tolerant search across events, venues, and hosts. Search results return in under 50ms, giving users a premium "Google-like" experience.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Search Flow                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest Portal                                                    │
│  ┌─────────────┐    ┌────────────┐    ┌─────────────────┐       │
│  │ SearchInput │ →  │ /api/search│ →  │ Meilisearch     │       │
│  │ (debounced) │    │  (Next.js) │    │ Cloud/Self-Host │       │
│  └─────────────┘    └────────────┘    └─────────────────┘       │
│                                                                  │
│  Partner Dashboard (Admin)                                       │
│  ┌──────────────────┐    ┌────────────────────────────────┐     │
│  │ Publish Event    │ →  │ Inngest: SEARCH_SYNC_EVENT     │     │
│  │ Update Venue     │    │ → Indexes to Meilisearch       │     │
│  └──────────────────┘    └────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Production Setup

### Option 1: Meilisearch Cloud (Recommended)

1. Sign up at [https://cloud.meilisearch.com](https://cloud.meilisearch.com)
2. Create a new project
3. Copy your **Host URL** and **API Keys**
4. Add to Vercel environment:

```bash
MEILISEARCH_HOST=https://your-instance.meilisearch.io
MEILISEARCH_API_KEY=your_search_api_key      # Read-only, for search queries
MEILISEARCH_MASTER_KEY=your_master_key       # Admin, for indexing
```

### Option 2: Self-Hosted (DigitalOcean, etc.)

1. Deploy Meilisearch on a server:
```bash
curl -L https://install.meilisearch.com | sh
./meilisearch --master-key="your_master_key" --env="production"
```

2. Put behind HTTPS (Nginx/Caddy)
3. Configure environment variables

## Index Configuration

### Initialize Indexes (Run Once)

After deployment, call the init endpoint:

```bash
curl -X POST https://partner.c1rcle.com/api/search/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "init"}'
```

This creates 3 indexes with optimized settings:
- `events` - Searchable by title, description, venue, host, genres
- `venues` - Searchable by name, city, neighborhood
- `hosts` - Searchable by brand name, genres

### Full Sync (Populate Index)

To sync all existing events from Firestore:

```bash
curl -X POST https://partner.c1rcle.com/api/search/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "full-sync"}'
```

## API Reference

### Search Events

```
GET /api/search?q=techno&city=Mumbai&genres=house,techno&limit=20
```

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| q | string | Search query |
| type | string | "events", "venues", or "suggestions" |
| city | string | Filter by city |
| genres | string | Comma-separated genres |
| dateFrom | ISO string | Events starting after |
| dateTo | ISO string | Events starting before |
| priceMax | number | Maximum ticket price |
| available | boolean | Only events with tickets |
| sort | string | "date", "price", "popular", "newest" |
| limit | number | Results per page (max 100) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "type": "events",
  "query": "techno",
  "hits": [
    {
      "id": "evt_123",
      "title": "Techno Night",
      "venueName": "Club XYZ",
      "venueCity": "Mumbai",
      "startDate": 1710532800000,
      "priceMin": 500,
      "_formatted": {
        "title": "<mark>Techno</mark> Night"
      }
    }
  ],
  "totalHits": 42,
  "processingTimeMs": 12,
  "facetDistribution": {
    "genres": { "techno": 15, "house": 12, "trance": 8 },
    "venueCity": { "Mumbai": 25, "Delhi": 10, "Bangalore": 7 }
  }
}
```

### Autocomplete Suggestions

```
GET /api/search?type=suggestions&q=tech
```

**Response:**
```json
{
  "suggestions": [
    { "id": "evt_123", "title": "Techno Night", "subtitle": "Club XYZ", "date": "2024-03-15" },
    { "id": "evt_456", "title": "Tech House Sundays", "subtitle": "Beach Club", "date": "2024-03-17" }
  ]
}
```

## Frontend Integration

### Using the Hook

```jsx
import { useInstantSearch, SearchInput } from "@/lib/hooks/useInstantSearch";

function EventSearch() {
  const {
    query,
    setQuery,
    results,
    suggestions,
    facets,
    isLoading,
    hasMore,
    loadMore,
    updateFilter,
  } = useInstantSearch({ type: "events" });

  return (
    <div>
      <SearchInput 
        value={query} 
        onChange={setQuery} 
        placeholder="Search events..."
      />

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map(s => (
            <li key={s.id}>{s.title}</li>
          ))}
        </ul>
      )}

      {/* Facet filters */}
      <div className="filters">
        {facets.genres && Object.entries(facets.genres).map(([genre, count]) => (
          <button 
            key={genre} 
            onClick={() => updateFilter("genres", [genre])}
          >
            {genre} ({count})
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div>Searching...</div>
      ) : (
        <div className="results">
          {results.map(event => (
            <EventCard key={event.id} event={event} />
          ))}

          {hasMore && (
            <button onClick={loadMore}>Load More</button>
          )}
        </div>
      )}
    </div>
  );
}
```

## Automatic Sync via Inngest

When an event is published, it's automatically indexed:

1. Host clicks "Publish Event"
2. Backend dispatches `EVENT_PUBLISHED` event
3. Inngest workflow `autoSyncOnPublish` triggers
4. Workflow calls `syncEventToSearch` with eventId
5. Event data is enriched with venue/host info
6. Indexed to Meilisearch

**Manual sync for a single event:**

```javascript
import { sendEvent, Events } from "@c1rcle/core/inngest";

await sendEvent(Events.SEARCH_SYNC_EVENT, {
  eventId: "evt_123",
  action: "index", // or "remove"
});
```

## File Structure

```
packages/core/
├── search.js                    # Meilisearch client + search functions
└── workflows/
    └── search-sync.js           # Inngest workflows for auto-sync

apps/guest-portal/
├── app/api/search/route.js      # Search API endpoint
└── lib/hooks/useInstantSearch.js # React hook

apps/partner-dashboard/
└── app/api/search/sync/route.js  # Admin sync endpoint
```

## Performance Tips

1. **Searchable Attributes**: Only index fields users actually search
2. **Filterable vs Searchable**: Use filters for exact matches (genre, city)
3. **Batch Updates**: When updating many events, batch in groups of 1000
4. **Facets**: Use facets for filter counts (e.g., "Techno (15)")

## Monitoring

Meilisearch Cloud provides:
- Search analytics (popular queries, zero-result queries)
- Performance metrics
- Index health

For self-hosted, monitor:
- `/health` endpoint
- Memory usage (Meilisearch is memory-intensive)
- Index size

## Future Enhancements

- [ ] Geo-search: Find events near user location
- [ ] AI-powered ranking: Personalized results based on user history
- [ ] Multi-language support: Hindi, regional languages
- [ ] Trending searches: Show popular queries
