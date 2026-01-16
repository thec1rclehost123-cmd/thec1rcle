# 🛠️ c1rcle Admin System Specification

This document defines the backend logic, data models, and authority systems for the c1rcle Admin Panel.

## 🏛️ 1. Core Architecture
- **Isolation:** The Admin Panel logic resides in `lib/admin`.
- **RBAC:** Authentication via Firebase Custom Claims (`role: 'admin'`).
- **Granular Roles:**
  - `super_admin`: Full system access.
  - `ops_admin`: Venue/Host/Event management.
  - `content_admin`: Moderation and quality control.
  - `finance_admin`: Payments and settlements.
  - `support_admin`: User issues and disputes.

## 📊 2. Data Models (Extensions)

### `admin_logs` (Collection)
- `adminId`: UID of the performing admin.
- `action`: String (e.g., 'PAUSE_EVENT', 'BAN_USER').
- `targetId`: UID or Document ID of the target.
- `timestamp`: Server timestamp.
- `reason`: String.
- `metadata`: Object (stores before/after states).

### `platform_stats` (Collection / Singleton)
- `users_total`: Number.
- `venues_total`: { active, pending, suspended }.
- `hosts_total`: Number.
- `promoters_total`: Number.
- `revenue`: { total, daily, weekly }.

### `moderation_queue` (Collection)
- `contentId`: Reference to post/event/venue.
- `contentType`: 'post' | 'event' | 'venue' | 'host'.
- `status`: 'pending' | 'flagged' | 'resolved'.
- `flags`: Array of reasons.
- `submittedAt`: Timestamp.

### `featured_placements` (Collection)
- `targetId`: ID of venue/host/event.
- `targetType`: 'venue' | 'host' | 'event'.
- `city`: String (or 'global').
- `placement`: 'top_discover' | 'home_hero' | 'weekend_picks'.
- `label`: 'featured' | 'sponsored' | 'c1rcle_select'.
- `expiry`: Timestamp.
- `priority`: Number.

## 🛡️ 3. Authority Logic (System Behavior)

### Venue Governance
- **Status Transitions:** `Pending -> Active | Suspended`.
- **Locking:** `lockVenue(venueId)` prevents new event creation.

### Event Governance
- **Force Pause:** Sets `status: 'paused'` and triggers notifications to ticketholders.
- **Bypass Detection:** Cron jobs analyzing frequency of independent events at specific venues.

### Monetization Engine
- **Boost Logic:** Updates discovery weight of an event document.
- **Payment Hooks:** On successful boost payment, update `featured_placements` and `discoverWeight`.

## 📜 4. Security Philosophy
1. **Auditable:** Every write action must create an `admin_logs` entry.
2. **Reversible:** System state snapshots before major changes.
3. **Attributable:** Every action linked to a specific admin UID and role.
