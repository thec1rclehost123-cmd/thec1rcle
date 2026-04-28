# Guest Portal Auth Flow

This is the canonical guest auth structure for the Guest Portal:

- `/login` is the main auth funnel
- `/signup` is an alias of `/login` in signup mode
- `/login?next=...&onboarding=1` is the onboarding continuation surface
- `/auth/callback` is the session handoff surface
- `/profile` is only a redirect shell into `/profile/:uid`
- `/auth` is a legacy route that immediately redirects into `/login`

```mermaid
flowchart TD
    A["Protected intent or direct profile entry"] --> B["/login?next=/profile"]

    B --> C{"Auth method"}
    C -->|Email login| D["POST /api/v1/auth/check"]
    D -->|Existing account| E["POST /api/v1/auth/login"]
    D -->|No account| F["Signup steps on /login or /signup"]
    C -->|Google| G["GET /api/v1/auth/google/start?next=/auth/callback?next=..."]

    F --> F1["Phone -> Name -> Age -> Gender -> City -> OTP"]
    F1 --> H["POST /api/v1/auth/register"]

    E --> I["AuthProvider applies bootstrap"]
    H --> I
    G --> J["Google callback sets session cookie and returns to /auth/callback"]

    I --> K["/auth/callback?next=..."]
    J --> K

    K --> L{"Onboarding complete?"}
    L -->|No| M["/login?next=...&onboarding=1"]
    M --> N["PATCH guest profile updates"]
    N --> K
    L -->|Yes| O["Redirect to next route"]

    O --> P["/profile"]
    P --> Q["/profile/:uid"]
    Q --> R["GET /api/v1/guest-profiles/:id"]
```
