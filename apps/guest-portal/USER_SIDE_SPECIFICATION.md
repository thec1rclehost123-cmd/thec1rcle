# THE.C1RCLE App: User-Side Specification (MVP)

This document focuses exclusively on the **User (Consumer)** experience. It details the logic, schema, and workflows required for users to discover events, buy tickets, and manage their profile.

---

## 1. Brand & Design System
**Concept:** "Dark Luxury" Event Discovery.
**Visuals:**
*   **Background:** Midnight Black (`#161616`).
*   **Accent:** Iris Orange (`#F44A22`).
*   **Font:** `Satoshi` (Headings), `Inter` (Body).
*   **Vibe:** Glassmorphism, Glows, Premium Cards.

---

## 2. Database Schema (User-Facing)

### **A. Users (`/users/{uid}`)**
*   **Read/Write:** User can read/write their own doc.
*   **Fields:**
    *   `uid`, `email`, `displayName`, `photoURL`
    *   `city` (String): User's current location preference.
    *   `attendedEvents` (Array<String>): IDs of past events.
    *   `savedEvents` (Array<String>): IDs of bookmarked events.

### **B. Events (`/events/{eventId}`)**
*   **Read:** Public.
*   **Fields to Display:**
    *   `title`, `startDate`, `endDate`, `location`, `venue`.
    *   `image` (Poster URL), `gallery` (Array of URLs).
    *   `tickets` (Array): Display `name`, `price`, and `remaining` (if low).
    *   `hostId`: Link to Host Profile.
    *   `heatScore`: Use this to sort the "Trending" feed.
    *   `tags`: Use for "Related Events".

### **C. Orders (`/orders/{orderId}`)**
*   **Read:** User can read their own orders (`userId == auth.uid`).
*   **Fields:**
    *   `status`: 'pending_payment' | 'confirmed' | 'cancelled'.
    *   `tickets`: Array of `{ ticketId, quantity, qrCodeData }`.
    *   `totalAmount`: Displayed on "My Tickets".

### **D. Hosts (`/hosts/{hostId}`)**
*   **Read:** Public.
*   **Fields:** `name`, `handle`, `avatar`, `followers`.

---

## 3. Core Logic & Algorithms

### **A. Home Feed (The "Heat" Sort)**
Sort events by `heatScore` (descending).
*   *Note:* The score is calculated on the server/website. The app just needs to **sort by this field**.

### **B. "For You" Recommendations**
Personalized feed algorithm (Client-Side Implementation):
1.  Fetch user's last 50 orders -> Extract `tags` and `hosts`.
2.  Fetch active events.
3.  **Score each event:**
    *   `+5` if tag matches user history.
    *   `+15` if host matches user history.
    *   `+10` if city matches user profile.
4.  Sort by Score.

### **C. Search**
*   Query the `keywords` array field on the Event document.
*   Allow filtering by `city` and `date`.

---

## 4. Critical Workflows

### **A. Ticket Purchase (Atomic Transaction)**
**Step-by-Step:**
1.  **User** selects Ticket Tier + Quantity.
2.  **App** starts Firestore Transaction.
3.  **Read** Event Doc -> Check `ticket.remaining >= quantity`.
4.  **Update** Event Doc -> `ticket.remaining -= quantity`.
5.  **Create** Order Doc -> Status `pending_payment`.
6.  **Commit** Transaction.
7.  **Payment:** Trigger Razorpay/Stripe.
8.  **Success:** Webhook (Backend) updates Order to `confirmed`.

### **B. "My Tickets" (QR Code)**
*   Fetch orders where `userId == auth.uid` AND `status == 'confirmed'`.
*   Display a **QR Code** containing the `orderId`.
*   *Security:* The QR code is just the Order ID. The Door Manager app will scan this to verify validity against the database.

### **C. Profile Management**
*   **Edit Profile:** User can update `displayName`, `city`, `instagram`.
*   **Avatar:** Upload image to `/profile-pictures/{uid}.jpg` -> Update `photoURL`.

---

## 5. API & Integrations (User Side)

### **A. Payment Gateway**
*   Use the **same API Keys** as the website.
*   Ensure the Gateway Webhook URL points to the **website's backend** (`/api/webhooks/payment`) so the database updates correctly.

### **B. Emails**
*   Emails are sent automatically by the backend when the Order becomes `confirmed`. The app does **not** need to send emails directly.

---

## 6. Development Checklist (User MVP)

### **Phase 1: Onboarding**
- [ ] **Auth:** Login/Signup with Firebase (Email/Password + Google).
- [ ] **Profile Setup:** Ask for "City" and "Name" on first login.

### **Phase 2: Discovery**
- [ ] **Home Screen:** "Trending" Carousel (Heat Score) + "This Week" (Date Sort).
- [ ] **Explore Screen:** Search Bar + Category Pills (Parties, Music, etc.).
- [ ] **Event Details:** Hero Image, Date/Time, Location Map, Host Link.

### **Phase 3: Checkout**
- [ ] **Ticket Modal:** Select Quantity (Max 10).
- [ ] **Checkout Logic:** Implement the Firestore Transaction.
- [ ] **Payment:** Integrate Razorpay/Stripe SDK.

### **Phase 4: Ticket Wallet**
- [ ] **My Tickets:** List of confirmed orders.
- [ ] **Ticket View:** QR Code + Event Details.
