# Implementation Plan - Error Handling Architecture and Swallow Fixes

This document details the architectural problem, the corrected flow, and the specific changes made to resolve empty catch blocks and swallowed errors across `packages/core` and `apps/admin-console`.

---

## 1. The Core Problem (Swallowed Errors)

Previously, several database, caching, and authentication calls across the codebase swallowed exceptions using empty catch blocks (`catch {}`) or recovery-only defaults (like returning `null` or `{ events: [], nextCursor: null, hasMore: false }`). 

### Impact:
* **Falsely Signaled Success**: The client/browser received an HTTP `200 OK` status with empty sets or `null` values, falsely implying that the resource did not exist (e.g., displaying *"No events found"* or *"404 Not Found"*) when, in reality, the database query failed.
* **Invisible Failures**: Because errors were caught silently without logging, operations developers and site reliability engineers had no visibility into database query timeouts, missing indexes, database authorization issues, or Firestore/Redis connectivity drops.

---

## 2. The Corrected Error Handling Flow

To resolve this, we implemented a structured, multi-layered error handling architecture:

```mermaid
graph TD
    A[1. Firestore/Auth SDK throws error] -->|Bubbles up| B["2. Service/Repository (Logs context & RE-THROWS)"]
    B -->|Bubbles up| C["3. API Router/Controller (Catches error)"]
    C -->|Logs trace & returns HTTP 500| D[4. Client Browser (Displays secure error)]
```

### Flow Definition:
1. **Low-Level (Database/Auth SDK)**: Throws a detailed `FirebaseError` containing specific codes and stack traces.
2. **Mid-Level (Services & Repositories)**: 
   * Intercepts the exception in a `try-catch` block.
   * Prints a descriptive warning/error message to standard error (`stderr`) via `console.error` (e.g. `[PublicDiscoveryService] queryList failed for venue_summary`).
   * **Re-throws the original error object** (`throw error;`) to preserve the stack trace and machine-readable metadata.
3. **High-Level (API Router/Controller)**: 
   * Catches the bubbled error in the route-level `try-catch` wrapper.
   * Logs the traceback securely to the backend logs.
   * Returns a standard, secure HTTP error response (e.g., status code `500` with JSON `{ error: "Unable to load events" }`), preventing information leakage to the client browser.

---

## 3. Implemented Changes

### Core Package (`packages/core`)

#### [event-service.ts](file:///c:/internship/thec1rcle/packages/core/src/domain/services/event-service.ts)
* **`listEvents`**: Removed the default empty envelope return. It now re-throws database errors:
  ```typescript
  } catch (error: any) {
    console.error('EventService.listEvents failed:', error.message);
    throw error;
  }
  ```

#### [public-discovery-service.ts](file:///c:/internship/thec1rcle/packages/core/src/domain/services/public-discovery-service.ts)
* **`decodeDiscoveryCursor`**: Replaced the silent `catch {}` with a warning log to record JSON parsing issues while failing gracefully:
  ```typescript
  } catch (error: any) {
    console.warn('[PublicDiscoveryService] decodeDiscoveryCursor failed to parse cursor:', error.message);
  }
  ```
* **Repository Queries (`EventCardIndexRepository`, `HostSummaryRepository`, `VenueSummaryRepository`)**: Updated query methods (`queryList`, `querySearchPrefix`) to re-throw instead of returning empty arrays.
* **`getEventDetail`, `getHostPublicProfile`, `getVenuePublicProfile`**: Removed inline `.catch(() => null)` and `.catch(() => [])` statements from async queries, letting database/indexing errors propagate to the controller layer.

---

### Admin Console (`apps/admin-console`)

#### [adminStore.js](file:///c:/internship/thec1rcle/apps/admin-console/lib/server/adminStore.js)
* **`adminRoleUpdate`**: Re-throws the Custom User Claims sync exception, forcing dual success validation:
  ```javascript
  } catch (error) {
    console.error(`[adminStore] Failed to set custom user claims for admin ${adminId}:`, error);
    throw error;
  }
  ```
* **`computePlatformStats`**: Re-throws the orders query exception if calculating platform revenue/ticket statistics fails, preventing a false `0` revenue report.
* **`checkRecentActionDuplicate`**: Added warning logs to Redis/Firestore catches to ensure connectivity drop visibility.

---

## 4. Verification Plan

### Automated Verification
Run monorepo checks and package tests to ensure no regression or compiler issues:
```bash
# Typecheck
npm run type-check

# Run packages/core unit tests
npm test -w packages/core

# Run api-gateway integration tests
npm test -w apps/api-gateway
```
