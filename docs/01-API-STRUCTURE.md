# API Structure & Endpoints

## Overview

The API Gateway is built with **Fastify** and runs on port **4000** by default. All endpoints are prefixed with `/api/v1` (except scan routes).

### Base URL
```
Development: http://localhost:4000
Staging: https://api-staging.thec1rcle.com
Production: https://api.thec1rcle.com
```

---

## Authentication

All endpoints (except public routes) require a Firebase JWT token in the Authorization header:

```http
Authorization: Bearer <firebase_id_token>
```

### Public Endpoints (No Auth Required)
- `GET /health` - Health check
- `GET /events` - List public events
- `GET /events/:id` - Get event details
- `GET /events/nearby` - Get nearby events
- `GET /payments/config` - Get payment config

### Authenticated Endpoints
All other endpoints require a valid Firebase token. The decoded token is available in `request.user`.

---

## API Endpoints Reference

### 1. Events (`/api/v1/events`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/events` | List events with filters | No* |
| GET | `/events/nearby` | Get nearby events | No |
| GET | `/events/:id` | Get event by ID or slug | No |
| POST | `/events` | Create new event | Yes |
| PATCH | `/events/:id` | Update event | Yes |
| DELETE | `/events/:id` | Delete event | Yes |

**Query Parameters for `GET /events`:**
```typescript
{
    limit?: number;        // default: 20
    offset?: number;
    city?: string;         // e.g., "pune-in"
    sort?: 'heat' | 'new' | 'soonest' | 'price';
    search?: string;
    host?: string;
    category?: string;
}
```

**Response:**
```typescript
{
    events: Event[];
    hasMore: boolean;
}
```

---

### 2. Checkout (`/api/v1/checkout`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/checkout/validate` | Calculate pricing | Optional |
| POST | `/checkout/promo` | Validate promo code | Optional |
| POST | `/checkout/reserve` | Reserve tickets (5 min TTL) | Optional |
| POST | `/checkout/initiate` | Create order | Yes |
| POST | `/checkout/cancel` | Cancel/release reservation | Optional |

**Request: `POST /checkout/reserve`**
```typescript
{
    eventId: string;
    items: Array<{
        tierId: string;
        quantity: number;
    }>;
    deviceId?: string;  // For anonymous users
}
```

**Response:**
```typescript
{
    success: boolean;
    reservationId: string;
    expiresAt: string;  // ISO timestamp (5 min from now)
}
```

**Request: `POST /checkout/initiate`**
```typescript
{
    reservationId: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    promoCode?: string;
    promoterCode?: string;
}
```

**Response:**
```typescript
{
    success: boolean;
    requiresPayment: boolean;
    order: Order;
    pricing: PricingResult;
}
```

---

### 3. Payments (`/api/v1/payments`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/payments/config` | Get Razorpay config | No |
| POST | `/payments/order` | Create payment order | Yes |
| PATCH | `/payments/verify` | Verify & confirm payment | Yes |

**Request: `POST /payments/order`**
```typescript
{
    orderId: string;  // System order ID from checkout
}
```

**Response:**
```typescript
{
    razorpayOrderId: string;
    amount: number;
    currency: "INR";
    key: string;  // Razorpay key ID
}
```

**Request: `PATCH /payments/verify`**
```typescript
{
    orderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}
```

---

### 4. Orders (`/api/v1/orders`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/orders/event/:eventId` | Get orders for event | Yes |
| GET | `/orders/stats/:eventId` | Get order statistics | Yes |

**Authorization:** Requires `viewEvents` or `viewFinance` permission on the event's venue.

---

### 5. Tickets (`/api/v1/tickets`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/tickets` | Get user's tickets | Yes |
| GET | `/tickets/:id` | Get ticket details | Yes |
| POST | `/tickets/:id/transfer` | Transfer ticket | Yes |
| POST | `/tickets/claim` | Claim transferred ticket | Yes |

---

### 6. Staff (`/api/v1/staff`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/staff/:venueId` | List staff members | Yes |
| POST | `/staff/:venueId` | Invite staff member | Yes |
| PATCH | `/staff/:venueId/:staffId` | Update staff role | Yes |
| DELETE | `/staff/:venueId/:staffId` | Remove staff | Yes |

