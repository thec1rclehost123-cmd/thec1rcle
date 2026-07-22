# C1RCLE Ecosystem Blueprint

Here is the master blueprint of the entire C1RCLE ecosystem, explicitly including the **Frontend** (React Native UI), **Core** (Zustand State/Bridge), and **Backend** (API Gateway Fastify routes) for all 20 logical audit sections.

## 👑 The Core Ecosystems (Screen-by-Screen)

### ~~1. The Auth Flow~~ ✅
*   **Frontend UI:** `app/(auth)/*`
*   **Core (State/Bridge):** `store/authStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/auth.ts`, `apps/api-gateway/src/routes/v1/kyc.ts`
*   **Scope:** Phone login, OTP verification, and JWT session handling.

### ~~2. The Onboarding Flow~~ ✅
*   **Frontend UI:** `app/onboarding.tsx`, `app/profile-creation.tsx`, `app/profile-setup.tsx`, `app/location-permission.tsx`, `app/notification-permission.tsx`
*   **Core (State/Bridge):** `store/profileStore.ts`, `lib/onboardingFlow.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/profiles.ts`, `apps/api-gateway/src/routes/v1/users.ts`
*   **Scope:** The critical first-time user experience, capturing avatars, names, and native permissions.

### ~~3. The Explore Feed~~ ✅
*   **Frontend UI:** `app/(tabs)/explore.tsx`, `app/explore/*`
*   **Core (State/Bridge):** `store/eventsStore.ts`, `store/recommendationsStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/discovery.ts`, `apps/api-gateway/src/routes/v1/events.ts`, `apps/api-gateway/src/routes/v1/recommendations.ts`
*   **Scope:** The primary home screen displaying event drops, curated lists, and recommendations.

### ~~4. Global Search & Map~~ ✅
*   **Frontend UI:** `app/search.tsx`, `app/map.tsx`, `app/events/*`
*   **Core (State/Bridge):** `store/eventsStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/search.ts`
*   **Scope:** The city picker, global text search, and the map-based discovery view.

### ~~5. The Event Detail Screen~~ ✅
*   **Frontend UI:** `app/event/[id].tsx`
*   **Core (State/Bridge):** `store/eventInterestStore.ts`, `store/venuePageStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/events.ts`, `apps/api-gateway/src/routes/v1/event-viewer-state.ts`
*   **Scope:** The critical conversion screen where users view event details and select ticket tiers.

### ~~6. The Checkout Ecosystem~~ ✅
*   **Frontend UI:** `app/checkout/*`
*   **Core (State/Bridge):** `store/cartStore.ts`, `lib/payments.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/checkout.ts`, `apps/api-gateway/src/routes/v1/payments.ts`, `apps/api-gateway/src/routes/v1/promos.ts`
*   **Scope:** The Razorpay handoff, live pricing calculator, and success animations.

### ~~7. The Tickets Wallet~~ ✅
*   **Frontend UI:** `app/(tabs)/tickets.tsx`, `app/(tabs)/wallet.tsx`
*   **Core (State/Bridge):** `store/ticketsStore.ts`, `lib/wallet.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/orders.ts`, `apps/api-gateway/src/routes/v1/tickets.ts`
*   **Scope:** The Apple/Google Wallet integration and the QR code presentation screen.

### ~~8. Ticket Management & Transfer~~ ✅
*   **Frontend UI:** `app/ticket/*`, `app/transfer/*`
*   **Core (State/Bridge):** `lib/transfers.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/tickets.ts` (specifically transfer endpoints)
*   **Scope:** The secure handoff of tickets to other users (QR rotation and transfer links).

### ~~9. The Venues Directory~~ ✅
*   **Frontend UI:** `app/(tabs)/venues.tsx`
*   **Core (State/Bridge):** `store/venuesStore.ts`, `lib/venueDiscovery.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/venues.ts`
*   **Scope:** The curated list of clubs, bars, and spaces in a city.

