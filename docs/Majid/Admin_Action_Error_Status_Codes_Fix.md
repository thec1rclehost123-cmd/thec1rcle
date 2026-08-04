# Admin Action Error Status Codes Fix

## 1. What was the actual Bug?
In `apps/admin-console/app/api/actions/route.js`, the catch block at the end of the POST handler catches any errors bubbled up during validation or execution and defaults to returning a `500 Internal Server Error` when `error.statusCode` is not defined:
```javascript
  } catch (error) {
    ...
    return NextResponse.json(
      {
        error: 'Internal server error',
        correlationId: req.user?.requestId || 'N/A',
      },
      { status: error.statusCode || 500 },
    );
  }
```
Because validation errors (e.g., in `DATABASE_CORRECTION` and default cases inside the route handler) and authority check or governance violation errors thrown inside `adminStore.js` were instantiated as standard JavaScript `Error` objects (e.g. `throw new Error('Not Found')` or `throw new Error('Invalid params')`), they did not carry a `.statusCode` property. 

As a result:
- The HTTP status code always defaulted to `500`.
- The client-facing error message was masked and hardcoded as `'Internal server error'`, preventing the admin panel frontend from showing clear validation or authorization error messages to the admin user.

---

## 2. What is the solution to solve that Bug?
The solution involves two layers of error propagation:
1. **Explicit Status Code Assignment:** Assigning a `.statusCode` property to custom/standard errors thrown in known control flow paths (inline route checks, `validateAuthority`, `resolveProposal`) so that the catch block receives the exact intended status code (e.g., `400` for bad request/validation errors, `403` for authority/governance violations, `404` for not found errors).
2. **Global Fallback Mapping & Message Retention:** Enhancing the catch block in the route handler to check `error.statusCode`. If it is missing, we parse the `error.message` for key patterns (like `'not found'`, `'unauthorized'`, `'governance violation'`, `'invalid'`, etc.) and map them dynamically. We return the actual `error.message` in the JSON response for client-facing errors (4xx) while safely returning `'Internal server error'` only for actual server errors (500) to preserve security.

---

## 3. What Changes were made to fix this Bug?

### A. Next.js API Route Handler
Modified **[route.js](file:///c:/Users/majid/thec1rcle/apps/admin-console/app/api/actions/route.js)**:
- Updated inline error throws inside `DATABASE_CORRECTION` and the `default` fallback to set `err.statusCode` explicitly to `404` or `400` before throwing.
- Rewrote the global `catch` block to:
  - Check if `error.statusCode` exists.
  - Dynamically map `error.message` to `404`, `403`, or `400` status codes if `error.statusCode` is absent.
  - Respond with the specific `error.message` for non-500 status codes, and only fall back to `'Internal server error'` for actual 500 status codes.

### B. Admin Console Store
Modified **[adminStore.js](file:///c:/Users/majid/thec1rcle/apps/admin-console/lib/server/adminStore.js)**:
- Updated the `validateAuthority` helper to set `err.statusCode = 400` for unknown/unmapped actions, and `err.statusCode = 403` for role clearance check failures.
- Updated `resolveProposal` transaction to set `err.statusCode = 404` when the action proposal is not found, and `err.statusCode = 403` for dual-control policy violations (proposer attempting to resolve their own request).
