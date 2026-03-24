# Circle Monorepo: Developer Knowledge Base & Pitfalls

This document tracks critical architectural requirements and common pitfalls specific to this repository. Refer to this before making changes to ensure build and deployment stability.

---

## 🏗️ Next.js 15+ Route Parameters
**Context:** Next.js 15/16 changed `params` and `searchParams` to **Promises**.
- **Requirement:** You **MUST** `await` params before accessing them in **ANY** route handler or page.
- **Pattern:** `const { id } = await params;`
- **Pitfall:** Sync access (e.g., `params.id`) will cause TypeScript errors and production build failures.

## 🚀 Firebase Functions: Monorepo Bundling
**Context:** Functions reside in `/functions` but depend on `@c1rcle/core` and other monorepo packages.
- **Requirement:** Always use the `npm run build` command which uses **esbuild** for bundling.
- **Pitfall:** Using standard `tsc` will result in "Module not found: @c1rcle/core" in the Cloud runtime because dependencies aren't inlined.
- **Verification:** Check `functions/lib/index.js` size (~1.2MB is normal).

## ⚡ Cloud "Cold Scan" & Lazy Initialization
**Context:** Firebase CLI scans the codebase during deployment. If environment variables are missing during this scan, the deployment crashes.
- **Requirement:** SDKs (Algolia, Stripe, Firebase Admin) must use **Lazy Initialization**.
- **Pattern:** Use `getAlgoliaClient()` helper instead of `const client = algoliasearch(...)` at the top level.

## 🛡️ Authentication Middleware (`withAuth`)
**Context:** The Partner Dashboard uses a custom `withAuth.ts` and `hostAuthMiddleware.ts`.
- **Requirement:** Use the `as any` cast or correct generic signature if Next.js validators fail.
- **Pitfall:** Changing the signature of `withAuth` handlers can break auto-generated Next.js route validators.

## 🔍 Naming Consistency
- **Constraint:** Route segment names (e.g., `[eventId]`) should ideally match the destructured variable name to simplify automated migrations and type-checking.

---
*Created on 2026-03-23*