### 10. The Venue Profile Screen
*   **Frontend UI:** `app/venue/[id].tsx`
*   **Core (State/Bridge):** `store/venuePageStore.ts`, `store/followStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/venues.ts`, `apps/api-gateway/src/routes/v1/venue-settings.ts`
*   **Scope:** Floor plans, upcoming events at the venue, menus, and the "Follow" button.

### ~~11. The Dating Ecosystem~~ ✅
*   **Frontend UI:** `app/(tabs)/dating.tsx`, `app/dating/*`
*   **Core (State/Bridge):** `store/datingStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/matching.ts`
*   **Scope:** The C1rcle dating UI, swiping mechanics, and match modals.

### 12. The Inbox & Social Hub
*   **Frontend UI:** `app/(tabs)/inbox.tsx`, `app/(tabs)/social.tsx`, `app/social/*`
*   **Core (State/Bridge):** `store/chatStore.ts`, `lib/chat.ts`, `lib/websocket.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/chats.ts`, `apps/api-gateway/src/routes/v1/social.ts`
*   **Scope:** Direct messaging, Event Group Chats, and connection requests.

### ~~13. The Notifications Center~~ ✅
*   **Frontend UI:** `app/notifications.tsx`
*   **Core (State/Bridge):** `store/notificationsStore.ts`, `lib/notifications.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/guest-notifications.ts`, `apps/api-gateway/src/routes/v1/notifications.ts`
*   **Scope:** Expo push token registration, local reminders, and the in-app activity feed.

### ~~14. The User Profile~~ ✅
*   **Frontend UI:** `app/(tabs)/profile.tsx`, `app/profile/*`
*   **Core (State/Bridge):** `store/profileStore.ts`, `store/socialProfileStore.ts`, `store/followStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/guest-profiles.ts`, `apps/api-gateway/src/routes/v1/social-likes.ts`
*   **Scope:** The user's public-facing persona, saved events, and followed venues/hosts.

### 15. Account Settings
*   **Frontend UI:** `app/settings.tsx`, `app/settings/*`
*   **Core (State/Bridge):** `store/settingsStore.ts`, `store/subscriptionStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/users.ts`, `apps/api-gateway/src/routes/v1/subscriptions.ts`
*   **Scope:** Payment methods, notification preferences, dark mode toggles, and account deletion.

### 16. The Admin Scanner Flow
*   **Frontend UI:** `app/scanner/*`
*   **Core (State/Bridge):** `store/scannerStore.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/scan.ts`, `apps/api-gateway/src/routes/v1/door.ts`, `apps/api-gateway/src/routes/v1/staff.ts`
*   **Scope:** The high-speed QR scanning interface used by bouncers and hosts at the door.

---

## 📦 Grouped / Secondary Sections

### ~~17. Waitlists & Attendees~~ ✅
*   **Frontend UI:** `app/waitlist/*`, `app/going/*`
*   **Core (State/Bridge):** *(Handled dynamically by event stores)*
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/waitlist.ts`
*   **Scope:** Joining sold-out lists and viewing the public "Who's Going" rosters.

### 18. Host Verification & Claiming
*   **Frontend UI:** `app/claim/*`, `app/verification/*`
*   **Core (State/Bridge):** *(Stateless forms / direct API calls)*
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/kyc.ts`, `apps/api-gateway/src/routes/v1/host.ts`
*   **Scope:** The forms used by venue owners/promoters to verify their identity and claim their page.

### 19. Social Graph Setup
*   **Frontend UI:** `app/social-setup/*`
*   **Core (State/Bridge):** `lib/social/*`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/social.ts`
*   **Scope:** Syncing phone contacts and inviting friends to the platform.

### 20. Support & Legal
*   **Frontend UI:** `app/help.tsx`, `app/safety/*`, `app/legal/*`
*   **Core (State/Bridge):** `lib/safety.ts`
*   **API Gateway (Backend):** `apps/api-gateway/src/routes/v1/admin.ts`
*   **Scope:** Customer support, Terms of Service, Privacy Policy, and emergency safety features.
