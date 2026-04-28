# Partner Ecosystem Overview: Host, Venue & Promoter Dashboards

This document outlines the architecture, purpose, and structure of the three distinct dashboards housed within the `partner-dashboard` application. Together, these form the supply-side ecosystem of **THE C1RCLE**.

## 1. Architecture Overview

**Application:** `apps/partner-dashboard`  
**Framework:** Next.js (App Router)  
**Port:** 3001 (Dev)  
**Authentication:** Shared `DashboardAuthProvider` (Firebase Auth)  
**Styling:** Tailwind CSS + Framer Motion + Lucide Icons

The application uses a **Multi-Tenant / Multi-Role** approach where a single codebase serves three distinct user personas via separate route groups.

---

## 2. The Three Pillars

### A. Venue Dashboard (Venue OS)
**Route:** `/venue`  
**Target User:** Venue Owners, GMs, Security Heads, Operations Staff.  
**Purpose:** A "Venue Operating System" to manage the physical space, staff, and nightly operations. It is the "Hard" operational layer.

**Visual Identity:**
-   **Theme:** Light Mode (Professional, Clean, High Contrast).
-   **Palette:** Slate-50 background, Emerald accents for system status.
-   **Key UI Elements:** Fixed Sidebar, Top Bar with "System Online" pulse.

**Key Modules:**
-   **`/calendar`**: The single source of truth for scheduling.
-   **`/tables`**: Inventory management for VIP tables (Available/Reserved/Occupied).
-   **`/staff`**: RBAC for venue staff (bouncers, floor managers).
-   **`/security`**: Gate control and entry logs.
-   **`/registers`**: Digital operational logs (opening/closing notes, incidents).

---

### B. Host Dashboard (Event OS)
**Route:** `/host`  
**Target User:** Event Organizers, Party Planners, Independent Hosts (who may not own a venue).
**Purpose:** An "Event Management Suite" to create experiences, manage guest lists, and track partnerships. It is the "Soft" experiential layer.

**Visual Identity:**
-   **Theme:** Dark Mode (Cinematic, Night-time feel).
-   **Palette:** Black background, Indigo/Violet accents (`indigo-500`).
-   **Key UI Elements:** Glassmorphic headers, background ambient glows.

**Key Modules:**
-   **`/create`**: Event creation wizard.
-   **`/events`**: Lifecycle management of created events.
-   **`/partnerships`**: Managing relationships with Venues and Promoters.
-   **`/discover`**: Finding venues or promoters to collaborate with.
-   **`/analytics`**: Performance metrics for events.

---

### C. Promoter Dashboard (Sales OS)
**Route:** `/promoter`  
**Target User:** Affiliates, Influencers, PR Teams.
**Purpose:** A "Sales Command Center" for distributed marketing and ticket sales tracking.

**Visual Identity:**
-   **Theme:** Dark Mode (High Energy, Financial Focus).
-   **Palette:** Black background, Emerald/Green accents (`emerald-500` - representing money/success).
-   **Key UI Elements:** Minimalist layout, focused on numbers and links.

**Key Modules:**
-   **`/links`**: Generation of unique tracking links.
-   **`/stats`**: Real-time conversion and click analytics.
-   **`/payouts`**: Commission tracking and withdrawal requests.
-   **`/guests`**: Managing guest lists for their specific code.

---

## 3. Directory Structure

The structure separates these contexts at the top level of the `app` directory to ensure complete isolation of concerns and layouts.

```text
apps/partner-dashboard/app/
├── venue/                   # CLUB OS
│   ├── layout.tsx          # Light mode shell
│   ├── calendar/
│   ├── tables/
│   ├── security/
│   └── ...
├── host/                   # HOST OS
│   ├── layout.tsx          # Dark mode (Indigo) shell
│   ├── events/
│   ├── create/
│   └── ...
├── promoter/               # PROMOTER OS
│   ├── layout.tsx          # Dark mode (Emerald) shell
│   ├── links/
│   ├── stats/
│   └── ...
└── api/                    # Shared API routes
```

## 4. Shared Infrastructure

While the UI is distinct, they share underlying infrastructure:
*   **Authentication**: Users log in once; their claims/profile determine which dashboard routes they can access.
*   **Components**: Shared UI primitives (Buttons, Inputs) likely exist in a shared `components/ui` folder, or `package/ui`.
*   **Firebase**: All read from the same Firestore instance but access different collections (`venues`, `events`, `users`).
