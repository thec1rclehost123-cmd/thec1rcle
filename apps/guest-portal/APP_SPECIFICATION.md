# THE.C1RCLE App: Zero to Hero Development Guide

This document serves as the "Master Specification" for building the mobile application for **THE.C1RCLE**. It contains every piece of logic, design system, and backend requirement needed to replicate the website's functionality and integrate seamlessly with the existing ecosystem.

---

## 1. Brand Identity & Design System
**Concept:** A premium "Dark Luxury" event discovery platform. "Discover Life Offline."
**Vibe:** Exclusive, Nightlife, Modern, High-End, "In the Know".

### **Visual Language**
*   **Backgrounds:** Midnight Black (`#161616`) to Deep Grey (`#1F1F1F`).
*   **Primary Accent:** Iris Orange (`#F44A22`) - High energy actions.
*   **Secondary Accent:** Gold (`#FEF8E8`) & Metallic (`#A8AAAC`) - Premium touches.
*   **Typography:**
    *   *Headings:* `Satoshi` (Geometric, Bold, Uppercase).
    *   *Body:* `Inter` (Clean, Legible).
*   **UI Elements:**
    *   **Glassmorphism:** Blur effects on navbars and modals (`backdrop-blur`).
    *   **Gradients:** Subtle radial glows (Purple/Peach) on dark backgrounds.
    *   **Cards:** Dark cards with subtle borders (`white/10`) and hover glows.

---

## 2. Technical Architecture
The app shares the **exact same backend** as the website.
*   **Framework:** React Native (via Expo).
*   **Backend:** Google Firebase (Firestore, Auth, Storage).
*   **Payment:** Razorpay / Stripe (Must use same keys).
*   **Email:** Resend (Triggered via Cloud Functions or API).

---

## 3. Database Schema (Firestore)
The app must read/write to these collections exactly as defined.

