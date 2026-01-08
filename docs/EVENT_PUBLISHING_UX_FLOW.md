# THE C1RCLE — Event Publishing UX Flow Specification

> Complete end-to-end user journey for publishing an event and making it visible across the User Website (Guest Portal), Venue/Host Dashboard (Partner Dashboard), and Promoter Dashboard.

---

## Table of Contents

- [Global Rules and Visibility Logic](#global-rules-and-visibility-logic)
- [Part A: Publish Event and Distribute Across Portals](#part-a-publish-event-and-distribute-across-portals)
  - [A1. Venue or Host Publishes the Event](#a1-venue-or-host-publishes-the-event)
  - [A2. Event Appears in Venue/Host Dashboard Events Section](#a2-event-appears-in-venuehost-dashboard-events-section)
  - [A3. Promoter Access Toggle and Partner Management](#a3-promoter-access-toggle-and-partner-management)
  - [A4. Event Appears in Promoter Dashboard Events Section](#a4-event-appears-in-promoter-dashboard-events-section)
  - [A5. Promoter Creates Unique Trackable Links](#a5-promoter-creates-unique-trackable-links)
- [Part B: Guest Flow on User Website — Discovery to Tickets](#part-b-guest-flow-on-user-website--discovery-to-tickets)
  - [B1. Guest Lands on User Website](#b1-guest-lands-on-user-website)
  - [B2. Guest Searches and Finds the Event](#b2-guest-searches-and-finds-the-event)
  - [B3. Event Detail Page Viewing Flow](#b3-event-detail-page-viewing-flow)
  - [B4. Authentication Gate Before Purchase](#b4-authentication-gate-before-purchase)
  - [B5. Ticket Selection and Checkout](#b5-ticket-selection-and-checkout)
  - [B6. Purchase Confirmation and Ticket Delivery](#b6-purchase-confirmation-and-ticket-delivery)
  - [B7. Viewing Bought Tickets in Tickets Section](#b7-viewing-bought-tickets-in-tickets-section)
  - [B8. Returning to Event and Post-Purchase Behavior](#b8-returning-to-event-and-post-purchase-behavior)
- [Part C: Cross-Portal Consistency and State Changes](#part-c-cross-portal-consistency-and-state-changes)
  - [C1. Promoter Toggle Turned OFF After Links Created](#c1-promoter-toggle-turned-off-after-links-created)
  - [C2. Event Edited After Publishing](#c2-event-edited-after-publishing)
  - [C3. Event Unpublished or Canceled](#c3-event-unpublished-or-canceled)

---

## Global Rules and Visibility Logic

### Event Visibility to Guests
- Events **only appear** to guests on the User Website after:
  1. The event is **published** by the Venue or Host
  2. The event passes all required **visibility checks** (valid date, venue, at least one ticket tier)
  3. The event status is **not** Draft, Unpublished, or Canceled

### Event Visibility to Creators (Venue/Host)
- The creator of the event (Venue or Host) **always** sees the event in their Partner Dashboard → Events section after creation
- Events display with clear **status labels**: Draft, Published, Unpublished, Canceled, Completed
- All lifecycle states are visible to the creator regardless of public visibility

### Event Visibility to Promoters
Promoters **only** see the event in their Promoter Dashboard → Events section if **all** of the following are true:
1. **Promoter Access toggle** is turned **ON** for the event by the Venue or Host
2. The promoter is **partnered** with the Venue or Host (either for this specific event or at the entity level)
3. The promoter is **selected** for access (either "All partnered promoters" or specifically chosen)
4. The promoter account is **approved** to access promoter tools

### Promoter Link Capabilities
- Promoters who see the event can **generate unique trackable links**
- Each link has a unique identifier for attribution tracking
- Links can be used for distribution across any channel

### Guest Authentication Rules
- Guests can **browse and view** events **without logging in**
- Guests **must log in or sign up** to:
  - Buy tickets
  - RSVP to events
  - Like events
  - Save events to their profile

### Ticket Ownership
- Ticket purchase completes on the User Website
- After successful purchase, tickets appear in the guest's **Tickets** section
- Tickets are tied to the authenticated user account

---

## Part A: Publish Event and Distribute Across Portals

---

### A1. Venue or Host Publishes the Event

**Actor:** Venue or Host

**Entry Point:** Partner Dashboard → Events → Drafts **OR** Partner Dashboard → Create Event

---

#### Step 1: Open the Event Draft

1. Venue or Host navigates to **Partner Dashboard**
2. Clicks **Events** in the sidebar navigation
3. Selects the **Drafts** tab (if event already exists as draft), or clicks **Create Event** button
4. Clicks on the event card to open the event editor

**UI Display:**
- Full event preview shown exactly as it will appear when published
- Preview panel on one side, editable fields on the other side
- Clear visual separation between preview and editing modes
- "Draft" status badge displayed prominently

---

#### Step 2: Complete All Required Fields

**System performs automatic validation before allowing publish:**

| Validation Check | Requirement |
|------------------|-------------|
| Event Name | Present and non-empty |
| Date and Time | Valid, and in the future |
| Venue | Present with valid address |
| City | Selected from available list |
| Ticket Tiers | At least one tier defined |
| Tier Prices | Valid price for each tier (can be zero for free events) |
| Tier Limits | Capacity limit set for each tier |
| Sales Window | Start and end dates defined, start is before end, end is before or at event date |
| Banner Image | Uploaded and meets minimum resolution requirements |
| Poster Image | Uploaded and meets minimum quality requirements |
| Terms (if required) | Terms and conditions selected or entered |
| Refund Rules (if required) | Refund policy selected |
| Age Rules (if required) | Age restriction rule selected |

**UI Display for Incomplete Fields:**
- Fields with errors show red border and inline error message
- A validation summary panel lists all incomplete items
- "Publish" button is **disabled** until all validations pass
- Each incomplete item is clickable and jumps to that section

---

#### Step 3: Click Publish Button

1. Once all validations pass, the **Publish** button becomes enabled
2. Venue or Host clicks **Publish**

**UI Display:**
- Publish button changes to loading state
- Confirmation modal appears

---

#### Step 4: Review Confirmation Modal

**Confirmation Modal Contents:**

**Section: Event Summary**
| Field | Value |
|-------|-------|
| Event Name | [Event name] |
| Date & Time | [Formatted date and time] |
| Venue | [Venue name, city] |
| Starting Price | [Lowest tier price] |
| Total Capacity | [Sum of all tier limits] |
| Sales Start | [Sales window start date] |
| Sales End | [Sales window end date] |

**Section: Warnings (if applicable)**
Display warning banners if any of the following are detected:
- Low quality poster (below recommended resolution)
- Missing refund policy
- Missing age policy
- Very short sales window (less than 24 hours before event)
- Capacity seems unusually high or low
- No description provided

**Warning Banner UI:**
- Yellow/amber background
- Warning icon
- Clear description of the issue
- (Optional) "Fix Now" link to jump to that section

**Modal Buttons:**
- **Cancel** — Closes modal, returns to editor, no changes made
- **Publish Now** — Proceeds with publishing

---

#### Step 5: Confirm and Publish

1. Venue or Host clicks **Publish Now**
2. Modal closes
3. System processes the publish action

---

#### Step 6: Success State

**UI Changes After Successful Publish:**

1. **Toast Notification:**
   - Green success toast appears
   - Message: "Event published successfully"
   - Auto-dismisses after 4 seconds

2. **Status Chip Update:**
   - Event status chip changes from "Draft" to "Published"
   - Chip color changes from gray/neutral to green/active

3. **Primary Actions Appear:**
   | Action Button | Description |
   |---------------|-------------|
   | View on Website | Opens the live event page on User Website in new tab |
   | Share | Opens share modal with copy link, social share options |
   | Manage Tickets | Opens ticket tier management section |
   | Guest List Toggle | Toggle to show/hide guest list on public event page |
   | Interested List | Always visible, shows count of interested users (read-only) |
   | Promoter Access | Toggle and management section for promoter distribution |

4. **Redirect:**
   - User remains on the event detail page in dashboard
   - Page refreshes to show published state and new action buttons

---

#### Error States During Publish

| Error Condition | UI Response |
|-----------------|-------------|
| Network failure | Error toast: "Failed to publish. Check your connection and try again." Retry button. |
| Server error | Error toast: "Something went wrong. Please try again." |
| Validation error discovered on server | Modal reappears with specific errors listed. User must fix before retrying. |
| Concurrent edit conflict | Warning: "This event was modified elsewhere. Please refresh and try again." |

---

### A2. Event Appears in Venue/Host Dashboard Events Section

**Actor:** Venue or Host

**Location:** Partner Dashboard → Events → Published

---

#### Step 1: Navigate to Published Events

1. Venue or Host clicks **Events** in sidebar
2. Clicks **Published** tab
3. Published events list loads

---

#### Step 2: View Event Card

**Event Card UI Contains:**

| Element | Description |
|---------|-------------|
| Event Poster Thumbnail | Small thumbnail image of event poster |
| Event Name | Full event title |
| Date | Formatted event date and time |
| Venue | Venue name |
| Status Badge | "Published" in green chip |
| Views | Number of page views |
| Likes | Number of likes received |
| Tickets Sold | Count of tickets sold |
| Revenue | Total revenue (if available and applicable) |
| Interested Count | Number of users who marked interested |
| **Manage** Button | Opens full event management view |
| **View** Button | Opens live event page on User Website |
| **Share** Button | Opens share modal |

---

#### Step 3: Open Event Detail Inside Dashboard

1. Venue or Host clicks **Manage** on an event card
2. Full event management view opens

**UI Tabs Inside Event Detail View:**

##### Tab: Overview
| Section | Contents |
|---------|----------|
| Event Preview | Visual preview of how event appears to guests |
| Share Link | Copyable URL to event page |
| Performance Metrics | Views, likes, saves, shares over time (graph if applicable) |
| Quick Stats Cards | Tickets sold, revenue, capacity remaining, interested count |

##### Tab: Tickets
| Section | Contents |
|---------|----------|
| Tier List | All ticket tiers with name, price, sold count, remaining |
| Tier Actions | Edit tier, pause sales, adjust quantity |
| Pricing | Current price, any discounts active |
| Capacity | Per-tier and total capacity display |
| Sales Window | Current sales window status (Open, Scheduled, Closed) |

##### Tab: Orders
| Section | Contents |
|---------|----------|
| Order List | Table/list of all purchases |
| Order Columns | Order ID, buyer name, email, tier, quantity, amount, date, status |
| Filters | Date range, tier, status, search by buyer |
| Export Action | Button to export orders (if allowed by subscription/permissions) |
| Order Detail | Click row to see order details, ticket codes, payment info |

##### Tab: Guest List
| Section | Contents |
|---------|----------|
| Toggle | Guest List visibility: ON or OFF |
| Explanation | When ON: "Guests who purchased can be shown on the event page" |
| Explanation | When OFF: "Guest list is hidden from public view" |
| Preview | List of attendees if toggle is ON |

*Note: This is separate from the **Interested** feature which cannot be disabled.*

##### Tab: Interested List
| Section | Contents |
|---------|----------|
| Count | Total number of users who clicked "Interested" |
| List | Names/avatars of interested users (if shown) |
| Note | "This list is always visible to you and counts are public" |

##### Tab: Promoter Access
| Section | Contents |
|---------|----------|
| Toggle | Promoters ON or OFF |
| Partner Selection | Choose which promoters have access |
| Link Rules | Promo link settings and restrictions |
| Performance | Promoter-attributed metrics (clicks, sales, revenue) |

---

### A3. Promoter Access Toggle and Partner Management

**Actor:** Venue or Host

**Location:** Event Detail View → Promoter Access Tab

---

#### Step 1: View Promoter Access Section

**UI Display:**

1. **Main Toggle:**
   - Label: "Promoter Access"
   - Toggle switch: ON / OFF
   - Current state clearly indicated

2. **Description Text:**
   - When **OFF**: "Promoters cannot see this event or create distribution links"
   - When **ON**: "Partnered promoters can see this event and generate unique trackable links"

3. **If toggle is currently OFF:**
   - Toggle is the primary element
   - Below shows: "Turn on to allow promoter distribution"

---

#### Step 2: Turn Promoters ON

1. Venue or Host clicks the toggle to turn it **ON**
2. Toggle animates to ON state
3. Partner gating section expands below

---

#### Step 3: Select Promoter Access Level

**Partner Gating Screen UI:**

**Section: Eligible Promoters**
- Heading: "Select which promoters can access this event"
- Subtext: "Only promoters partnered with you will see this event"

**Selection Options:**

| Option | Description |
|--------|-------------|
| **All Partnered Promoters** | Radio/toggle option. All promoters who have an active partnership with this Venue/Host |
| **Specific Promoters** | Radio/toggle option. Opens multi-select list |

**If "Specific Promoters" Selected:**
- Searchable list of partnered promoters
- Each promoter row shows:
  - Profile image/avatar
  - Promoter name
  - Partnership status (Active, Pending)
  - Checkbox to select/deselect
- "Select All" and "Deselect All" quick actions
- Selected count displayed: "3 promoters selected"

---

#### Step 4: Configure Optional Controls (If Present)

**Optional Settings Section:**

| Setting | Description |
|---------|-------------|
| Commission/Payout Display | Read-only text showing any applicable commission structure |
| Allowed Channels | Checkboxes or tags for allowed distribution channels (Instagram, WhatsApp, X, Offline, etc.) |
| Allowed Discount Codes | List of promo codes promoters can use with their links |
| Banned Terms | Terms or phrases promoters should not use in their distribution |

*Note: These are display and configuration only, no implementation details shown.*

---

#### Step 5: Save Promoter Settings

1. Venue or Host clicks **Save** or **Confirm**
2. System processes and saves settings

**Success State:**

1. **Toast Notification:**
   - Green success toast
   - Message: "Promoters enabled for this event"
   - Auto-dismisses after 4 seconds

2. **UI Update:**
   - Toggle remains ON
   - Selected promoters list displays below toggle
   - "Edit" link appears to modify selection

3. **System Effect:**
   - Event now appears in the Events section of selected promoters' dashboards
   - Promoters can now generate trackable links

---

#### Error States

| Error Condition | UI Response |
|-----------------|-------------|
| No partnered promoters exist | Message: "You don't have any partnered promoters yet. Go to Connections to invite promoters." Link to Connections page. |
| Save fails | Error toast: "Failed to update promoter access. Please try again." |
| Promoter partnership expired during selection | Warning in list: "Partnership with [Name] has expired" — cannot be selected |

---

### A4. Event Appears in Promoter Dashboard Events Section

**Actor:** Promoter

**Entry Point:** Promoter Dashboard → Events

---

#### Step 1: Navigate to Events

1. Promoter logs into Partner Dashboard
2. System recognizes promoter role and shows Promoter Dashboard
3. Promoter clicks **Events** in sidebar

---

#### Step 2: View Available Events List

**List Display Rules:**
Only show events where **ALL** of these are true:
- Promoter Access toggle is **ON** for the event
- Promoter is **partnered** with the Venue/Host
- Promoter is **selected** for this event (or "All Partnered Promoters" is selected)
- Event is **Published** (not Draft, Unpublished, or Canceled)
- Event date has not passed

---

#### Step 3: Event Card UI

**Each Event Card Contains:**

| Element | Description |
|---------|-------------|
| Event Poster | Thumbnail image |
| Event Name | Full event title |
| Date & Time | Formatted event date |
| Venue | Venue name and city |
| Host/Venue Name | Name of the event creator |
| **Create Link** Button | Primary action to generate tracking link |
| **View Event Page** Button | Opens live event page on User Website |
| Stats Section | Performance metrics for this promoter |

**Stats Section Contains:**
| Metric | Description |
|--------|-------------|
| Clicks | Total clicks on promoter's links for this event |
| Ticket Purchases | Tickets sold through promoter's links |
| Conversion Rate | Purchases / Clicks percentage |
| Revenue Attributed | Total revenue from promoter's links (if shown) |

---

#### Step 4: Empty State

**If no eligible events exist, display:**

**Empty State UI:**
- Illustration or icon (e.g., calendar with magnifying glass)
- Heading: "No Events Available"
- Message: "Events will appear here when:"
  - "You are partnered with a Venue or Host"
  - "The Venue or Host enables promoter access for their event"
  - "You are selected for that event"
- **CTA Button:** "Browse Venues & Hosts" — links to discovery/connection page

---

### A5. Promoter Creates Unique Trackable Links

**Actor:** Promoter

**Entry Point:** Promoter Dashboard → Events → Click "Create Link" on any event

---

#### Step 1: Click Create Link

1. Promoter identifies an event they want to promote
2. Clicks **Create Link** button on the event card
3. Link creation modal opens

---

#### Step 2: Link Creation Modal

**Modal UI:**

**Header:** "Create Tracking Link"
**Subheader:** "[Event Name]"

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Link Name | Text input | Yes | Identifier for this link (e.g., "NYE Pune reels", "Campus ambassadors", "Influencer A") |
| Source | Dropdown/Select | No | Distribution channel: Instagram, WhatsApp, X (Twitter), Facebook, Email, Offline, Other |
| Notes | Textarea | No | Internal notes about this link or campaign |

**Buttons:**
- **Cancel** — Closes modal, no link created
- **Generate Link** — Creates the unique tracking link

---

#### Step 3: Click Generate Link

1. Promoter fills in at minimum the Link Name
2. Clicks **Generate Link**
3. Modal transitions to result state

---

#### Step 4: Link Result State

**Modal UI After Generation:**

**Header:** "Link Created!"

**Generated Link Display:**
- Full URL shown in copyable input field
- Link format: `https://thec1rcle.com/e/[event-slug]?promo=[unique-code]`

**Action Buttons:**
| Button | Action |
|--------|--------|
| **Copy** | Copies link to clipboard, shows "Copied!" confirmation |
| **Share** | Opens native share sheet (mobile) or share options |
| **Create Another** | Resets form to create additional link for same event |
| **Done** | Closes modal |

**Link Performance Preview:**
- Placeholder metrics shown (all starting at zero)
- "Clicks: 0"
- "Purchases: 0"
- "Revenue: ₹0"
- "Last active: Never"

---

#### Step 5: View All Links for an Event

**After closing modal, the event card updates:**

1. Event card shows link count: "3 links created"
2. Clicking on event card or "View Links" opens link management section

**Link List UI:**

| Column | Description |
|--------|-------------|
| Link Name | Name assigned by promoter |
| Created Date | When the link was generated |
| Source | Distribution channel (if set) |
| Clicks | Total click count |
| Purchases | Tickets sold via this link |
| Revenue | Revenue attributed (if shown) |
| Last Active | Date of most recent click |
| Actions | Copy button, delete button (if allowed) |

---

#### Error States

| Error Condition | UI Response |
|-----------------|-------------|
| Link name already exists | Inline error: "You already have a link with this name. Please use a unique name." |
| Generation fails | Error toast: "Failed to create link. Please try again." |
| Rate limit reached | Warning: "You've created too many links recently. Please wait before creating more." |

---

#### Special State: Promoter Access Disabled After Links Created

**If Venue/Host turns OFF promoter access after links were created:**

| Element | Behavior |
|---------|----------|
| Event Card | Shows "Access Disabled" badge overlay |
| Event Card | Appears grayed out or with reduced opacity |
| Create Link Button | Disabled, shows tooltip: "Promoter access is currently disabled" |
| Existing Links | **Read-only** — can view stats but cannot create new links |
| Link URLs | Still functional — will redirect to event page (but attribution may be paused) |

**If Partnership Removed:**

| Behavior |
|----------|
| Event completely hidden from promoter's events list |
| OR: Event shows "Access Removed" with message: "Your partnership with [Venue/Host name] has ended" |
| Existing links remain functional but promoter can no longer manage them |

---

## Part B: Guest Flow on User Website — Discovery to Tickets

---

### B1. Guest Lands on User Website

**Actor:** Guest (logged out by default)

**Entry Point Options:**
1. Homepage (`thec1rcle.com`)
2. City page (`thec1rcle.com/pune`)
3. Event listing page (`thec1rcle.com/events`)
4. Direct event link (from Host, Venue, or Promoter)

---

#### Homepage UI Elements

**Header Section:**
| Element | Description |
|---------|-------------|
| Logo | THE C1RCLE logo, links to homepage |
| Search Bar | Prominent search input: "Search events, venues, artists..." |
| City Selector | Dropdown or button to select city |
| Login/Sign Up | Buttons in top right (shown when logged out) |
| Profile Menu | Avatar dropdown (shown when logged in) |

**Filter Section:**
| Filter | Type | Description |
|--------|------|-------------|
| City | Dropdown/chips | Select city to filter events |
| Date | Date picker/chips | Tonight, This Weekend, This Week, Custom Range |
| Category | Chips/dropdown | Music, Nightlife, Comedy, Sports, Arts, Food & Drink, etc. |
| Vibe | Tags | Chill, High-Energy, Exclusive, Underground, etc. |

**Sort Options:**
| Option | Description |
|--------|-------------|
| Soonest | Events happening soon first |
| Trending | Most popular/engaged events first |
| Price: Low to High | Least expensive first |
| Price: High to Low | Most expensive first |
| Recently Added | Newest events first |

**Event Grid/List:**
- Responsive grid of event cards
- Each card shows essential info (see B2)
- Infinite scroll or pagination

---

### B2. Guest Searches and Finds the Event

**Actor:** Guest

---

#### Step 1: Search or Filter

**Search Behavior:**
1. Guest types in search bar
2. Autocomplete suggestions appear:
   - Event names matching query
   - Venue names matching query
   - Artist/performer names matching query
3. Guest selects suggestion or presses Enter

**Filter Behavior:**
1. Guest clicks filter chips (city, date, category)
2. Results update in real-time
3. Active filters shown as removable chips above results
4. "Clear All Filters" button appears when filters are active

---

#### Step 2: View Search Results

**Results Page UI:**

**Loading State:**
- Skeleton cards shown while fetching results
- Smooth animation

**Results Display:**
Each event card shows:
| Element | Description |
|---------|-------------|
| Event Poster | High-quality poster image |
| Event Name | Full title of event |
| Date & Time | Formatted: "Sat, Jan 15 • 9 PM" |
| Venue | Venue name and city |
| Starting Price | "From ₹499" or "Free" |
| Category Tags | Small pills showing event type |
| Quick Actions | Save icon (requires login) |

**Results Count:**
"24 events in Pune this weekend"

---

#### Step 3: No Results State

**If no events match the search/filters:**

**UI Display:**
- Illustration (e.g., empty search, telescope)
- Heading: "No events found"
- Message: "Try adjusting your filters or search terms"
- **Remove Filters** button: Clears active filters
- **Suggestions Section:** "Popular events near you" or "Upcoming events"

---

#### Step 4: Click Event Card

1. Guest clicks on an event card
2. Page navigates to event detail page
3. URL updates to event slug: `thec1rcle.com/e/nye-2026-pune`

---

### B3. Event Detail Page Viewing Flow

**Actor:** Guest

**Location:** Event Detail Page (`/e/[event-slug]`)

---

#### Page Sections (in order)

##### 1. Hero Section

| Element | Description |
|---------|-------------|
| Event Poster | Large, high-res poster image (banner or poster depending on layout) |
| Event Name | Large heading |
| Date & Time | Prominent display: "Saturday, January 15, 2026 at 9:00 PM" |
| Venue Name | With city |
| Age Rule | Badge if applicable: "21+", "18+", "All Ages" |
| Starting Price | "From ₹499" or "Free Entry" |

##### 2. Primary CTA Block

**Sticky or prominent action section:**

| Element | Behavior |
|---------|----------|
| **Buy Tickets** Button | Primary CTA for ticketed events |
| **RSVP** Button | Primary CTA for RSVP/free events |
| Price Range | "₹499 – ₹2,999" beneath button |
| Availability | "100 tickets remaining" or "Selling fast!" |

##### 3. Secondary Actions

| Action | Icon | Behavior |
|--------|------|----------|
| Share | Share icon | Opens share modal with copy link, social options |
| Save | Bookmark icon | Saves to profile (requires login) |
| Like | Heart icon | Likes event (requires login) — see special behavior below |

**Like Button Special Behavior:**
1. Guest clicks Like while logged out
2. System redirects to app download page
3. Modal appears: "Like events and join the interested list in the THE C1RCLE app"
4. Options: "Download App" (links to app store) or "Continue on Web" (login to like)

##### 4. Lineup or Highlights

| Element | Description |
|---------|-------------|
| Artist Cards | If applicable, cards for performers with image, name, genre |
| Highlights | Key features: "Open Bar", "VIP Lounge", "Live DJ" |
| Schedule | Timeline if multi-session event |

##### 5. Description

| Element | Description |
|---------|-------------|
| Full Description | Rich text description of the event |
| Read More | Expandable if description is long |

##### 6. Venue Details

| Element | Description |
|---------|-------------|
| Venue Name | Full venue name |
| Address | Complete address |
| Map | Embedded map or map preview image |
| Get Directions | Link to open in Google Maps / Apple Maps |

##### 7. Terms, Policies, and Entry Rules

| Section | Contents |
|---------|----------|
| Terms & Conditions | Expandable or linked full terms |
| Refund Policy | Clear statement of refund rules |
| Entry Rules | Dress code, ID requirements, prohibited items |
| Age Restriction | Reiteration of age rule if applicable |

##### 8. Social Proof Sections

**Interested List Section:**
| Element | Description |
|---------|-------------|
| Count | "[Number] people interested" — **always visible** |
| Avatars | Row of profile pictures of interested users |
| "I'm Interested" Button | Adds user to interested list (requires login) |

**Guest List Section (Conditional):**
| Condition | Display |
|-----------|---------|
| Guest List Toggle **ON** | Show "Guest List" module with preview of attendees who purchased |
| Guest List Toggle **OFF** | **Hide** guest list module entirely |

*Note: Interested and Guest List are separate features with different visibility rules.*

---

#### Buy Tickets Button Behavior (Logged Out)

1. Guest clicks **Buy Tickets**
2. System detects guest is not authenticated
3. Authentication gate appears (see B4)
4. After successful auth, return to this page with selection preserved

---

### B4. Authentication Gate Before Purchase

**Actor:** Guest

**Trigger:** Clicking "Buy Tickets", "RSVP", "Save", or "Like" while logged out

---

#### Step 1: Auth Modal/Page Appears

**UI Options:**

**Modal Style:**
- Overlay modal on event page
- Event visible in background (blurred)
- Can close modal to continue browsing

**Full Page Style:**
- Redirects to `/login` or `/signup`
- "Return to event" after auth

---

#### Step 2: Auth Options Display

**Auth Screen Contents:**

**Header:** "Sign in to continue"
**Subheader:** "Create an account or sign in to buy tickets"

**Social Auth Buttons:**
| Option | Button |
|--------|--------|
| Continue with Google | Google-styled button |
| Continue with Apple | Apple-styled button |

**Divider:** "or"

**Email/Phone Auth:**
| Option | Description |
|--------|-------------|
| Email Sign In | Email input → Password input or Magic link |
| Phone Sign In | Phone input → OTP verification |

**Toggle:** "Don't have an account? Sign up" / "Already have an account? Sign in"

---

#### Step 3: Complete Authentication

**Sign Up Flow:**
1. Enter email or phone
2. Enter password (or receive OTP)
3. Verify OTP if phone-based
4. Optional: Complete basic profile (name)
5. Account created

**Sign In Flow:**
1. Enter email/phone
2. Enter password or OTP
3. Verified → signed in

---

#### Step 4: Success and Redirect

**After Successful Auth:**
1. Auth modal/page closes
2. User redirected back to **same event detail page**
3. Any **previously selected ticket tier is preserved** (if supported)
4. User can now proceed with purchase
5. Nav updates to show profile menu instead of Login/Sign Up

---

#### Error States

| Error | UI Response |
|-------|-------------|
| Wrong password | Inline error: "Incorrect password. Try again or reset password." Reset password link. |
| Invalid OTP | Inline error: "Invalid code. Please check and try again." Resend OTP button. |
| Account not found | "No account found with this email. Sign up instead?" Link to sign up. |
| Account locked | "Your account is temporarily locked due to multiple failed attempts. Try again in 15 minutes or contact support." |
| Too many OTP attempts | "Too many attempts. Please wait 5 minutes before trying again." |
| Network error | "Connection failed. Please check your internet and try again." Retry button. |
| Email already in use (during sign up) | "This email is already registered. Sign in instead?" Link to sign in. |

---

### B5. Ticket Selection and Checkout

**Actor:** Logged-in User

**Trigger:** Click "Buy Tickets" on event detail page (while authenticated)

---

#### Step 1: Ticket Selection UI Opens

**UI Display (Modal or Expanded Section):**

**Header:** "Select Tickets"
**Event Summary:** Event name, date, venue (small display)

**Ticket Tier List:**

Each tier row displays:
| Element | Description |
|---------|-------------|
| Tier Name | "General Admission", "VIP", "VVIP" |
| Price | "₹499", "₹1,499", "₹2,999" |
| Inclusions | "Entry only", "Entry + drink", "Entry + premium bar" |
| Remaining | "50 left", "Limited", or specific count |
| Quantity Selector | + / - buttons with current quantity |
| Status | Available, Sold Out, Few Left |

---

#### Step 2: Select Quantities

**User Actions:**
1. Click + to add tickets of a tier
2. Click - to reduce quantity
3. Quantity updates in real-time
4. Running total shown at bottom

---

#### Step 3: Validation and Guardrails

| Scenario | UI Response |
|----------|-------------|
| **Tier Sold Out** | Row shows "Sold Out" badge, quantity selector disabled, row visually muted |
| **User Exceeds Per-User Cap** | Inline error: "Maximum 4 tickets per person for this tier." Cannot increase beyond limit |
| **User Exceeds Event Cap** | Inline error: "You've already purchased tickets for this event." If limit is 1 per event |
| **Sales Window Not Open** | All tiers disabled. Message: "Tickets go on sale [Date/Time]." Countdown timer shown. "Notify Me" button available |
| **Sales Window Closed** | All tiers disabled. Message: "Ticket sales have ended." |
| **Event Already Started** | Message: "This event has already started." Purchase disabled |
| **Event Ended** | Message: "This event has ended." Purchase disabled |
| **No Tickets Selected** | "Continue" button disabled. Hint: "Select at least one ticket" |

---

#### Step 4: RSVP Flow (Alternative for Free Events)

**If event is RSVP-based:**
- Single "RSVP" button instead of tier list
- One ticket per user enforced
- Click RSVP → Immediate confirmation (no checkout)
- Success: "You're on the list!"

---

#### Step 5: Continue to Checkout

1. User has selected valid quantities
2. Clicks **Continue** or **Proceed to Checkout**
3. Page navigates to checkout screen

---

#### Checkout Page UI

**Layout:**

**Section 1: Order Summary**
| Item | Details |
|------|---------|
| Event | Event name, date, venue |
| Tier 1 | "General Admission × 2 — ₹998" |
| Tier 2 | "VIP × 1 — ₹1,499" |
| **Subtotal** | ₹2,497 |
| **Service Fee** | ₹125 (if applicable) |
| **GST** | ₹449 (if applicable) |
| **Total** | ₹3,071 |

**Section 2: Contact Details**
| Field | Description |
|-------|-------------|
| Name | Pre-filled from profile, editable |
| Email | Pre-filled from profile, editable |
| Phone | Pre-filled or required entry |
| "Tickets will be sent to this email" | Helper text |

**Section 3: Payment Method**
| Option | Description |
|--------|-------------|
| Saved Cards | List of saved payment methods (if any) |
| UPI | UPI ID input or QR code option |
| Net Banking | Bank selection |
| Credit/Debit Card | Card entry form |
| Wallets | Paytm, PhonePe, etc. |

**Section 4: Terms Acceptance**
| Element | Description |
|---------|-------------|
| Checkbox | "I agree to the Terms of Service and Refund Policy" |
| Links | Terms and Refund Policy open in modal or new tab |
| Required | Must be checked to proceed |

**Section 5: Pay Button**
| Element | Description |
|---------|-------------|
| **Pay ₹3,071** | Primary action button |
| Secure badge | "256-bit SSL Secure" indicator |
| Timer (optional) | "Complete payment in 10:00" if time-limited hold |

---

#### Step 6: Payment Processing

**User clicks Pay:**

1. **Processing State:**
   - Button changes to loading/spinner
   - Message: "Processing payment..."
   - Page may not be dismissible

2. **Payment Gateway:**
   - Redirect to payment provider (or embedded form)
   - User completes authentication (OTP, 3DS, etc.)
   - Returns to site after completion

3. **Success Path:**
   - Payment confirmed
   - Redirect to confirmation screen

4. **Failure Path:**
   - Payment declined or failed
   - Return to checkout with error

---

#### Payment Error States

| Error | UI Response |
|-------|-------------|
| Card declined | Error: "Payment declined. Please try a different payment method." Card fields highlighted |
| Insufficient funds | Error: "Insufficient funds. Please try a different account or card." |
| Bank timeout | Error: "Bank did not respond in time. Please try again." Retry button |
| OTP failed | Error: "Authentication failed. Please try again." |
| Tickets sold out during checkout | Error: "Sorry, the tickets you selected are no longer available." Return to ticket selection |
| Network failure | Error: "Connection lost. Please check your internet and try again." Retry |
| Duplicate transaction | Warning: "This looks like a duplicate payment. Please check your email for confirmation before trying again." |

---

### B6. Purchase Confirmation and Ticket Delivery

**Actor:** Logged-in User

**Trigger:** Successful payment completion

---

#### Step 1: Confirmation Screen Displays

**Success Screen UI:**

**Visual:**
- Celebratory animation (confetti, checkmark animation)
- Success icon or illustration

**Header:** "You're In! 🎉"
**Subheader:** "Your tickets are confirmed"

**Order Summary:**
| Detail | Value |
|--------|-------|
| Event Name | [Event Name] |
| Date & Time | Saturday, January 15, 2026 at 9:00 PM |
| Venue | [Venue Name], [City] |
| Tickets | General Admission × 2, VIP × 1 |
| Order Number | #TC-2026-XXXXX |
| Total Paid | ₹3,071 |

**Ticket Preview (Optional):**
- QR code or ticket identifier displayed
- "Show this at entry" instruction

**Action Buttons:**
| Button | Action |
|--------|--------|
| **View Tickets** | Navigate to Tickets section |
| **Back to Event** | Return to event detail page |
| **Share Event** | Open share modal to invite friends |
| **Add to Calendar** | Download .ics file or add to Google/Apple Calendar |

---

#### Step 2: Email/SMS Confirmation

**Confirmation Message Display:**
- Banner or text: "Confirmation sent to [email@example.com]"
- If SMS enabled: "Ticket details also sent via SMS to [phone number]"

**Email Contents (for reference):**
- Subject: "Your THE C1RCLE Tickets — [Event Name]"
- Order details
- Ticket QR codes
- Venue address and map link
- Entry instructions
- Support contact

---

### B7. Viewing Bought Tickets in Tickets Section

**Actor:** Logged-in User

**Entry Point:**
1. Click **Tickets** in navbar/footer
2. Click **View Tickets** from confirmation screen
3. Navigate to profile → Tickets

---

#### Step 1: Tickets List View

**URL:** `/tickets` or `/profile/tickets`

**Page Layout:**

**Section: Upcoming Tickets**
- Lists all tickets for events that haven't happened yet
- Sorted by event date (soonest first)

**Section: Past Tickets**
- Lists all tickets for events that have already happened
- Sorted by event date (most recent first)
- Collapsed by default, expandable

---

#### Step 2: Ticket Card UI

**Each Ticket Card Contains:**

| Element | Description |
|---------|-------------|
| Event Poster | Thumbnail image |
| Event Name | Full event title |
| Date & Time | Formatted date and time |
| Venue | Venue name and city |
| Ticket Tier | "VIP × 2" |
| Status Badge | Current ticket status |
| **View Ticket** Button | Opens ticket detail |

**Ticket Status Badges:**

| Status | Badge Color | Meaning |
|--------|-------------|---------|
| Active | Green | Valid for entry |
| Used | Gray | Already scanned/used |
| Refunded | Orange | Money returned |
| Cancelled | Red | Event cancelled, ticket void |
| Transferred | Blue | Sent to another user |

---

#### Step 3: Ticket Detail Page

**Click "View Ticket" to open detail:**

**Ticket Detail UI:**

**Header Section:**
| Element | Description |
|---------|-------------|
| Event Name | Large heading |
| Date & Time | Prominent display |
| Ticket Tier | "VIP Access" |
| Order Number | #TC-2026-XXXXX |

**QR / Entry Pass Section:**
| Element | Description |
|---------|-------------|
| QR Code | Large, scannable QR code |
| Instruction | "Show this QR code at entry" |
| Ticket ID | Text identifier below QR |
| Brightness Toggle | "Increase brightness for scanning" |

**Event Details Section:**
| Element | Description |
|---------|-------------|
| Venue | Full venue name |
| Address | Complete address |
| **Get Directions** | Link to maps |
| Entry Time | "Doors open at 8:00 PM" |

**Entry Rules Section:**
| Element | Description |
|---------|-------------|
| Dress Code | If applicable |
| Age Requirement | If applicable |
| Prohibited Items | List of banned items |
| Other Instructions | Special entry instructions |

**Support Section:**
| Element | Description |
|---------|-------------|
| Help Link | "Need help? Contact Support" |
| Event Organizer | "Questions about this event? Contact [Host/Venue]" |
| Report Issue | Link to report problems |

**Actions:**
| Action | Description |
|--------|-------------|
| Transfer Ticket | If transferring is allowed, button to send to another user |
| Request Refund | If refund policy allows, link to refund request |
| Add to Wallet | Add to Apple Wallet / Google Pay |

---

#### Step 4: Edge Cases

**Canceled Event:**
| Element | Behavior |
|---------|----------|
| Status Badge | "Cancelled" in red |
| Message Banner | "This event has been cancelled" |
| Next Steps | "Your refund will be processed within X days" or instructions |
| QR Code | Crossed out or hidden |

**Refund Issued:**
| Element | Behavior |
|---------|----------|
| Status Badge | "Refunded" in orange |
| Refund Details | "₹3,071 refunded on [date]" |
| Receipt | Link to refund receipt |
| QR Code | Hidden or marked as void |

**Offline Access:**
| Scenario | Behavior |
|----------|----------|
| User opens Tickets when offline | Show cached tickets list and QR codes |
| Warning Banner | "You're offline. Ticket data shown may not be up to date." |
| Core Function | QR codes must be viewable offline for entry |

---

### B8. Returning to Event and Post-Purchase Behavior

**Actor:** Logged-in User  

---

#### Step 1: Event Detail Page Changes After Purchase

When a user who has purchased tickets returns to the event page:

**UI Changes:**

| Element | Before Purchase | After Purchase |
|---------|-----------------|----------------|
| Primary CTA | "Buy Tickets" | "View Tickets" |
| Attendance Indicator | None | "You're going! ✓" badge |
| Ticket Count | None | "You have 3 tickets" |

**"View Tickets" Button:**
- Links directly to this event's tickets in the Tickets section

---

#### Step 2: Recommendations After Purchase

**Below Event Details:**
- Section: "You might also like"
- Grid of similar events based on:
  - Same category
  - Same venue
  - Same city
  - Same date range
  - Same artists/performers

---

#### Step 3: User Support Entry Points

**On Event Detail Page:**
| Location | Element |
|----------|---------|
| Footer Section | "Need help? Contact Support" link |
| Venue Section | "Report an issue with this event" link |
| After purchase | "Questions about your order?" with order lookup |

**In Tickets Section:**
| Location | Element |
|----------|---------|
| Ticket Detail | "Help with this ticket" link |
| Order Lookup | Search by transaction/order reference |
| Contact | Direct email or chat support |

---

## Part C: Cross-Portal Consistency and State Changes

---

### C1. Promoter Toggle Turned OFF After Links Created

**Scenario:** Venue/Host turns OFF the Promoter Access toggle after promoters have already created tracking links.

---

#### What the Promoter Sees

**In Promoter Dashboard → Events:**

| Change | Description |
|--------|-------------|
| Event Card Appearance | Card shows "Access Disabled" overlay/badge |
| Visual Treatment | Card appears grayed out or with reduced opacity |
| Create Link Button | Disabled, shows tooltip on hover: "Promoter access is currently disabled by the organizer" |
| View Links Button | Still clickable — can view existing links |

**In Link Management for This Event:**

| Element | State |
|---------|-------|
| Link List | Visible, but in read-only mode |
| Link Stats | Still visible (clicks, purchases, etc.) from before disable |
| Create New Link | Disabled with message: "Promoter access is disabled" |
| Copy Link | Still functional |
| Delete Link | May be disabled or still allowed (product decision) |

---

#### What Happens to Existing Links

| Aspect | Behavior |
|--------|----------|
| Link URLs | **Still functional** — URLs do not break |
| Redirect Behavior | Links still redirect to the event page correctly |
| Attribution Tracking | **Paused** — new clicks may still be counted but purchases are not attributed to promoter |
| Revenue Attribution | Stopped for new purchases while toggle is OFF |
| Historical Data | Preserved — all previous attributed purchases remain recorded |

---

#### What Happens to Traffic on Those Links

| Scenario | User Experience |
|----------|-----------------|
| Guest clicks promo link | Normal — taken to event page as usual |
| Guest purchases via promo link | Purchase succeeds, but **not attributed** to promoter |
| Tracking | Link visits may still be logged, but conversion not credited |

---

#### If Toggle is Turned Back ON

| Aspect | Behavior |
|--------|----------|
| Promoter Access | Immediately restored |
| Existing Links | Become fully active again |
| New Attribution | Resumes for subsequent purchases |

---

### C2. Event Edited After Publishing

**Scenario:** Venue/Host edits event details after the event has already been published.

---

#### What Updates Instantly on User Website

**Immediate Updates (Real-time or Near Real-time):**

| Field | Update Behavior |
|-------|-----------------|
| Event Name | Updates on all pages showing the event |
| Description | Updates on event detail page |
| Poster/Banner | Updates on all event cards and detail page |
| Lineup/Artists | Updates on event detail page |
| Venue Details | Updates on event detail page and map |
| Entry Rules | Updates on event detail page |
| Terms & Policies | Updates on event detail page |

**Updates with Propagation Delay (may take minutes):**

| Field | Behavior |
|-------|----------|
| Date/Time | Updates everywhere, but guests with notifications may receive change alerts |
| Price Changes | Updates on all listings |
| Tier Modifications | New tiers appear, modified tiers update, removed tiers stop selling |

---

#### What Updates in Venue/Host Dashboard

| Location | Update |
|----------|--------|
| Event Card | Reflects current state (name, poster, date) |
| Event Detail | All sections show updated values |
| Published Status | Remains "Published" unless explicitly unpublished |

**Edit History (if tracked):**
- Log of changes with timestamp and what was modified
- "Last edited: [date/time]"

---

#### What Promoter Sees

| Element | Behavior |
|---------|----------|
| Event Card | Updated with new event details (name, poster, date) |
| Event Info | Matches current published state |
| Tracking Links | **Remain Valid** — all existing links continue to work |
| Link Destination | Points to updated event page |
| Attribution | Continues normally — no impact on link validity |

**Important:** Promoters do **not** receive notifications of edits unless you implement this feature.

---

#### Ticket Holder Impact

| Change Type | Ticket Holder Experience |
|-------------|-------------------------|
| Date/Time Change | Email/SMS notification: "Event date changed" |
| Venue Change | Email/SMS notification: "Venue updated" with new address |
| Minor Details | No notification unless configured |
| Tickets Section | Shows updated event info |

---

### C3. Event Unpublished or Canceled

**Scenario:** Venue/Host unpublishes or cancels an event after it was published.

---

#### Distinction: Unpublish vs. Cancel

| Action | Definition | Typical Use |
|--------|------------|-------------|
| **Unpublish** | Remove from public visibility but keep internally. Can be republished. | Temporary hide, make edits, then republish |
| **Cancel** | Permanently mark as cancelled. Triggers refunds. Cannot be republished. | Event will not happen |

---

#### Removal from Search and Listings (Both Cases)

| Location | Behavior |
|----------|----------|
| Homepage | Event cards removed from all grids and lists |
| Search Results | Event no longer appears in search |
| Category/Filter Pages | Event hidden from all filtered views |
| City Pages | Event not displayed |
| Promotional Banners | If featured, removed from rotation |

**Speed of Removal:**
- Near-instant for new page loads
- Cached pages may show briefly before refresh

---

#### Direct Link Behavior

**If User Visits Direct Link to Unpublished Event:**

| Scenario | Display |
|----------|---------|
| Unpublished | Message: "This event is currently unavailable" |
|  | CTA: "Browse other events" |
|  | No event details shown |
| Cancelled | Message: "This event has been cancelled" |
|  | Reason (if provided): "Due to unforeseen circumstances..." |
|  | Refund Info: "All ticket holders will receive refunds" |
|  | CTA: "Browse other events" |

**HTTP Status:**
- Return 404 or show unavailable message (depending on SEO strategy)

---

#### Ticket Holders Experience in Tickets Section

**For Unpublished Event:**

| Element | Behavior |
|---------|----------|
| Ticket Status | May show "Pending" or remain "Active" (product decision) |
| Ticket Visibility | Ticket still appears in user's Tickets section |
| Message | "This event is currently not listed. Check back for updates." |
| QR Code | May still be valid (in case event is republished) |
| Refund Option | Show "Request Refund" if applicable |

**For Cancelled Event:**

| Element | Behavior |
|---------|----------|
| Ticket Status | Changes to "Cancelled" |
| Ticket Card | Shows "Cancelled" badge prominently |
| Message Banner | "This event has been cancelled. Your refund is being processed." |
| Refund Status | "Refund: Processing" → "Refund: Completed (₹X,XXX)" |
| QR Code | Hidden or marked void |
| Timeline | Show expected refund date |
| Email/SMS | Notification sent immediately upon cancellation |

---

#### Promoter Dashboard Behavior

**For Unpublished Event:**

| Element | Behavior |
|---------|----------|
| Event Card | Hidden from promoter's event list |
| OR | Shows with "Unavailable" badge (product decision) |
| Existing Links | **Broken** — redirect to unavailable page |
| Link Stats | Preserved but read-only |
| Message | "This event is no longer available" |

**For Cancelled Event:**

| Element | Behavior |
|---------|----------|
| Event Card | Shows "Cancelled" status |
| Event Card | Grayed out or crossed out visually |
| Existing Links | Redirect to cancelled event message page |
| Link Stats | Preserved for historical reference |
| Attribution | Final — no new conversions possible |
| Revenue | Locked — attributed revenue is final (refunds handled separately) |

---

## Summary: User Roles and Their Actions

| Role | Portal | Can Do |
|------|--------|--------|
| **Venue/Host** | Partner Dashboard | Create events, edit events, publish/unpublish, cancel, manage tickets, view orders, control promoter access, toggle guest list visibility, view interested list |
| **Promoter** | Partner Dashboard (Promoter View) | View enabled events from partnered venues/hosts, create tracking links, view link performance, copy/share links |
| **Guest** | User Website | Browse events, search, filter, view event details, sign up/log in, purchase tickets, RSVP, like/save (requires login), view tickets |
| **Ticket Holder** | User Website | View purchased tickets, access QR codes, get directions, request refunds (if allowed), transfer tickets (if allowed) |

---

## Document Version

**Version:** 1.0  
**Created:** January 2026  
**Last Updated:** January 2026  
**Author:** THE C1RCLE Product Team

---

*This document describes user-facing flows only. It does not include technical implementation details, database schemas, or API specifications.*
