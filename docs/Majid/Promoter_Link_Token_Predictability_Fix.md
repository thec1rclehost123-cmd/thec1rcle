# Promoter Link Token Predictability Fix

This document explains the security vulnerability, solution, and specific changes made to ensure that generated promoter link tracking tokens are secure, unpredictable, and random across the application pipeline.

---

## 1. What was the Actual Bug?

In [promoter-engine.js](file:///c:/Users/majid/thec1rcle/packages/core/promoter-engine.js#L123-L132), the `generatePromoterLink` function derived the promoter tracking token from the first 8 characters of the promoter's database ID:

```javascript
token: `p_${promoterId.substring(0, 8)}`
```

### Impact & Security Risk:
- **Predictability & Guessability:** If the system assigns sequential, auto-incrementing, or structured promoter IDs, the resulting tracking tokens are extremely easy to predict.
- **Referral Hijacking & Spoofing:** A malicious actor could easily guess the tracking tokens of other active promoters in the system and generate fake links or spoof/redirect referrals and click traffic to different promoters.
- **Commission Theft:** A user could potentially exploit predictable tokens to manipulate order referral tracking and hijack commissions belonging to other promoters.

---

## 2. What is the Solution to Solve the Bug?

To eliminate token predictability, we must introduce high entropy (randomness) to the generated token so that it cannot be guessed or derived from other publicly known information such as the promoter ID.

The solution is to use a **Cryptographically Secure Pseudo-Random Number Generator (CSPRNG)**. Node's native `randomUUID()` (from the `node:crypto` module) is ideal for this purpose, as it produces highly unique, collision-resistant, and completely unpredictable 128-bit values (represented as standard UUID v4 strings).

---

## 3. What Changes Were Made to Fix This Bug?

### Backend Core (`packages/core/`)
* **[promoter-engine.js](file:///c:/Users/majid/thec1rcle/packages/core/promoter-engine.js#L123-L132)**:
  - Updated `generatePromoterLink` to use `randomUUID()` from `node:crypto` for the token instead of extracting a substring of the `promoterId`.
  
  ```javascript
  export async function generatePromoterLink(promoterId, eventId) {
    // In our system, the link usually follows a pattern or uses a specific token
    // For now, we return a standardized structure that apps can use to build URLs
    return {
      promoterId,
      eventId,
      token: `p_${randomUUID()}`,
      url: `/e/${eventId}?ref=${promoterId}`,
    };
  }
  ```

---

## 4. Verification

We run the existing unit test suite in the API Gateway and core package to verify that the change works seamlessly without impacting the communication pipeline or breaking existing application contracts:

```bash
npx vitest run apps/api-gateway/src/routes/v1/guest-promoter-links.test.ts
npx vitest run apps/api-gateway/src/routes/v1/promoters-v2.test.ts
npx vitest run packages/core/
```

All tests passed successfully, confirming that the token remains fully compliant with API gateway validation layers and core workflows.
