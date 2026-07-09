# THEC1RCLE SaaS – Support Module & Ticket Merging Documentation

This document logs all features, bug fixes, database schema updates, and user interface improvements implemented for the support module across the **Admin Console**, **Partner Dashboard**, and **API Gateway**.

---

## 1. Ticket Merging Design & Firestore Schema

To manage duplicate support requests, administrators can merge a duplicate ticket into a primary ticket.

### Database Schema Mappings
* **Collection Name**: `support_tickets`
* **Primary Document**: Updates to include consolidated timelines, messages, and attachments.
* **Duplicate Document**: Marked as closed and linked to the primary ticket.
  * `status`: Set to `"closed"`
  * `mergedInto`: `string` (The full Firestore document ID of the primary ticket).

### Merging Actions (`mergeDuplicateSupportTicket` in `adminStore.js`)
1. **Self-Merge Guard**: Throws a `400 Bad Request` if the duplicate ticket resolves to the same ID as the primary ticket.
2. **Already-Merged Guard**: Validates that neither ticket has been previously merged (avoids loop merging).
3. **Dual-Lookup Matching**: Resolves the duplicate ticket by either its exact Firestore document ID or the 8-character short suffix displayed on the UI (case-insensitive search).
4. **Timeline Merge**: Logs chronological records of the merge events in both documents.
5. **Message Thread Merging**: Prefixes duplicate ticket replies with `[Merged from ticket SHORT_ID]` and sorts the consolidated feed chronologically by timestamp.
6. **Attachment Consolidation**: Merges all duplicate screenshot images (`images`) and screen recording documents (`documents`) into the primary ticket arrays without duplication.

---

## 2. Admin Console Support Desk UI & UX Enhancements

Located in `apps/admin-console/app/support/page.jsx`:

* **Merged Status Pill**: Renders a dedicated indigo `MERGED` status pill for duplicate closed/linked tickets.
* **Merge Info Banner**: Renders a notification banner at the top of the details panel showing the primary ticket link.
* **Direct Navigation**: Adds a **"Go to Primary Ticket"** button to automatically switch selection to the primary ticket.
* **Control Locking**: Disables public replies, internal notes, category linking, and further merge inputs on already merged tickets to prevent data corruption.
* **Attachments Tab**: Added an **Attachments** tab under the ticket control drawer, rendering uploaded screenshots as a zoomable grid and screen recordings as HTML5 `<video>` players.
* **Unified Control Toolbar**: Replaced duplicate search bars and refresh buttons with a single central toolbar. Clears queries dynamically when changing views.

---

## 3. Support Category Mappings

Support requests in the partner dashboard are routed to 9 distinct departments with specific subcategories:

| Department | Subcategories |
| :--- | :--- |
| **Account** | Login Issues, Password Reset, Email Verification, Phone Verification, Team Access, Role Permission Issues |
| **Event Management** | Unable to Publish Event, Event Approval Delay, Event Rejected, Event Not Visible, Editing Event Issues, Event Cancellation |
| **Ticketing** | Ticket Inventory Problems, Incorrect Pricing, Discount Issues, Promo Code Issues, QR Code Problems, Guest List Issues, Ticket Transfer Issues |
| **Payments & Finance** | Subscription Billing, Failed Payment, Refund Request, Payout Delay, Commission Issues, Invoice Request, GST & Tax Issues |
| **Door Management** | Scanner Not Working, Check-in Failed, Duplicate Entry, Walk-in Entry Issue, Offline Entry Problems |
| **Partners** | Host Connection Issues, Promoter Connection Issues, Duplicate Partnership Requests, Partnership Approval, Remove Partner Request |
| **Marketing** | WhatsApp Broadcast Issues, Email Campaign Issues, Audience Management, Push Notification Problems |
| **Analytics** | Revenue Mismatch, Missing Reports, Incorrect Statistics |
| **Technical** | Dashboard Bug, Slow Performance, Dashboard Crash, Mobile Responsiveness Issues, Browser Compatibility, Feature Not Working |

---

## 4. API & Backend Resolutions

* **Ticketing Archives Listing Fix**: Bypassed Firestore composite index requirements by querying collections and performing memory-based array sorting on the API Gateway (`apps/api-gateway/src/routes/v1/support.ts`).
* **Platform Bulletins Whitelist**: Registered the `platform_announcements` collection in the Admin List validation API route (`apps/admin-console/app/api/list/route.js`) for Super, Admin, Ops, and Support roles, allowing authentic bulletins to show up.
* **Dependency & Library Audits**: Resolved runtime `ReferenceError` warnings by properly importing `AnimatePresence`, `motion`, `FileImage`, `GitMerge`, and `ArrowRight` icon components.
