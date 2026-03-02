# 🧭 The C1rcle: Developer Onboarding & KT Guide

Welcome to **The C1rcle!** This document is designed to get you up and running in our monorepo within your first 1–2 days. We are currently stabilizing for an MVP launch, meaning your primary job is to **squash bugs quickly** and understand how state flows across the system. 

---

## 1️⃣ PROJECT OVERVIEW (HIGH LEVEL)

### What is The C1rcle?
The C1rcle is an end-to-end ticketing, discovery, and event management platform. It allows consumers to discover premium nightlife events, buy tickets securely, and provides venues/promoters with the tools to manage attendees at the door.

### Main User Roles
- **Guest / Consumer:** Browses events, buys tickets, manages their profile, and views their QR codes.
- **Partner (Host / Venue / Promoter):** Creates events, manages dynamic pricing, sets up promo codes, and scans guests at the door.
- **Admin:** The overarching platform managers. They approve events, moderate users, and manually review high-value customer refunds.

### The Golden Path (Core Flow)
1. **Partner** creates an event in the Partner Dashboard.
2. **Guest** discovers the event on the Guest Portal homepage.
3. **Guest** pays for tickets via Razorpay (Stripe alternative).
4. System generates an order and sends a QR code ticket.
5. **Venue Staff** uses the Scanner App to scan the Guest's QR code at the door.

---

## 2️⃣ MONOREPO STRUCTURE EXPLAINED

We use **Turborepo** to manage multiple apps inside a single repository. This allows us to share UI components and configurations instantly.

### The Apps (`apps/`)
- **`guest-portal`**: The consumer-facing Next.js website (`/explore`, `/checkout`). *You will fix most UI/Frontend bugs here.*
- **`partner-dashboard`**: The B2B Next.js tool for organizers (`/host/create`, `/venue/analytics`). *Heavy use of complex forms and wizards.*
- **`admin-console`**: The internal Next.js tool for our staff (`/refunds`, `/approvals`).
- **`mobile-app`**: A React Native (Expo) consumer app mirroring the Guest Portal. *(Currently in development, secondary priority).*
- **`scanner-app`**: A React Native (Expo) app for bouncers to scan QR codes.
- **`api-gateway`**: A Fastify Node.js server that sits between the frontend and the database to cache data and speed up requests.

### The Packages (`packages/`)
- **`packages/ui`**: Our custom design system! All buttons, modals, and layouts live here. **Always** import from `@c1rcle/ui` before building a new component from scratch.
- **`packages/core`**: Contains our standalone backend "Engines" (e.g., `pricing-engine.js`, `order-engine.js`).

---

## 3️⃣ FRONTEND ARCHITECTURE GUIDE

### Next.js App Router
Our web apps use the **Next.js 14 App Router**. 
- Routing is folder-based inside the `app/` directory (e.g., `app/checkout/[eventId]/page.jsx`).
- We heavily utilize server components by default, adding `"use client";` at the top of files that need interactivity (like forms or buttons).

### State Management (Zustand)
We use **Zustand** instead of Redux or Context for most global state.
- Stores live in the `store/` folders.
- Examples: `useCartStore` (holds what tickets the user wants to buy), `useAuthStore` (holds the current user session).
- Zustand is often hooked up to `localStorage` so if a user refreshes the page, their cart doesn't disappear.

### Shared UI & Styling
- We use **TailwindCSS** for all styling. Do not write custom CSS files if a utility class exists.
- We use **Framer Motion** (`<motion.div>`) for all complex animations (fade-ins, route transitions).

---

## 4️⃣ IMPORTANT FILES EVERY DEV MUST KNOW

1. **`apps/guest-portal/components/CheckoutContainer.jsx`**
   - *What it does:* The massive, complex 3-step funnel where users pay for tickets. If checkout breaks, this is the file to check first.
2. **`apps/guest-portal/components/providers/GlobalAuthManager.jsx`**
   - *What it does:* Handles Firebase Authentication. It listens for login/logout events and sets the global user state across the Next.js app.
3. **`apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx`**
   - *What it does:* The 8-step form Partners use to create events. It automatically saves drafts to `localStorage` every 3 seconds to prevent data loss.
4. **`packages/ui/src/index.ts`**
   - *What it does:* The library exporter. If you add a new shared button, you must export it here for the other apps to use it.
5. **`firebase.json` & `firestore.rules`**
   - *What it does:* Defines the strict security rules for our Firebase database. If your frontend gets a "Permission Denied" error, these rules are blocking you.

