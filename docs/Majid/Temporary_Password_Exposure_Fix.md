# Fix: Temporary Password Exposure and Storage Hardening

## 1) What was actual Bug
The application had two major security flaws regarding the handling of temporary invitation passwords:
1. **URL Query Parameter Exposure**: The temporary password was passed as a query string parameter (`?temp=...`) in browser URLs, exposing it to browser histories, reverse proxy logs, and HTTP `Referer` headers.
2. **Plain-Text Storage at Rest**: The temporary password was stored in plain text inside the Cloud Firestore database (under `venue_staff` and `host_team_invitations` collections in the `tempPassword` field), leaving it exposed to anyone with database read access.

## 2) What is solution to solve that Bug
1. **Eliminate URL Transmission**: Pass the temporary credentials exclusively via the email body and via in-memory secure HTTPS `POST` response payloads (never in the GET query strings).
2. **Encryption at Rest**: Encrypt the temporary password using `AES-256-CBC` symmetric encryption before saving it to Firestore. Decrypt it on-the-fly inside the API Gateway using the encryption helper functions (`encrypt` / `decrypt`) when validating or accepting invitations.

## 3) What Changes You made to fix this Bug

### Frontend (Partner-Dashboard App)
* **`staff-invite/page.tsx`**: Removed all URL parsing logic (`searchParams.get('temp')`), dependencies, and redirection parameters. Dropped the storage of the temporary password in browser `sessionStorage`.
* **`change-password/page.tsx`**: Removed the `useEffect` that looked up the password in `sessionStorage` or query strings.

### Backend (API Gateway App)
* **`routes/v1/partners/venues.ts`**: Encrypted the temporary password (`encrypt(tempPassword)`) when saving new venue staff invitation documents to Firestore.
* **`routes/v1/venues.ts`**: Decrypted the temporary password (`decrypt(staffData.tempPassword)`) when validating/accepting venue staff invitations.
* **`routes/v1/partners/hosts.ts`**: Encrypted the password when creating host invitations, and decrypted it when validating/accepting host invitations.
* **`routes/v1/scan.ts`**: Decrypted the temporary password (`decrypt(staffData.tempPassword)`) when checking door/scanner staff passwords.

---

## 4) Troubleshooting: 404 (Not Found) on Invitation Acceptance

### Cause of the Error
If you receive a `404 (Not Found)` error when visiting the accept page (e.g. `http://localhost:3001/api/venue/staff/accept`), it can be caused by one of two scenarios:
1. **Database Reset**: The local Firestore emulator was restarted/wiped. Consequently, the invite token in the URL no longer exists in Firestore, causing the query to return empty (404).
2. **Stale Next.js Dev Server Cache**: The Next.js dev server (on port 3001) was running in a stale state (e.g. before the git checkout/reset synced the committed route files). This causes Next.js to not register the `/api/venue/staff/accept` route file properly and return a Next.js 404 HTML page.

### How to Resolve
1. **Restart the Next.js Dev Server**:
   Stop the Next.js process running on port 3001 (e.g., kill the process or restart the terminal task) and run:
   ```bash
   npm run dev:partner
   ```
   This rebuilds the Next.js App Router registry and registers the API route.
2. **Generate a New Invitation**:
   Create a new invitation from the dashboard to write a fresh, valid token to Firestore, then click the new link.
