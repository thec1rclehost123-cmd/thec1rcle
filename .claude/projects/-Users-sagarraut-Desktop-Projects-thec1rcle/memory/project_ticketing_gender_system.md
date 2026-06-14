---
name: Gender-Based Ticketing System
description: Full implementation of gender-restricted tickets, couple ticket logic, profile cooldown, and API validation
type: project
---

## Overview
Every ticket on C1RCLE is gender-tagged. No gender-neutral "General" tickets. Claiming is validated against the user's profile gender at both claim-time and scan-time.

---

## Files Changed

| File | What changed |
|---|---|
| `apps/partner-dashboard/components/wizard/TicketTierStep.tsx` | Entry types, gender requirement, couple UI |
| `apps/guest-portal/lib/server/ticketShareStore.js` | Claim validation, couple logic, new functions |
| `apps/guest-portal/app/api/tickets/couple/route.js` | New API route for couple status + cancel |
| `apps/guest-portal/app/api/auth/profile/route.ts` | 30-day gender change cooldown |
| `apps/partner-dashboard/app/api/venue/events/[id]/tickets/route.ts` | normalizeTicketTier, rejects "general" |

---

## 1. Ticket Tier Setup (`TicketTierStep.tsx`)

**TicketTier interface fields:**
- `entryType: "stag" | "female" | "couple" | "vip" | "table" | "cover"`
- `genderRequirement: "male" | "female" | "couple"`
- `isCouple?: boolean` — true only on couple tier

**ENTRY_TYPES mapping:**
- `stag` → `genderRequirement: "male"`
- `female` → `genderRequirement: "female"`
- `couple` → `isCouple: true`, shows locked "Male + Female" pair display
- `vip`, `cover` → `genderRequirement: null` (no restriction), shows picker

**addTicket() default:** `entryType: "stag", genderRequirement: "male"`

**Quick Presets — Nightclub includes:** Stag Entry, Female Entry, Couple Entry (`isCouple: true`), Early Bird, Cover, Fan Pit

---

## 2. Claiming Validation (`ticketShareStore.js`)

**`getUserGender(userId)`**
- Returns `"male"` | `"female"` | `null`
- `null` = gender not set on profile (never returns `"any"`)

**Claim flow checks (in order):**
1. If `bundleGenderRestricted && userGender === null` → throw *"Please complete your profile and set your gender before claiming this ticket."*
2. Gender filter: `s.requiredGender === "any" || s.requiredGender === userGender` (strict, no `!s.requiredGender` fallback)
3. Mismatch → throw *"This ticket is not valid for your profile. This ticket is for [Male/Female]s only."*

**Couple slot gender derivation (NOT hardcoded female):**
```js
// In _createShareableSlot:
partnerGender = buyerGender === "female" ? "male" : "female"

// In assignPartner() and claimPartnerSlot():
expectedPartnerGender = ownerGender === "female" ? "male" : "female"
```

**New functions added:**
- `getCoupleTicketStatus(bundleId)` → `{ state: "partial"|"complete", ownerSlot, partnerSlot }`
- `cancelPartnerSlot(bundleId, ownerId)` → resets slot 2, voids partner assignment, owner-only

---

## 3. Couple Ticket API (`/api/tickets/couple/route.js`)

- `GET ?bundleId=` → calls `getCoupleTicketStatus(bundleId)`
- `DELETE { bundleId }` → calls `cancelPartnerSlot(bundleId, ownerId)`, rate-limited, owner-only

---

## 4. Profile Gender Cooldown (`/app/api/auth/profile/route.ts`)

- `GENDER_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000` (30 days)
- PATCH saves `genderLastChangedAt` on first set and each allowed change
- If within cooldown → HTTP 429 with days-remaining message
- Purpose: prevent users from switching gender to exploit event access

---

## 5. Ticket API Validation (`/app/api/venue/events/[id]/tickets/route.ts`)

- `normalizeTicketTier()`: derives `genderRequirement` from `entryType` first, defaults to `"male"` for unresolved
- PATCH rejects `entryType: "general"` → HTTP 400
- PATCH rejects `entryType: "couple"` without `isCouple: true` → HTTP 400

---

## Key Rules to Remember

- `getUserGender()` returns `null` not `"any"` — all callers must handle null explicitly
- Partner slot gender is always opposite of buyer/owner gender — never hardcoded
- Gender filter uses strict match: `requiredGender === userGender`, not a loose check
- `isCouple: true` flag on tier + bundle triggers 2-slot behavior with `couplePairId` linking the slots
- Scan-time validation also checks gender (same rules apply)
- 30-day cooldown applies even on first-time gender set (starts the clock)

---

## What Is NOT Yet Done

- Scan-time gender validation UI feedback (backend checks exist, scanner UI feedback not verified)
- Admin override for gender mismatch at door
- Gender analytics per event (how many male/female/couple slots filled)
