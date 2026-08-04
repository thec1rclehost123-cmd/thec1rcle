# Fix: Admin Invitation Accept-Link Poisoning (Host Header Injection)

This document details the security vulnerability associated with invitation links built from client-controlled HTTP headers and the robust mitigation implemented.

---

## 1) What was the actual Bug?

In the admin team invitation endpoint (`apps/admin-console/app/api/admins/team/route.js`), the acceptance link (`acceptLink`) was constructed dynamically using client-controlled headers:

```javascript
let origin = 'http://localhost:3000';
const referer = req.headers.get('referer');
const headerOrigin = req.headers.get('origin');
if (referer) {
  try {
    origin = new URL(referer).origin;
  } catch {
    if (headerOrigin) origin = headerOrigin;
  }
} else if (headerOrigin) {
  origin = headerOrigin;
}
```

### Risk/Impact:
1. **Header Spoofing / Poisoning**: The `Referer` and `Origin` headers can be arbitrarily set by an attacker.
2. **Token Leakage**: If an attacker triggers the invite endpoint (or intercepts/spoofs the request context), the acceptance URL in the email sent to the invited admin would point to an attacker-controlled site (e.g., `https://attacker.com/accept-invite?code=<inviteToken>`). 
3. **Account Hijacking**: Clicking the poisoned link exposes the sensitive invitation token (`inviteToken`) and/or temporary credentials directly to the attacker, allowing them to sign up as an admin and take control of the account.
4. **Incorrect Local Port**: In local development, it defaulted to `http://localhost:3000` (which is the Guest Portal port) rather than `http://localhost:3002` (the Admin Console port).

---

## 2) What is the solution to solve that Bug?

The mitigation employs a defense-in-depth approach to guarantee secure, validated base URLs:

1. **Static Environment Configuration**: Introduce a dedicated, optional `NEXT_PUBLIC_ADMIN_URL` environment variable. If defined (e.g., in production or staging environments), the backend will strictly use this static URL to build links, ignoring incoming request headers completely.
2. **Domain/Host Whitelisting**: If the environment variable is not defined, we fall back to deriving the origin from headers, but **only if the derived host matches a strict domain whitelist**:
   - Local hosts: `localhost`, `127.0.0.1`, or hosts ending with `.local`.
   - Core production domains: `thec1rcle.com` and its subdomains (`*.thec1rcle.com`).
   - Deployment previews: Vercel deployment URLs (`*.vercel.app`).
3. **Safe Default Fallback**: If the headers are missing or fail whitelist validation, we default to the secure local Admin Console dev origin: `http://localhost:3002`.

---

## 3) What Changes were made to fix this Bug?

### A. Environment Configuration
* **[env.js](file:///c:/Users/majid/thec1rcle/apps/admin-console/lib/env.js)**: Registered `NEXT_PUBLIC_ADMIN_URL` in the client environment schema as an optional URL type and mapped it from `process.env`.
* **[.env.example](file:///c:/Users/majid/thec1rcle/apps/admin-console/.env.example)**: Added `NEXT_PUBLIC_ADMIN_URL=http://localhost:3002` as a placeholder.
* **[.env.local](file:///c:/Users/majid/thec1rcle/apps/admin-console/.env.local)**: Added `NEXT_PUBLIC_ADMIN_URL=http://localhost:3002` for local development setup.

### B. Secure Link Construction
* **[route.js](file:///c:/Users/majid/thec1rcle/apps/admin-console/app/api/admins/team/route.js)**:
  * Imported the parsed environment configuration object (`env`).
  * Implemented a `getSecureOrigin(req)` helper to resolve the base URL securely by checking `env.NEXT_PUBLIC_ADMIN_URL`, parsing proxy/client headers, and validating them against the trusted domain whitelist.
  * Replaced the vulnerable client-controlled origin resolution logic with `getSecureOrigin(req)`.