### **A. Users (`/users/{uid}`)**
*   **Create:** On Auth Signup.
*   **Fields:**
    *   `uid`, `email`, `displayName`, `photoURL`
    *   `city` (User's location preference)
    *   `attendedEvents` (Array of Event IDs)
    *   `role` ('host' | 'admin' | undefined)
    *   `hostStatus` ('pending' | 'approved' | undefined)

### **B. Events (`/events/{eventId}`)**
*   **Read:** Public.
*   **Write:** Host Only.
*   **Key Fields:**
    *   `title`, `description`, `startDate` (ISO), `endDate` (ISO)
    *   `location`, `city` (Inferred from location), `venue`
    *   `hostId` (Creator UID)
    *   `tickets`: **Array** of `{ id, name, price, quantity, remaining }`
    *   `stats`: `{ rsvps, views, saves, shares }`
    *   `heatScore`: (Number) Calculated popularity score.
    *   `keywords`: (Array) For search indexing.
    *   `settings`: `{ visibility: 'public'|'password'|'link', passwordCode: '...' }`

### **C. Orders (`/orders/{orderId}`)**
*   **Create:** Transactional.
*   **Fields:**
    *   `userId`, `eventId`, `totalAmount`, `status` ('pending_payment', 'confirmed')
    *   `tickets`: Array of `{ ticketId, quantity, price }`

### **D. Waitlist (`/waitlist/{entryId}`)**
*   **Purpose:** For sold-out events or exclusive drops.
*   **Fields:**
    *   `eventId`, `userId`, `email`, `status` ('waiting', 'notified', 'expired')
    *   `createdAt`, `notifiedAt`, `expiresAt`

### **E. Hosts (`/hosts/{hostId}`)**
*   **Purpose:** Public profiles for event organizers.
*   **Fields:**
    *   `handle` (e.g., @after_dark), `name`, `avatar`, `bio`
    *   `followers` (Number), `verified` (Boolean)

### **F. Host Stats (`/host_stats/{hostId}`)**
*   **Purpose:** Private aggregated dashboard data for hosts.
*   **Fields:**
    *   `totalRevenue`, `revenueChange` (Number)
    *   `activeGuests`, `guestsChange` (Number)
    *   `ticketSales`, `salesChange` (Number)
    *   `revenueHistory`: Array of `{ date, amount }`
    *   `demographics`: `{ age: [], gender: [], geo: [] }`
    *   `popularEvents`: Array of `{ name, date, guests }`

### **G. Host Applications (`/host_applications/{appId}`)**
*   **Purpose:** Verification requests.
*   **Fields:** `uid`, `legalName`, `instagramHandle`, `idUrl`, `instaUrl`, `status`.

---

## 4. Core Logic & Algorithms (The "Brain")

### **A. The "Heat Score" (Ranking Algorithm)**
Used to sort the "Explore" feed.
```javascript
Score = 
  (Recency Boost [0-168]) + 
  (Guests * 4) + 
  (RSVPs * 3) + 
  (Shares * 0.8) + 
  (Saves * 0.4) + 
  (Views * 0.1)
```
*   **Recency Boost:** Higher score if event starts soon (7-day window).

### **B. Recommendation Engine ("For You")**
Personalized feed logic based on user's last 50 orders.
1.  **Tag Match:** `+5 pts` per matching tag (e.g., "Techno").
2.  **Host Affinity:** `+15 pts` if user attended this host before.
3.  **Location:** `+10 pts` if in user's preferred city.
4.  **Global Heat:** `+10%` of the event's Heat Score.
5.  **Penalty:** `-100 pts` if already attended.

### **C. "Similar Events" Logic**
When viewing an event, show others with:
*   **Overlapping Tags:** `+10 pts`
*   **Same Category:** `+5 pts`
*   **Same Host:** `+8 pts`
*   **Same City:** `+3 pts`

---

## 5. Critical Workflows

### **A. Ticket Purchase (Atomic Transaction)**
**CRITICAL:** You cannot just write to Firestore. You must use a Transaction.
1.  **Start Transaction.**
2.  **Read** Event Doc.
3.  **Check Inventory:** Ensure `ticket.remaining >= requested_qty`.
4.  **Deduct Inventory:** `ticket.remaining -= requested_qty`.
5.  **Create Order Doc:** Status `pending_payment`.
6.  **Commit Transaction.**

### **B. Waitlist System**
1.  **Join:** User adds themselves to `/waitlist`. Status = `waiting`.
2.  **Notify (Server-Side):** Admin/Script finds oldest `waiting` user -> updates to `notified` -> sets `expiresAt` (15 mins).
3.  **Purchase:** App checks if user status is `notified` AND `now < expiresAt` before allowing purchase of locked tickets.

### **C. Host Interactions**
*   **Follow Host:** Atomic increment of `followers` field on `/hosts/{hostId}`.
*   **Verification:** Hosts upload docs to `/hosts/{userId}/{fileName}` in Storage.

### **D. File Uploads (Storage)**
*   **Event Posters:** Upload to `/events/{timestamp}-{filename}`.
*   **Host Avatars:** Upload to `/hosts/{userId}/avatar-{timestamp}`.
*   **Access:** Public read, Authenticated write.

---

## 6. Host Architecture & Workflows (Detailed)

### **A. Host Onboarding (Verification)**
1.  **Form:** Collect `legalName`, `instagramHandle`.
2.  **Uploads:**
    *   **Government ID:** Upload to `hosts/{uid}/id_{timestamp}_{filename}`.
    *   **Insta Screenshot:** Upload to `hosts/{uid}/insta_{timestamp}_{filename}`.
3.  **Submission:**
    *   Create doc in `host_applications`.
    *   Update `users/{uid}` -> `hostStatus: 'pending'`.
4.  **UI:** Show "Application Received" state if `hostStatus === 'pending'`.

### **B. Host Dashboard (Real-Time)**
*   **Data Source:** Listen to `/host_stats/{uid}` (Do not calculate on client).
*   **Metrics to Show:**
    *   **Total Revenue:** `stats.totalRevenue` (with `revenueChange` %).
    *   **Active Guests:** `stats.activeGuests`.
    *   **Ticket Sales:** `stats.ticketSales`.
    *   **Bar Revenue:** `stats.barRevenue`.
*   **Charts:**
    *   **Revenue History:** Line chart using `stats.revenueHistory`.
    *   **Demographics:** Pie charts for `stats.demographics.age` and `gender`.
    *   **Geo:** List view of `stats.demographics.geo`.

### **C. Event Management (Wizard)**
*   **Creation Flow:**
    1.  **Details:** Title, Summary, Dates (Start/End), Location.
    2.  **Media:** Upload Poster (Storage), YouTube Link (Optional).
    3.  **Tickets:** Define Tiers (Name, Price, Qty).
    4.  **Settings:** Visibility (Public/Password), Recurring.
*   **Validation:** `startDate < endDate`. At least 1 ticket tier.

### **D. Profile Management**
*   **Edit Profile:**
    *   **Image:** Client-side crop (1:1 aspect ratio) -> Upload to `profile-pictures/`.
    *   **Fields:** `displayName`, `instagram`, `city`.
    *   **Sync:** Updates `users/{uid}`.

---

## 7. Shared Constants & Configuration
Ensure the app uses these exact values to match the website.

### **Categories**
`["Trending", "This Week", "Nearby", "Parties", "Music", "Workshops", "Dining"]`

### **Accent Colors (For Event Themes)**
`["#8845FF", "#F59E0B", "#EC4899", "#10B981", "#3B82F6", "#F97316", "#8B5CF6"]`

---

## 8. API & Integrations

### **A. Email System (Resend)**
*   **Trigger:** When Order Status becomes `confirmed`.
*   **Action:** Send HTML email with QR Code.
*   **Implementation:** App should trigger a Cloud Function or call the existing Web API (`/api/webhooks/payment`) to handle this securely.

### **B. Payment Gateway**
*   **Flow:**
    1.  App creates Order (Pending).
    2.  App opens Gateway (Razorpay/Stripe).
    3.  On Success -> Gateway calls Webhook (`/api/webhooks/payment`).
    4.  Webhook updates Order to `confirmed` & sends Email.

---

## 9. Security Rules (Firestore)
1.  **Users:** Can only edit their *own* profile.
2.  **Events:** Public Read. Host Write (only their own events).
3.  **Orders:** User can read their own. Host can read orders for their events.
4.  **Waitlist:** Users can create their own entry. Read only their own status.
5.  **Host Stats:** Only the host (`request.auth.uid == hostId`) can read.

---

## 10. Development Checklist (Zero to Hero)

### **Phase 1: Foundation**
- [ ] Initialize Expo Project (TypeScript).
- [ ] Configure NativeWind (Tailwind) with Design System colors.
- [ ] Setup Firebase SDK (Auth + Firestore).
- [ ] Implement Login/Signup Screens (Sync to `/users`).

### **Phase 2: Discovery**
- [ ] Build Home Feed (Fetch Events + Heat Score Sort).
- [ ] Build Explore Page (Search + City Filter).
- [ ] Implement Event Details Screen (Dynamic Header, Info).

### **Phase 3: Commerce**
- [ ] Build Ticket Selection Modal.
- [ ] Implement **Atomic Purchase Transaction**.
- [ ] Integrate Payment Gateway SDK.
- [ ] Build "My Tickets" Screen (QR Code display).

### **Phase 4: Social & Intelligence**
- [ ] Implement "For You" Recommendation Algorithm.
- [ ] Add "Similar Events" carousel on Details page.
- [ ] Build Host Profile View & Follow System.
- [ ] Implement Waitlist UI (Join/Status Check).

### **Phase 5: Host Ecosystem**
- [ ] Build **Host Verification Flow** (ID Upload).
- [ ] Build **Host Dashboard** (Charts & Metrics).
- [ ] Build **Create Event Wizard** (Multi-step form).
- [ ] Implement **Profile Editor** (Image Cropper).
