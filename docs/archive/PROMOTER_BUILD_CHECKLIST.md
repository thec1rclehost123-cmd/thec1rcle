# Promoter Dashboard Build Checklist

## 1. Overview Dashboard (In Progress)
- [x] Scaffold page and layout shell
- [x] Create KPI Grid component
- [x] Create Active Events Rail component
- [x] Create Conversion Snapshot component
- [x] Create Top Link Card component
- [x] Create Leaderboard Card component
- [ ] Connect components to actual data shapes
- [ ] Polish UI (animations, hover states, empty states)

## 2. My Events (Assigned Events List)
- [x] Create Events List route and page structure
- [x] Implement `PromoterAssignmentCard` and list view
- [x] Add filtering (Active, Past) and local search
- [x] Connect to API for fetching assigned events
- [x] Add link generation/copy UI directly from the list

## 3. Event Detail Workspace
- [x] Create Event Detail route (`/promoter/events/[id]`)
- [x] Implement Header with Event Summary
- [x] Implement Tracking Links Manager (Create, Copy, Disable links)
- [x] Implement Event-Specific Analytics (Clicks, Sales, Conversion)
- [x] Implement Guest List Tab (View, Add, Manage guests)
- [x] Add manual payout/commission request UI (if applicable)

## 4. Analytics & Funnel Page
- [x] Create Analytics route and page structure
- [x] Implement Aggregated Metrics Dashboard
- [x] Implement Link Performance Table (sorting by clicks, conversion)
- [x] Implement Time-Series Chart (Sales/Clicks over time)

## 5. Finance & Ledger
- [x] Create Finance route and page structure
- [x] Implement Ledger summary (Balance, Pending, Lifetime Earned)
- [x] Implement Payout History and Status table
- [x] Integrate payout request component" flow/modal
- [x] Implement Commission Ledger (detailed breakdown per ticket)

## 6. Guests (Global Guest List)
- [x] Create Guests route (`/promoter/guests`)
- [x] Implement global Guest List table (aggregated across events)
- [x] Add filtering/search capabilities
- [x] (Optional) Add Bulk Export functionalityow across multiple events

## 7. Profile & Settings
- [x] Create Profile route (`/promoter/profile`)
- [x] Implement visibility toggle (Public/Private)
- [x] Add editable fields (Social links, bio, default avatar)
- [x] Integrate actual backend save endpoints
- [ ] Implement Team/Agency settings (if Team Lead role)

## 8. API & Backend Integration
- [ ] Finalize `GET /api/partner/promoter/overview`
- [ ] Create `GET /api/partner/promoter/events`
- [ ] Create `GET /api/partner/promoter/events/[id]`
- [ ] Create `POST /api/partner/promoter/links`
- [ ] Create `GET /api/partner/promoter/analytics`
- [ ] Create `GET /api/partner/promoter/finance`

## 9. Polish & QA
- [x] Upgrade all loading states from spinners to skeleton loaders
- [x] Clean up unused imports across all promoter components
- [ ] Complete E2E testing of the promoter flow
- [ ] Audit RBAC (ensure promoters only see their own data)
- [ ] Mobile responsive checks
- [ ] Accessibility review
- [x] Final Lint & Type Check
