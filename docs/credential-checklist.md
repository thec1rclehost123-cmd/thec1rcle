# Credential Security Checklist

Every PR that introduces, stores, or transmits a credential (password, token, API key, invite code, QR payload) must answer:

## Design

1. Does this credential need to exist at all, or can we use a one-time signed token / magic link / OAuth flow instead?
2. Is the credential ever stored in a database (Firestore, Redis, Postgres)? If yes, is it encrypted at rest?
3. Is the credential ever returned in an API response body? If yes, can the consumer get it a different way?
4. Is the credential ever transmitted over email? If yes, can we send a link instead of the credential itself?
5. Is the endpoint that consumes this credential authenticated? If not, what prevents a leaked URL from being exploited?

## Implementation

6. Does the credential flow through more than one of: database, API response, email? Eliminate at least one.
7. Is the credential ever visible in server logs (console.log, structured logging)? If yes, redact it.
8. If the credential is a generated temp password: is it single-use, and is it never stored alongside the user's data?
9. If the credential is consumed by a public endpoint: is the endpoint rate-limited? Does it require proof of ownership?
10. If encryption is used to protect the credential: does the consumer verify that decryption actually occurred (rejects raw plaintext)?
11. If the check involves an external service (Redis, Firestore): does it fail open or fail closed? Default to closed.

## Post-Merge

12. Are there automated tests that assert the credential is not returned in API responses (regression guard)?
13. Are there automated tests that assert the credential is not written to the database in plaintext?
14. Are there automated tests that assert unauthenticated/allowed-only access to credential-consuming endpoints?
