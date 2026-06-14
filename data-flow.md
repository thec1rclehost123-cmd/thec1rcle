# C1RCLE Architecture Data Flow

## 1. Core Principles
1. **No direct database access from frontend apps.** React Native, Next.js client, and Next.js server components MUST NOT query Firebase/Firestore directly using the client SDKs.
2. **Centralized API Gateway.** The `api-gateway` (Fastify API) is the single entry point for all frontend apps to communicate with backend services (Database, Redis, Search, Jobs).
3. **BFF (Backend-For-Frontend).** Next.js applications (`partner-dashboard`, `guest-portal`, `admin-console`) use their internal `/api/*` proxies or server-actions. These proxies use a server-side `apiClient` to communicate securely with `api-gateway`.

## 2. Architecture Diagram

```mermaid
graph TD
    subaxis Frontend Clients
    MP[Mobile App - React Native]
    PD[Partner Dashboard - Next.js UI]
    GP[Guest Portal - Next.js UI]
    AC[Admin Console - Next.js UI]
    end

    subaxis BFF Proxy APIs
    PDA[Partner Dashboard Next.js /api]
    GPA[Guest Portal Next.js /api]
    ACA[Admin Console Next.js /api]
    end

    subaxis Core Backend
    AGW[API Gateway - Fastify]
    CORE[@c1rcle/core & Repositories]
    end

    subaxis State & Storage
    DB[(Firebase Firestore)]
    CACHE[(Redis Cache)]
    IN[Inngest Background Jobs]
    end

    MP --> |REST / WebSockets| AGW
    
    PD --> |Fetch| PDA
    PDA --> |apiClient Fetch| AGW
    
    GP --> |Fetch| GPA
    GPA --> |apiClient Fetch| AGW
    
    AC --> |Fetch| ACA
    ACA --> |apiClient Fetch| AGW

    AGW --> |Zod Validate & Extract| CORE
    CORE <--> |Read/Write| DB
    CORE <--> |Cache| CACHE
    CORE --> |Dispatch| IN
```

## 3. Request Lifecycle (Example: Create Event)

1. The Venue Partner fills out a form in `partner-dashboard` UI.
2. The UI sends a `POST /api/venue/events` request to the Next.js BFF route.
3. The Next.js BFF server extracts the user's Firebase auth token and forwards the request to `POST https://api.thec1rcle.com/api/v1/events` via `apiClient`.
4. `api-gateway` receives the request. The Fastify request lifecycle includes:
   - Token validation via `onRequest` hook.
   - RBAC checking via `verifyPartnerAccess`.
   - Zod schema validation of request body payloads.
5. The `api-gateway` delegates data manipulation to `@c1rcle/core/event-service`.
6. `@c1rcle/core` interacts with Firestore via Admin SDK.
7. Any necessary Redis cache invalidation or Inngest jobs (e.g. processing images) are fired.
8. The result is returned back up the chain to the UI.
