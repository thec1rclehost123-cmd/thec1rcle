# 📣 Event-Only Group Chats - Complete System Implementation Plan

> **"Turn events into temporary micro-communities with natural connections, zero creepiness, and respectful discovery."**

---

## 📊 Current Implementation Status

### ✅ Already Built (Lib Layer)

| Module | File | Status | Features |
|--------|------|--------|----------|
| **Core Types** | `lib/social/types.ts` | ✅ Complete | EventPhase, EventEntitlement, GroupMessage, PrivateConversation, DirectMessage, UserBlock, UserReport, SavedContact, MatchingProfile |
| **Entitlements** | `lib/social/entitlements.ts` | ✅ Complete | `checkEventEntitlement()`, `subscribeToEntitlement()`, `getEventAttendees()`, `getAttendeeCount()`, `canInitiateDM()` |
| **Group Chat** | `lib/social/groupChat.ts` | ✅ Complete | `getEventGroupChat()`, `sendGroupMessage()`, `sendAnnouncement()`, `subscribeToGroupChat()`, `deleteGroupMessage()` |
| **Private DMs** | `lib/social/privateDM.ts` | ✅ Complete | `initiateDMRequest()`, `acceptDMRequest()`, `declineDMRequest()`, `blockUser()`, `sendDirectMessage()`, `saveContact()`, `getSavedContacts()` |
| **Moderation** | `lib/social/moderation.ts` | ✅ Complete | `reportUser()`, `isUserBlocked()`, `unblockUser()`, `muteUserInEvent()`, `isUserMutedInEvent()`, `removeUserFromEventChat()`, `getPendingReports()`, `resolveReport()` |
| **Media Gallery** | `lib/social/media.ts` | ✅ Complete | `pickImage()`, `takePhoto()`, `uploadEventMedia()`, `subscribeToEventMedia()`, `toggleMediaLike()`, `deleteMedia()`, `reportMedia()` |
| **Typing Indicators** | `lib/social/typing.ts` | ✅ Complete | `setGroupTypingStatus()`, `setDMTypingStatus()`, `subscribeToGroupTyping()`, `subscribeToDMTyping()`, `createTypingHandler()` |
| **Legacy Chat** | `lib/chat.ts` | ⚠️ Deprecated | Old implementation - superseded by social/* |
| **Safety** | `lib/safety.ts` | ✅ Complete | SOS, Party Buddy, Location Sharing, Safe Ride |

### ✅ Already Built (UI Screens)

| Screen | File | Status |
|--------|------|--------|
| Group Chat | `app/social/group/[eventId].tsx` | ✅ Complete |
| Attendees List | `app/social/attendees.tsx` | ✅ Complete |
| DM Requests | `app/social/requests.tsx` | ✅ Complete |
| Saved Contacts | `app/social/contacts.tsx` | ✅ Complete |
| Report User | `app/social/report.tsx` | ✅ Complete |

### ⚠️ Partially Built (Needs Enhancement)

| Item | Location | What's Missing |
|------|----------|----------------|
| DM Conversation | `app/social/dm/[id].tsx` | Needs verification |
| Gallery View | `app/social/gallery/[id].tsx` | Needs verification |
| User Profile | `app/social/profile/[id].tsx` | Needs verification |

### ❌ Not Yet Built

| Item | Description |
|------|-------------|
| **DM Rate Limiting** | Daily DM request limit per event (3-5) |
| **Temporal Access Control** | Full lifecycle (Pre/Live/Post/Archive) enforcement |
| **Announcements UI** | Host/Venue badge announcements with special styling |
| **Emoji Reactions** | Message reactions (👍❤️🔥) |
| **Read Receipts** | Seen timestamps (optional) |
| **Chat Lock** | Emergency chat lock for moderators |
| **Archive Mode** | Auto-archive after window closes |
| **Social Tab** | Main navigation entry point |
| **Entry Point from Event** | "Join Chat" CTA on event detail page |
| **Report Categories** | Full reporting reasons UI |
| **Firestore Rules** | Security rules for new collections |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE LAYER                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Event Detail → [Join Chat CTA]                                         │
│       ↓                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  ┌─────────────┐│
│  │ Group Chat  │←→│  Attendees   │←→│  DM Requests   │←→│ DM Thread   ││
│  │ /social/    │  │  /social/    │  │  /social/      │  │ /social/    ││
│  │ group/      │  │  attendees   │  │  requests      │  │ dm/[id]     ││
│  └─────────────┘  └──────────────┘  └────────────────┘  └─────────────┘│
│        ↓                ↓                                     ↓         │
│  ┌─────────────┐  ┌──────────────┐                    ┌─────────────────┐
│  │   Gallery   │  │ User Profile │                    │ Saved Contacts  │
│  │   /social/  │  │  /social/    │                    │ /social/        │
│  │   gallery/  │  │  profile/    │                    │ contacts        │
│  └─────────────┘  └──────────────┘                    └─────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER (lib/social/*)                   │
├─────────────────────────────────────────────────────────────────────────┤
│  entitlements.ts  │  groupChat.ts  │  privateDM.ts  │  moderation.ts   │
│  typing.ts        │  media.ts      │  types.ts      │  index.ts        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER (Firestore)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  events                    │  orders (entitlements)                     │
│  eventGroupMessages        │  privateConversations                      │
│  directMessages            │  savedContacts                             │
│  eventMedia                │  typingIndicators                          │
│  userBlocks                │  userReports                               │
│  eventMutes                │  eventChatRemovals                         │
│  mediaReports              │                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Phases

### Phase 1: Core Completion & Entry Points 
**Priority: 🔴 Critical | Effort: Medium**

#### 1.1 Add "Join Chat" Entry Point on Event Detail Page
**File:** `app/event/[id].tsx`

```typescript
// Add Social CTA section after ticket purchase
<EventSocialCTA 
  eventId={eventId} 
  hasTicket={hasActiveTicket}
  phase={eventPhase}
  participantCount={participantCount}
/>
```

**New Component:** `components/social/EventSocialCTA.tsx`
```typescript
// Shows:
// - "🔥 X people are in the chat" if has ticket
// - "Buy ticket to join the community" if no ticket
// - Phase indicator (Pre-Party / Live Now / After Party)
// - Quick actions: Join Chat, See Who's Going, Photo Gallery
```

#### 1.2 Create Social Tab Entry Point
**File:** `app/(tabs)/social.tsx` (new)

**Features:**
- List of active event chats (events user has tickets for)
- DM requests badge with count
- Saved contacts access
- Event phase indicators per chat

---

### Phase 2: Enhanced Access Control
**Priority: 🟠 High | Effort: Medium**

#### 2.1 Update Entitlement Types
**File:** `lib/social/types.ts`

Add these ticket statuses for gatekeeping:
```typescript
export type TicketStatus = 
  | 'confirmed'     // ✅ Access granted
  | 'live'          // ✅ Access granted  
  | 'checked_in'    // ✅ Access granted
  | 'refunded'      // ❌ Access denied
  | 'expired'       // ❌ Access denied
  | 'cancelled'     // ❌ Access denied
  | 'resale_pending'; // ❌ Access denied

export interface EventAccessWindow {
  preEventStart: Date;   // T-7d from event
  eventStart: Date;
  eventEnd: Date;        // Event start + 12hrs
  postEventEnd: Date;    // Event end + 7 days
  archiveDate: Date;     // Post-event + 7 days
}
```

#### 2.2 Add DM Rate Limiting
**File:** `lib/social/privateDM.ts`

```typescript
const DM_DAILY_LIMIT = 5; // Per event

export async function getDMRequestsRemaining(
  userId: string, 
  eventId: string
): Promise<number> {
  // Query today's DM requests initiated by user for this event
  // Return DM_DAILY_LIMIT - count
}

// Update initiateDMRequest to check limit
```

#### 2.3 Add Anti-Creep Protection
**File:** `lib/social/privateDM.ts`

```typescript
export async function getRejectionHistory(
  userId: string
): Promise<{ recentRejections: number; isRateLimited: boolean }> {
  // If user has 3+ rejections in last 24 hours, rate limit them
}
```

---

### Phase 3: UI Polish & Enhanced Features
**Priority: 🟡 Medium | Effort: Large**

#### 3.1 Emoji Reactions
**Update:** `lib/social/groupChat.ts`

```typescript
export interface MessageReaction {
  emoji: '👍' | '❤️' | '🔥' | '😂' | '😮' | '🥳';
  userIds: string[];
}

export async function addReaction(
  messageId: string,
  userId: string,
  emoji: MessageReaction['emoji']
): Promise<void>
```

**Update:** `GroupMessage` type:
```typescript
reactions?: Record<string, string[]>; // emoji -> userIds
```

#### 3.2 Host/Venue Announcements Styling
**Update:** `app/social/group/[eventId].tsx`

Add special announcement bubble:
```typescript
function AnnouncementBubble({ message }: { message: GroupMessage }) {
  // Full-width, highlighted, with badge
  // [HOST] or [VENUE] badge
  // Pin to top option
}
```

#### 3.3 Read Receipts (Optional)
**Update:** `lib/social/privateDM.ts`

```typescript
export async function markMessageAsRead(
  messageId: string,
  userId: string
): Promise<void>

// Update DirectMessage type:
readAt?: any;
readBy?: string[];
```

---

### Phase 4: Gallery & Media Enhancements
**Priority: 🟡 Medium | Effort: Medium**

#### 4.1 Full Gallery Screen
**Verify/Enhance:** `app/social/gallery/[eventId].tsx`

**Features:**
- Photo grid layout (3 columns)
- Tap to enlarge (modal)
- Like indicator overlay
- Upload FAB
- Official media section (from host/venue)

#### 4.2 Caption Support
Already in `EventMedia` type - ensure UI supports it.

#### 4.3 Auto-Lock After Archive
```typescript
// In gallery screen
const canUpload = phase !== 'expired' && phase !== 'archived';
```

---

### Phase 5: Safety & Moderation Layer
**Priority: 🔴 Critical | Effort: Medium**

#### 5.1 Enhanced Report Categories
**Update:** `lib/social/types.ts`

```typescript
export type ReportCategory = 
  | 'sexual_harassment'
  | 'creepy_behavior'
  | 'spam_scam'
  | 'threat_violence'
  | 'impersonation'
  | 'drugs'
  | 'other';
```

#### 5.2 Report UI Enhancement
**Update:** `app/social/report.tsx`

Full selection UI with category descriptions.

#### 5.3 Chat Lock (Emergency)
**File:** `lib/social/groupChat.ts`

```typescript
export async function lockEventChat(
  eventId: string,
  lockedByUserId: string,
  reason?: string
): Promise<void>

export async function isEventChatLocked(
  eventId: string
): Promise<boolean>
```

---

### Phase 6: Firestore Security Rules
**Priority: 🔴 Critical | Effort: Small**

**Update:** `firestore.rules`

```javascript
// Event Social Layer Collections
match /eventGroupMessages/{messageId} {
  allow read: if isSignedIn() && hasEventEntitlement(resource.data.eventId);
  allow create: if isSignedIn() && hasEventEntitlement(request.resource.data.eventId);
  allow update: if isAdmin(); // Delete/mod only
}

match /privateConversations/{convoId} {
  allow read: if isSignedIn() && request.auth.uid in resource.data.participants;
  allow create: if isSignedIn();
  allow update: if isSignedIn() && request.auth.uid in resource.data.participants;
}

match /directMessages/{messageId} {
  allow read: if isSignedIn() && canAccessConversation(resource.data.conversationId);
  allow create: if isSignedIn() && canAccessConversation(request.resource.data.conversationId);
}

match /savedContacts/{contactId} {
  allow read, write: if isSignedIn() && resource.data.userId == request.auth.uid;
}

match /eventMedia/{mediaId} {
  allow read: if isSignedIn() && hasEventEntitlement(resource.data.eventId);
  allow create: if isSignedIn() && hasEventEntitlement(request.resource.data.eventId);
  allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
}

match /typingIndicators/{indicatorId} {
  allow read, write: if isSignedIn();
}

match /userBlocks/{blockId} {
  allow read: if isSignedIn() && (
    resource.data.blockerId == request.auth.uid ||
    resource.data.blockedId == request.auth.uid
  );
  allow create: if isSignedIn() && request.resource.data.blockerId == request.auth.uid;
  allow delete: if isSignedIn() && resource.data.blockerId == request.auth.uid;
}

match /userReports/{reportId} {
  allow read: if isAdmin() || (isSignedIn() && resource.data.reporterId == request.auth.uid);
  allow create: if isSignedIn() && request.resource.data.reporterId == request.auth.uid;
}

match /eventMutes/{muteId} {
  allow read, write: if isAdmin() || isEventHost(resource.data.eventId);
}

match /eventChatRemovals/{removalId} {
  allow read, write: if isAdmin() || isEventHost(resource.data.eventId);
}

// Helper functions
function hasEventEntitlement(eventId) {
  return exists(/databases/$(database)/documents/orders/$(request.auth.uid + '_' + eventId));
}

function canAccessConversation(convoId) {
  let convo = get(/databases/$(database)/documents/privateConversations/$(convoId));
  return request.auth.uid in convo.data.participants;
}
```

---

## 📱 User Flows

### Flow 1: Discovering the Chat
```
Event Detail Page
    ↓ (has ticket)
[Join Chat CTA] → "🔥 27 people are chatting"
    ↓
Group Chat Screen
    ↓ (tap attendee avatar)
Attendees List → [View Profile] / [Message]
```

### Flow 2: Initiating a DM
```
Attendees List
    ↓ [Message Button]
DM Request Created (Pending)
    ↓ (other user)
DM Requests Screen → [Accept] / [Decline]
    ↓ (accepted)
DM Conversation Active
    ↓ (optional)
[Save Contact] → Persists after event
```

### Flow 3: Post-Event Photo Sharing
```
Event ends
    ↓ (within 7 days)
Post-Event Phase Active
    ↓
Gallery Screen → [Upload Photo] → Caption (optional)
    ↓
Photo appears in gallery
    ↓ (can like photos)
After 7 days → Gallery locks
```

### Flow 4: Reporting & Blocking
```
Long-press message / Tap user profile
    ↓
[Report] → Select Category → Description
    ↓
Report created → Moderation queue
    
[Block] → Immediate effect
    ↓
- Hidden from attendee list
- Cannot send DM requests
- Cannot see messages (if global block)
```

---

## 🎨 Design System Integration

### Colors (from tailwind.config.js)
```javascript
colors: {
  midnight: { DEFAULT: '#0C0B13' },  // Background
  surface: '#1A1926',                 // Cards
  iris: '#F44A22',                    // Primary accent (orange)
  gold: '#E5C37D',                    // Text primary
  'gold-stone': '#8B7355',            // Text secondary
}
```

### Components to Create
```
components/social/
├── EventSocialCTA.tsx        # Entry point CTA
├── ChatBubble.tsx            # Group message bubble
├── DMBubble.tsx              # DM message bubble
├── AnnouncementCard.tsx      # Host/venue announcement
├── AttendeeAvatar.tsx        # Circular avatar with badge
├── TypingDots.tsx            # Animated typing indicator
├── PhaseBadge.tsx            # Pre/Live/Post indicator
├── ReactionPicker.tsx        # Emoji reaction picker
├── PhotoGrid.tsx             # Gallery grid
├── MediaUploader.tsx         # Photo upload with progress
└── SafetyActionSheet.tsx     # Block/Report options
```

---

## 📈 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Chat Adoption | 60%+ of ticket holders join chat | Users in eventGroupMessages |
| DM Conversion | 20% of attendees initiate DM | DM requests created |
| DM Acceptance Rate | 40%+ | Accepted / Total requests |
| Contact Save Rate | 10% of accepted DMs | savedContacts created |
| Photo Sharing | 30+ photos per event | eventMedia per event |
| Safety | <1% report rate | Reports / Messages |

---

## 🚀 Deployment Checklist

### Pre-Launch
- [ ] Deploy Firestore security rules
- [ ] Create Firestore composite indexes for queries
- [ ] Test entitlement flow with real tickets
- [ ] Test DM flow end-to-end
- [ ] Test media upload with progress
- [ ] Test typing indicators real-time
- [ ] Test block/report flow

### Launch Day
- [ ] Monitor Firestore usage
- [ ] Watch for security rule denials
- [ ] Check for rate limiting effectiveness
- [ ] Monitor report queue

### Post-Launch
- [ ] Gather user feedback
- [ ] Analyze adoption metrics
- [ ] Identify UX friction points
- [ ] Iterate on safety features

---

## 🔜 Future Enhancements (Phase 2+)

1. **Table Groups** - Private chat for table buyers
2. **Ladies Night Matching** - Preferential matching
3. **Event Dating Mode** - Opt-in mutual matching
4. **Voice Notes** - Audio messages in DMs
5. **Stories** - 24hr event stories
6. **AI Moderation** - Auto-flag inappropriate content
7. **Venue Staff Dashboard** - Real-time moderation tools