**Authorization:** Requires `manageStaff` permission.

---

### 7. Analytics (`/api/v1/analytics`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/analytics/venue/:id` | Venue analytics | Yes |
| GET | `/analytics/host/:id` | Host analytics | Yes |
| GET | `/analytics/promoter/:id` | Promoter funnel | Yes |

**Query Parameters:**
```typescript
{
    range?: '7d' | '30d' | '90d' | 'all';  // default: 30d
}
```

---

### 8. Profiles (`/api/v1/profiles`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/profiles/me` | Current user profile | Yes |
| PATCH | `/profiles/me` | Update profile | Yes |
| GET | `/profiles/:id` | Get public profile | No |
| GET | `/profiles/:id/tickets` | User's tickets | Yes |

---

### 9. Search (`/api/v1/search`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/search` | Search events | No |

**Query Parameters:**
```typescript
{
    q: string;           // Search query
    city?: string;
    limit?: number;
}
```

---

### 10. Calendar (`/api/v1/calendar`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/calendar/availability/:venueId` | Check venue availability | Yes |
| POST | `/calendar/block` | Block a date | Yes |
| POST | `/calendar/request` | Request time slot | Yes |

---

### 11. Promos (`/api/v1/promos`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/promos/event/:eventId` | List promos for event | Yes |
| POST | `/promos` | Create promo code | Yes |
| PATCH | `/promos/:id` | Update promo | Yes |
| DELETE | `/promos/:id` | Delete promo | Yes |

**Authorization:** Requires `editEvents` permission.

---

### 12. Tables (`/api/v1/tables`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/tables/venue/:venueId` | Get venue floor plan | Yes |
| POST | `/tables/venue/:venueId` | Create/update table | Yes |
| POST | `/tables/assign` | Assign table to booking | Yes |

---

### 13. Waitlist (`/api/v1/waitlist`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/waitlist/join` | Join waitlist | No |
| GET | `/waitlist/event/:eventId` | Get event waitlist | Yes |
| POST | `/waitlist/process` | Process waitlist | Yes |

---

### 14. Scan (`/api/v1/scan`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/scan/verify` | Verify ticket | Yes |
| POST | `/scan/record` | Record scan | Yes |
| GET | `/scan/history/:eventId` | Get scan history | Yes |

**Authorization:** Requires `scanTickets` permission.

---

### 15. Refunds (`/api/v1/refunds`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/refunds` | Initiate refund | Yes |
| GET | `/refunds/:orderId` | Get refund status | Yes |

**Authorization:** Requires `viewFinance` permission.

---

## Response Formats

### Success Response
```typescript
{
    success: true;
    data: any;
}
```

### Error Response
```typescript
{
    success: false;
    error: string;
}
```

### Paginated Response
```typescript
{
    data: any[];
    hasMore: boolean;
    nextOffset?: number;
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (e.g., ticket already reserved) |
| 422 | Validation Error |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently not implemented at API Gateway level. Redis-based rate limiting is planned.

---

## Versioning

The API uses URL-based versioning:
- Current: `/api/v1/*`
- Future: `/api/v2/*`

Breaking changes will result in version increments.

---

## Deprecation Policy

Deprecated endpoints will:
1. Return `Deprecation` header
2. Include `Sunset` header with removal date
3. Be documented in changelog

---

## Testing Endpoints

### Using curl
```bash
# Health check
curl http://localhost:4000/health

# List events
curl http://localhost:4000/api/v1/events

# With authentication (example)
curl -H "Authorization: Bearer <token>" \
     http://localhost:4000/api/v1/tickets
```

### Using Postman
Import the Postman collection from `/docs/postman-collection.json` (if available).

---

## Notes for Interns

1. **Always check auth requirements** before testing
2. **Use Firebase Emulator** for local development
3. **Check response status codes** - 200 doesn't always mean success
4. **Use TypeScript interfaces** in `/packages/core/types.d.ts` for request/response types
5. **Log levels**: Use `fastify.log.info()` for debugging

---

*Last Updated: May 2026*