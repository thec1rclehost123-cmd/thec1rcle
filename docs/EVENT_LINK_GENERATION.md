# Event Link Generation - Implementation Summary

## Overview
This document summarizes the implementation of the event promoter link generation and tracking system for THE C1RCLE platform.

## Features Implemented

### 1. Promoter Link Generation (Partner Dashboard)
- **Location**: `apps/partner-dashboard/app/promoter/events/page.tsx`
- Promoters can browse available events and generate unique referral links
- Each link has a unique 6-character code (e.g., `AB3XY7`)
- Links are stored in the `promoter_links` Firestore collection

### 2. Short URL Support (Guest Portal)
- **Location**: `apps/guest-portal/app/e/[eventId]/page.jsx`
- Short URLs like `/e/{eventId}?ref={code}` redirect to full event pages
- Preserves the referral code through the redirect

### 3. Click Tracking
- **API Endpoint**: `apps/guest-portal/app/api/promoter/links/click/route.js`
- When a user visits an event page with a `?ref=` parameter, a click is recorded
- Click tracking is called from `EventRSVP.jsx` on page load
- Clicks are stored and incremented in the `promoter_links` collection

### 4. Conversion Tracking
- **Location**: `apps/guest-portal/lib/server/orderStore.js`
- When an order is created with a `promoterCode`, the system:
  1. Resolves the code to a promoter link ID
  2. Records the conversion in the `promoter_commissions` collection
  3. Updates the link's conversion count, revenue, and commission totals
- **Location**: `apps/guest-portal/lib/server/promoterStore.js`
  - Contains `getPromoterLinkByCode()` and `recordConversion()` functions

### 5. Commission Management
- **API Endpoint**: `apps/partner-dashboard/app/api/promoter/commissions/route.ts`
- Allows fetching commission history by promoter or event
- Supports filtering by status (pending, paid, etc.)

### 6. Promoter Dashboard Updates
- **Location**: `apps/partner-dashboard/app/promoter/page.tsx`
- Dashboard now fetches real earnings data from `/api/promoter/stats`
- Recent commissions are displayed from `/api/promoter/commissions`
- Active events query includes both `live` and `active` statuses

## Data Flow

```
1. Promoter generates link
   → POST /api/promoter/links
   → Creates entry in `promoter_links` collection
   
2. User visits event via promoter link
   → /e/{eventId}?ref={code}
   → Redirects to /event/{eventId}?ref={code}
   → POST /api/promoter/links/click (records click)
   → EventRSVP captures ref code in state
   
3. User proceeds to checkout
   → TicketModal passes ref to checkout URL
   → CheckoutContainer captures ref from URL
   → Order payload includes promoterCode
   
4. Order is created
   → createOrder() resolves promoterCode to linkId
   → If order is confirmed, recordConversion() is called
   → Commission record created in `promoter_commissions`
   → Link stats updated (conversions, revenue, commission)
```

## Database Collections

### `promoter_links`
```javascript
{
  id: string,
  code: string,              // 6-char unique code
  promoterId: string,
  promoterName: string,
  eventId: string,
  eventTitle: string,
  ticketTierIds: string[],
  commissionRate: number,
  commissionType: "percentage" | "fixed",
  clicks: number,
  conversions: number,
  revenue: number,
  commission: number,
  isActive: boolean,
  expiresAt: string | null,
  createdAt: string,
  updatedAt: string
}
```

### `promoter_commissions`
```javascript
{
  id: string,
  linkId: string,
  linkCode: string,
  promoterId: string,
  eventId: string,
  orderId: string,
  orderAmount: number,
  ticketTierId: string,
  commissionRate: number,
  commissionType: string,
  commissionAmount: number,
  status: "pending" | "paid" | "cancelled",
  createdAt: string,
  updatedAt: string
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/promoter/links` | POST | Create a new promoter link |
| `/api/promoter/links` | GET | List promoter links (filter by promoter/event) |
| `/api/promoter/links/click` | POST | Record a link click |
| `/api/promoter/stats` | GET | Get promoter statistics |
| `/api/promoter/commissions` | GET | List promoter commissions |

## Event Lifecycle Integration

When a club approves an event:
- `lifecycle` is set to `approved`
- `status` is set to `active`
- Events become visible to promoters in their dashboard
- Promoters can generate links for `approved`, `scheduled`, or `live` events

## Order Schema Update

The order creation validator now accepts an optional `promoterCode` field:
```javascript
promoterCode: z.string().optional()
```

## Next Steps

1. **Payment Integration**: Connect commission payouts to payment gateway
2. **Promoter Onboarding**: Auto-assign promoters to events based on preferences
3. **Analytics Dashboard**: Enhanced reporting for hosts and clubs
4. **Commission Adjustments**: Allow hosts to adjust commission rates per promoter
5. **Expiring Links**: Implement link expiration based on event date
