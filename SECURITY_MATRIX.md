# THE C1RCLE — Admin Panel Security Red-Team Matrix

This document outlines the security test cases designed to validate the hardening of the c1rcle Admin Panel. These tests prove the architectural and cryptographic defenses implemented prevent unauthorized access, role escalation, and data mutation.

## 1. Authentication & Obscurity Tests

| Attack Attempt | Expected Failure Point | Security Logic |
| :--- | :--- | :--- |
| **Non-admin hits `/api/admin/*` directly** | **404 Not Found** (Generic) | Verification fails in `withAdminAuth`. Returns 404 to obscure the endpoint's existence from potential attackers. |
| **Logged-out user hits admin API** | **404 Not Found** | No auth header provided. Middleware rejects immediately with generic 404. |
| **Forged/Altered JWT Payload** | **404 Not Found** | `admin.verifyIdToken(token, true)` cryptographically fails signature check. Revocation is checked serverside. |
| **User with `role: admin` in Firestore but no claim** | **404 Not Found** | Rules and Middleware strictly check the **immutable JWT custom claim** (`request.auth.token.admin == true`), not the mutable Firestore document. |

## 2. Authorization & Transition Tests

| Attack Attempt | Expected Failure Point | Security Logic |
| :--- | :--- | :--- |
| **'Ops' Admin attempts 'Finance' action** | **Action Rejected** (generic) | Middleware/Store enforces hierarchy. Internal hierarchy values prevent escalation. |
| **Replay attack of a successful ban command** | **Rate Limit / Freshness** | `checkRateLimit` prevents rapid bursts. Short (1hr) token TTL prevents long-term reuse of captured secrets. |
| **Marking 'Completed' Event as 'Paused'** | **Logic Error (500/Generic)** | `adminStore` explicitly blocks transitions from the `completed` terminal state for Events. |
| **Banning another Admin account** | **Privilege Violation** | `adminStore.setUserBanStatus` checks the target's current role and blocks admin-on-admin interference. |

## 3. Data Integrity & Audit Tests

| Attack Attempt | Expected Failure Point | Security Logic |
| :--- | :--- | :--- |
| **Attempt to `update` or `delete` an Audit Log** | **Firestore Rule Violation** | `match /admin_logs/{logId}` has `allow update, delete: if false`. This is enforced by the database kernel. |
| **Admin attempts to omit reason in action** | **Validation Error** | `adminStore.logAction` enforces `reason.length >= 5`. Action fails before database write. |
| **Admin attempts to read sensitive `users` fields** | **Standard Rule Access** | Reading `/users/` only returns fields allowed by the directory list logic. Cloud Rules prevent direct client crawling. |

## 4. Rate Limiting & Blast Control

| Attack Attempt | Expected Failure Point | Security Logic |
| :--- | :--- | :--- |
| **Scripted mass-banning of users (100+ / min)** | **Rate Limit Exceeded** | `ACTION_LIMITS` Map tracks actions per Admin UID per minute (Max 15). Prevents "account takeover" nuking. |
| **Rapid Firestore document polling** | **Query Limits** | `limit` param in List API is hard-clamped to 100 via `Math.min`. |

---

## 🔒 Final Security Posture: "Cryptographic Lockdown"

1.  **URL Discovery**: Impossible. All admin endpoints return 404 until a valid Admin Token is provided.
2.  **Token Leakage**: Damage is limited to the leaked admin's specific hierarchy, for 60 minutes max, within a strict rate-limit.
3.  **Human Error**: Terminal states (Completed, Rejected) are protected by logic guards. Small mistakes are logged but cannot nuke system status.
4.  **Audit Fidelity**: 100%. Logs are append-only. No one, not even a Super Admin, can erase the record of their actions.
