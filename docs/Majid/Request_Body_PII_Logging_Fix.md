# Fix: Request Body PII / Token Exposure via Proxy Logs

## 1) What was actual Bug
The Next.js proxy route for partner endpoints (`/api/partners/[...path]/route.ts`) was logging the complete incoming request body payload to the standard output / console logs:
```typescript
console.log(`[BFF Proxy] Request Body Payload:`, text);
```
Since this acts as a Backend-For-Frontend (BFF) proxy forwarding client requests to the backend API Gateway, the request body (`text`) often contains sensitive credentials, access/refresh tokens, and Personally Identifiable Information (PII) such as passwords, email addresses, names, and phone numbers.
Logging unredacted request payloads is a security risk (**[CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html)**):
* **Log Exposure**: Server logs are cached or aggregated in plaintext in cloud log systems (AWS CloudWatch, Datadog, etc.), where they can be viewed by unauthorized staff or compromised.
* **Compliance Violations**: Storing plaintext credentials and PII in system logs violates GDPR, HIPAA, and PCI-DSS compliance regulations.

Additionally, the incoming request URL and proxy target URL (which may contain sensitive tokens, invitations, or codes in query parameters) were logged in plaintext.

## 2) What is solution to solve that Bug
The solution requires:
1. **Removing payload logging**: Eliminate standard output/log printing of unredacted request bodies containing sensitive fields.
2. **Redacting URL parameters**: Implement utility methods to automatically inspect and mask/redact sensitive query parameters (e.g., `token`, `temp`, `password`, `key`, `code`, `secret`, `email`) in logged proxy request and target URLs.
3. **Preserving pipeline integrity**: Keep the underlying forwarding payload (`init.body = text`) intact so that headers, body payloads, and form data continue to propagate perfectly from proxy layer to API gateway to backend.

## 3) What Changes You made to fix this Bug
1. **Removed Request Body Logging**:
   * Removed the `console.log("[BFF Proxy] Request Body Payload:", text);` statement from [route.ts](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/app/api/partners/%5B...path%5D/route.ts#L208).
2. **Implemented Log Redaction Helpers**:
   * Added `redactQueryString(searchStr: string): string` to scan query parameters and replace values of keys containing sensitive terms (like `token`, `temp`, `password`, `key`, `code`, `secret`, `email`) with `[REDACTED]`.
   * Added `redactUrl(urlStr: string): string` to apply the redaction logic to full URLs or relative path strings safely.
3. **Updated Log Statements to Use Redacted Data**:
   * Updated the proxy incoming request log, the response status log, and the error handler log in [route.ts](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/app/api/partners/%5B...path%5D/route.ts) to print the redacted search parameters and target URLs instead of raw values.
4. **Validated Pipeline Flow**:
   * Ensured that only log representation is modified, ensuring zero impact on the network request forwarding pipeline (Frontend -> BFF Proxy -> API Gateway -> Backend).
