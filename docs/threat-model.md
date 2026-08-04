# Threat Model — C1RCLE Entry & Credential Security

## Overview

This document captures recurring threat patterns identified during security reviews. Each entry describes the exploit pattern, real-world occurrence, and the architectural guard that prevents it. Use this when designing new endpoints or reviewing code that touches authentication, credential issuance, or entitlement verification.

---

## Pattern 1: Deterministic-ID + Public Endpoint + Self-Signing Scanner

**Also known as:** The composed exploit chain (C2 + C3 + C8, July 2026)

### The pattern

Three individually plausible design decisions compose into a complete authentication bypass:

1. **Deterministic resource IDs** — `ENT-{orderId}-{tierId}-{index}` lets anyone who has seen one `orderId` derive valid IDs for other tiers or adjacent orders.
2. **Public endpoint mints credentials** — `GET /tickets/public/:entitlementId` returns a freshly-signed HMAC entry credential with no ownership check.
3. **Scanner signs what it scans** — The door scanner calls `generateEntitlementQR()` (mint a new signature) instead of `verifyEntitlementQR()` (check the existing one) for certain input formats.

### Result

Anyone who knows an `orderId` can present a valid scannable entry credential at the door without ever purchasing a ticket — no forging required, the system signs it for them on request.

### Guard

- **C2 fix:** `GET /tickets/public/:entitlementId` only includes `qrPayload` when the requester's authenticated `uid` matches the entitlement's owner. Unauthenticated or mismatched requesters see ticket details but no credential.
- **C3 fix:** The scanner requires `JSON.parse`-able input with `{ eid, ts, sig }` fields. Bare `ENT-` strings are rejected. The self-signing branch was removed entirely.
- **Architectural rule:** No endpoint should both be publicly accessible and call a credential-generation function. Credential issuance requires either authentication+ownership or a short-lived one-time token.

### Checklist question to ask at design time

> "If this resource ID is deterministic/predictable, does any downstream endpoint accept it as proof of access without verifying ownership?"

---

## Pattern 2: Plaintext Credentials as Application Data

**Also known as:** Temp password triple exposure (C4, July 2026)

### The pattern

A temporary password flows through the application's storage and API layers as if it were ordinary business data:

1. Generated on the server and stored in Firestore.
2. Returned in API response bodies (including on repeat calls days later).
3. Sent via email (unencrypted transit).
4. No authentication required on the endpoint that consumes it.

### Result

Anyone who obtains the invite link (via `Referer` header, server log, email interception) can:
- Retrieve the stored plaintext password from an already-accepted invite.
- Hijack the invited user's account (including existing accounts where `auth.updateUser` overwrote the real password).

### Guard

- **C4 fix:** Provision the Firebase Auth account at invite time, not accept time. The temp password exists only in memory and in the outbound email — never written to Firestore or returned in API responses.
- For reactivations (email already has credentials), no password is generated or touched at all.

### Checklist question to ask at design time

> "Does this credential touch Firestore, the API response body, AND email? If yes, which of those three can be eliminated?"

---

## Pattern 3: Fail-Open Security Check

**Also known as:** Admin suspension Redis outage (C5, July 2026)

### The pattern

A security gate depends on an external service (Redis, Firestore, etc.) and defaults to "allow" when that service is unreachable:

```javascript
try {
  suspensionStatus = await isSuspended(uid);
} catch (err) {
  suspensionStatus = { suspended: false }; // fails open
}
```

### Result

A momentary Redis outage lets suspended admins access all admin routes. If the attack window aligns with an infrastructure event, the security control is completely neutralized.

### Guard

- Default to "deny" on any security-related service failure.
- For multi-layered checks, ensure each layer independently defaults to deny.
- Log a high-severity alert when a security service is unreachable.

### Checklist question to ask at design time

> "If every external service this security check depends on goes down simultaneously, does access get broader or narrower?"

---

## Pattern 4: Unauthenticated Privilege-Escalation Surface

**Also known as:** Admin accept-invite (C4, July 2026)

### The pattern

An endpoint that grants privileges (admin role, team membership, password reset) is accessible without authentication. The only gate is knowledge of a URL parameter (UUID, code, token) that can leak through:

- `Referer` headers to third-party resources
- Server access logs
- Email provider logs
- Shoulder surfing

### Result

A leaked invite link becomes a complete account hijack or privilege escalation vector, with no additional authentication required.

### Guard

- Privilege-granting endpoints must require authentication AND proof of email ownership (e.g., the user must be logged in as the invited email).
- Invite codes should be one-time-use and paired with server-side state tracking (already accepted, expired, etc.).
- Never embed credentials in URLs.

### Checklist question to ask at design time

> "If someone finds this URL in a log file tomorrow, what can they do with it?"

---

## Pattern 5: N+1 Security Queries

**Also known as:** Admin audit log name resolution (H9, July 2026)

### The pattern

A single API request issues one Firestore read per result item to resolve security-relevant metadata (target names, permissions, roles). For a list of 500 audit entries, this means 500 parallel reads.

### Result

- High latency under load (500 reads × ~50ms each = potentially seconds of wall time).
- Firestore quota exhaustion (500 reads per request × N concurrent requests).
- The endpoint becomes a denial-of-service vector against itself.

### Guard

- Denormalize security-relevant display fields into the log/event document at write time.
- If reads are unavoidable, batch them with `getAll()` or `IN` queries capped at 10–30 per batch.
- Add a concurrency limit to parallel `Promise.all` calls.

### Checklist question to ask at design time

> "How many Firestore reads does a single request to this endpoint issue? Is that number unbounded?"

---

## Pattern 6: Encryption That Doesn't Gate Anything

**Also known as:** State-param tamper bypass (C9, July 2026)

### The pattern

Encryption is applied to a value, but the consumer accepts both encrypted and unencrypted forms interchangeably:

```javascript
function decrypt(text) {
  if (!text.includes(':')) return text; // return raw input unchanged
  // ... actual decryption ...
}

function decodeState(raw) {
  return JSON.parse(decrypt(raw)); // no check that decryption happened
}
```

### Result

The encryption is ornamental — an attacker can send a plain, unencrypted value that passes through `decrypt()` unchanged and is accepted as valid.

### Guard

- After decryption, verify that decryption actually occurred (check output differs from input, or prefix encrypted payloads with a recognizable marker).
- `decrypt()` should throw on non-encrypted input, not silently pass it through.

### Checklist question to ask at design time

> "Can an attacker skip the encryption step entirely and still get the same result?"

---

## Applying This Document

- **Before writing a new endpoint:** Review patterns 1, 2, 4, and 5.
- **Before adding a security gate:** Review patterns 3 and 6.
- **During code review:** Check the relevant checklist question for any endpoint that handles credentials, privileges, or authentication state.
- **After a security fix:** Consider whether the fix is architectural (changes the design to prevent the class of bug) or symptomatic (patches the specific instance). Architectural fixes should be reflected here.
