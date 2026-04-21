# 🛡️ THE C1RCLE - Admin Panel: The Complete Rundown

Welcome to the central nervous system of **THE C1RCLE**. This document provides a detailed, plain-English breakdown of every feature, button, and insight built into the Admin Panel.

---

## 🏛️ The "Final Admin" Philosophy
The Admin Panel is designed with **Hard Separation**. It lives on its own domain, has its own login rules, and uses a "Default Deny" security model.
*   **No "Remember Me"**: Every entry requires a fresh login.
*   **Idle Timeout**: If you leave your desk for 30 minutes, you are automatically logged out.
*   **Leash of Least Privilege**: A Support Admin cannot see Finance data, and a Finance Admin cannot cancel events.

---

## 🧭 Navigation: The Sidebar
The fixed left sidebar is your map. It only shows you what you are authorized to see.
1.  **Home**: The command center.
2.  **Approvals**: The Dual-Sign-Off queue (New).
3.  **Users**: Managing individual people.
4.  **Venues**: Managing venues, bars, and spaces.
5.  **Hosts**: Managing event organizers and their applications.
6.  **Events**: Controlling individual party/event listings.
7.  **Payments**: The financial ledger and refund hub.
8.  **Support**: Solving user issues.
9.  **Safety**: Moderation and reports.
10. **Admins**: Managing the staff and their power levels (Super Admin only).
11. **Settings**: Global platform constants.
12. **Audit Log**: The permanent list of everything every admin does.
13. **System Health**: Monitoring webhooks and external providers (New).

---

## �️ Page 2: Governance Pipeline (Approvals)
High-risk actions don't happen instantly. 
*   **Proposed Actions**: View any action (Refund, Role Change, Maintenance Toggle) that is currently waiting for a second signature.
*   **Authorization Interface**: A manager or peer can review the "Before/After" state, the evidence provided, and either **Execute** or **Reject** the change.
*   **Audit Link**: Every approval is linked back to the original proposal for perfect accountability.

---

## 🏥 Page 13: Platform Health (System Health)
Monitoring the technical backbone.
*   **Webhook Monitor**: Real-time list of failed communications with Razorpay or Firebase.
*   **Retry Engine**: A "Re-Dispatch" button to manually fix stalled payments or updates.
*   **Node Status**: Live check on "Firebase Core," "Vision AI Node," and "CDN Edge."

---

## 🕵️ Page 12: Audit Registry
The history book of THE C1RCLE.
*   Shows exactly **Who** did **What**, **When**, and **Why**.
*   It captures **Device Context**: IP addresses and browser signatures for every sensitive click.
*   It captures "Before" and "After" snapshots. (e.g., "Admin A changed Fee from 10% to 15%").

---

## � Pro-Grade Data Exports
Every data table (Users, Venues, Logs) now includes a **CSV Export** capability. These exports are themselves audited, ensuring data leakage is tracked.

---

## 🎨 Visual Language
*   **Black/Slate Theme**: Signals authority and focus.
*   **Indigo Highlights**: Used for primary actions and "trust" elements.
*   **Rose/Red**: Used strictly for emergency halts and capital outflows.
*   **Glassmorphism**: Subtle blurs to make the interface feel premium and expensive.

---
**END OF RUNDOWN (PRODUCTION COMPLIANT)**