---

## 5️⃣ SCREEN FLOW EXPLANATION

### Checkout Flow (The Money Maker)
`Event Page (/event/[id])` → User clicks "Buy" → `/checkout/[eventId]` loads via `CheckoutContainer.jsx`.
1. User selects Ticket Quantity. Check against `maxTicketsPerOrder`.
2. App reserves tickets via backend API. Cart Timer starts (expires in ~10 mins).
3. Razorpay payment modal opens.
4. Payment successful → User redirected to `/confirmation/[id]`.

### Partner Event Creation Flow
`Host Dashboard` → Clicks "Create Event" → `CreateEventWizardV2.tsx` loads.
1. Steps 1-8: Collects imagery, date, schedule, and pricing tiers.
2. State is auto-saved as a "Draft".
3. Partner clicks "Publish" → Event changes to `status: 'active'` (or sends a request to the Venue to approve it).

---

## 6️⃣ HOW FRONTEND TALKS TO BACKEND

We have two ways of talking to the backend:

1. **The Fastify API Gateway (`apps/api-gateway`)**
   - **Used for:** Heavy operations like Checkout, Checking Promo Codes, and fetching feeds.
   - **How to call it:** Standard `fetch()` using the `NEXT_PUBLIC_GATEWAY_URL` env variable.
   - **Auth:** You must attach a Firebase ID Token. Example:
     ```javascript
     const token = await user.getIdToken();
     fetch(`${NEXT_PUBLIC_GATEWAY_URL}/api/checkout`, { 
         headers: { 'Authorization': `Bearer ${token}` } 
     });
     ```

2. **Direct Firebase SDK**
   - **Used for:** Real-time updates (like Live Chat or seeing Venue capacity increase live). 
   - **How to call it:** Using Firebase `onSnapshot` inside `useEffect` hooks.

---

## 7️⃣ BUG FIXING GUIDE FOR NEW DEVS

You are here to fix bugs! Here is how to find them fast:

- **"My UI isn't updating!"** → You are probably mutating a Zustand store directly instead of using the provided action function. State is immutable.
- **"I got a 401 / 403 API Error!"** → Your Firebase authentication token is likely missing or expired. Check `await user.getIdToken(true)` to force a refresh.
- **"The Checkout is hanging!"** → Open the Network Tab. If `/api/checkout/reserve` succeeds but the Razorpay modal doesn't pop up, the frontend logic handling the Razorpay SDK injection failed.
- **Debugging Zustand:** You can add `console.log(useCartStore.getState())` anywhere to instantly dump the global cart state into the console.

---

## 8️⃣ LOCAL DEVELOPMENT SETUP GUIDE

1. **Install Dependencies:** (Must have Node 18+)
   ```bash
   npm install
   ```
2. **Environment Variables:**
   - Copy `.env.staging` to `.env.local` inside **both** `guest-portal` and `partner-dashboard`.
   - Ask your lead for the `.env` file for the `api-gateway`.
3. **Run the World:**
   ```bash
   # Runs all web apps locally in parallel
   npm run dev
   ```
   - Guest Portal: `localhost:3000`
   - Partner Dashboard: `localhost:3001`
   - Admin Console: `localhost:3002`

---

## 9️⃣ CODING STANDARDS & RULES

- **Check `@c1rcle/ui` First:** Before building a custom modal or button, look in `packages/ui`. If it exists, use it.
- **Client vs Server Components:** Keep interactive pieces (`"use client"`) as deep in the component tree as possible. Don't make an entire page a client component just for one button.
- **Typescript is King:** `partner-dashboard` and `mobile-app` are strictly typed. Write interfaces. `guest-portal` is currently Javascript, but use JSDoc where possible.
- **Commits:** Use conventional commits (`fix: checkout crash`, `feat: added promo UI`).

---

## 🔟 MVP CRITICAL AREAS (DO NOT BREAK)

Be **extremely careful** when modifying code in these areas. If these break, the business halts:

🚨 **`CheckoutContainer.jsx` & `lib/payments.ts`:** This is our revenue engine. Modifying how totals are calculated or how Razorpay initializes can cause instant financial loss or overselling.
🚨 **`CreateEventWizardV2.tsx`:** An incredibly fragile state-machine. Editing step validation logic without thorough testing can prevent partners from publishing events.
🚨 **`AuthModal.jsx`:** If users can't login, they can't buy tickets. Avoid aggressive refactors here unless explicitly tasked to do so.
