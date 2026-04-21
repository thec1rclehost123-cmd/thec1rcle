# Backend Boundary PR Checklist

Every PR that adds or changes an API route must answer:

1. Why is this not a Fastify route?
2. If this is a Next.js route, which class is it: `allowed_web_helper`, `temporary_bridge`, or `legacy_backend_logic`?
3. Does it preserve parity with the current behavior while migrating ownership?
4. Does it forward `Authorization` and `x-request-id` correctly if it bridges to Fastify?
5. Does it avoid direct Firebase/Admin access for protected business flows?
6. If it is a temporary bridge, which migration phase removes it?
7. If it mutates protected data in Fastify, does it use the shared audit helper?
8. If it introduces a new legacy exception, why is that unavoidable right now?

