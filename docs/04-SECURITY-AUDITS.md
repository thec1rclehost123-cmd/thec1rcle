# Security & Audits Documentation

## Overview

This document covers security architecture, authentication, authorization, data protection, and audit logging for THE C1RCLE platform.

---

## Table of Contents
1. [Authentication](#authentication)
2. [Authorization & RBAC](#authorization--rbac)
3. [Data Protection](#data-protection)
4. [API Security](#api-security)
5. [Audit Logging](#audit-logging)
6. [Compliance](#compliance)
7. [Security Checklist](#security-checklist)

---

## Authentication

### Firebase Auth Integration

The API Gateway uses Firebase Admin SDK for authentication:

```typescript
// From plugins/firebase.ts
fastify.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return;

    const token = authHeader.split(' ')[1];
    try {
        const user = await authService.verifyToken(token);
        if (user) {
            request.user = user;  // Populated with decoded token
        }
    } catch (error) {
        request.log.warn('Auth verification failed');
    }
});
```

### Token Validation Flow

```
Client (Mobile/Web)                    Firebase Auth              API Gateway
     │                                       │                         │
     │ 1. User logs in with email/password   │                         │
     │    (or social provider)              │                         │
     │──────────────────────────────────────>│                         │
     │<──────────────────────────────────────│                         │
     │    Firebase ID Token                  │                         │
     │                                       │                         │
     │ 2. Include token in API requests      │                         │
     │    Authorization: Bearer <token>    │                         │
     │─────────────────────────────────────────────────────────────────>│
     │                                       │    3. Verify token      │
     │                                       │<─────────────────────────>
     │                                       │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ >
     │                                       │    4. Decoded token     │
     │                                       │    { uid, email, etc } │
     │                                       │                         │
     │<─────────────────────────────────────────────────────────────────│
     │    Request processed with user context                            │
```

### Token Types Supported

| Provider | Token Format | Use Case |
|----------|-------------|----------|
| Email/Password | Firebase ID Token | Regular users |
| Google Sign-In | Firebase ID Token | Social login |
| Anonymous | Firebase Anonymous Auth | Guest checkout |

---

## Authorization & RBAC

### Role-Based Access Control (RBAC)

Roles and permissions are defined in `packages/core/staff-engine.js`:

```javascript
ROLE_PRESETS = {
    owner: {
        permissions: [
            'viewEvents', 'editEvents', 'deleteEvents', 'publishEvents',
            'viewFinance', 'manageFinance',
            'viewGuests', 'manageGuests',
            'scanTickets', 'viewScans',
            'manageStaff', 'editStaff', 'removeStaff',
            'viewSettings', 'editSettings',
            'viewAnalytics'
        ]
    },
    manager: {
        permissions: [
            'viewEvents', 'editEvents', 'publishEvents',
            'viewFinance',
            'viewGuests', 'manageGuests',
            'scanTickets', 'viewScans',
            'manageStaff', 'editStaff',
            'viewAnalytics'
        ]
    },
    ops: {
        permissions: [
            'viewEvents', 'editEvents',
            'viewGuests',
            'scanTickets', 'viewScans'
        ]
    },
    viewer: {
        permissions: [
            'viewEvents'
        ]
    }
};
```

### Permission Check Implementation

```typescript
// From staff-engine.js
export async function hasStaffPermission(db, venueId, userId, permission) {
    // 1. Get user from Firestore Auth
    const userRecord = await db.collection('users').doc(userId).get();
    const userData = userRecord.data();

    // 2. Check if user is venue owner
    const venueDoc = await db.collection('venues').doc(venueId).get();
    if (venueDoc.exists && venueDoc.data()?.ownerId === userId) {
        return true;  // Owner has all permissions
    }

    // 3. Check staff membership
    const membershipSnapshot = await db.collection('partner_memberships')
        .where('partnerId', '==', venueId)
        .where('uid', '==', userId)
        .get();

    if (membershipSnapshot.empty) return false;

    const membership = membershipSnapshot.docs[0].data();
    const rolePermissions = ROLE_PRESETS[membership.role]?.permissions || [];

    return rolePermissions.includes(permission);
}
```

### Using Permissions in Routes

```typescript
// Example from routes/v1/staff.ts
fastify.post('/staff/:venueId', async (request, reply) => {
    const { venueId } = request.params;
    const actorId = request.user?.uid;

    // Check permission
    const canInvite = await hasStaffPermission(fastify.db, venueId, actorId, 'manageStaff');
    if (!canInvite) {
        return reply.status(403).send({ error: 'Forbidden: manageStaff permission required' });
    }

    // Proceed with staff invitation...
});
```

### Partner Access Verification

```typescript
// From plugins/firebase.ts - verifyPartnerAccess method
fastify.decorate('verifyPartnerAccess', async (request, partnerId) => {
    // 1. Direct ownership check (venues and hosts)
    const venueDoc = await db.collection('venues').doc(partnerId).get();
    if (venueDoc.exists && venueDoc.data()?.ownerId === uid) return true;

    const hostDoc = await db.collection('hosts').doc(partnerId).get();
    if (hostDoc.exists && hostDoc.data()?.ownerId === uid) return true;

    // 2. Staff membership check
    const membership = await db.collection('partner_memberships')
        .where('partnerId', '==', partnerId)
        .where('uid', '==', uid)
        .get();

    if (!membership.empty) {
        const role = membership.docs[0].data().role;
        if (['owner', 'manager'].includes(role)) return true;
    }

    // 3. Admin check
    const adminDoc = await db.collection('admins').doc(uid).get();
    if (adminDoc.exists) return true;

    throw new Error('Forbidden: No access to this partner');
});
```

---

## Data Protection

### Sensitive Data Handling

| Data Type | Storage | Protection |
|-----------|---------|------------|
| Passwords | Firebase Auth (hashed) | Never stored in DB |
| Payment Info | Razorpay (PCI-DSS) | Not stored locally |
| Private Keys | Environment variables | Encrypted at rest |
| User Emails | Firestore | ACL controlled |
| Phone Numbers | Firestore | ACL controlled |

### Environment Variables (DO NOT COMMIT)

```bash
# .env (add to .gitignore)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY..."

RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

REDIS_URL=redis://...
JWT_SECRET=...
```

### Data Sanitization

```typescript
// From events.js - mapEventForClient
export function mapEventForClient(data, id) {
    // Remove sensitive fields
    const settings = { ...data.settings };
    if (settings.passwordCode) delete settings.passwordCode;

    return {
        ...data,
        settings,
        // ... public fields only
    };
}
```

---

## API Security

### Authentication Middleware

All protected routes go through the auth hook in `plugins/firebase.ts`:

```typescript
fastify.addHook('onRequest', async (request, reply) => {
    const publicPaths = ['/health', '/events', '/payments/config'];
    if (publicPaths.some(p => request.url.startsWith(p))) {
        return;  // Skip auth for public paths
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        // For some routes, allow optional auth
        if (!request.routeOptions?.config?.allowAnonymous) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
    }
});
```

### Request Validation

All user inputs should be validated. Example from checkout:

```typescript
fastify.post('/checkout/reserve', async (request, reply) => {
    const { eventId, items } = request.body;

    if (!eventId || !items?.length) {
        return reply.status(400).send({ error: 'Missing required fields' });
    }

    // Validate items structure
    for (const item of items) {
        if (!item.tierId || typeof item.quantity !== 'number') {
            return reply.status(400).send({ error: 'Invalid item structure' });
        }
    }

    // Proceed...
});
```

### Payment Signature Verification

```typescript
// From routes/v1/payments.ts
const data = `${razorpay_order_id}|${razorpay_payment_id}`;
const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(data)
    .digest("hex");

if (expected !== razorpay_signature) {
    return reply.status(400).send({ error: 'Invalid signature' });
}
```

### Rate Limiting (Planned)

Redis-based rate limiting will be implemented:
- 100 requests/minute per IP
- 1000 requests/minute per authenticated user
- Different limits for write vs read operations

---

## Audit Logging

### Request Logging

All requests are logged with duration metrics:

```typescript
// From app.ts
server.addHook('onResponse', async (request, reply) => {
    const hrtime = process.hrtime(request.startTime);
    const durationMs = (hrtime[0] * 1e3 + hrtime[1] * 1e-6).toFixed(2);

    server.log.info({
        url: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        durationMs,
        userId: request.user?.uid
    }, 'Request completed');
});
```

### Audit Trail for Sensitive Operations

| Operation | Logged Fields |
|-----------|---------------|
| Order Created | userId, orderId, amount, eventId |
| Payment Verified | userId, orderId, razorpayPaymentId |
| Refund Initiated | adminId, orderId, amount, reason |
| Staff Added | adminId, staffEmail, role, venueId |
| Event Published | actorId, eventId, previousState, newState |

### Log Storage

- **Development**: Console output (pino-pretty)
- **Production**: Firebase Cloud Logging
- **Metrics**: Datadog/Prometheus integration (planned)

---

## Compliance

### Data Retention

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Orders | 7 years | Tax compliance |
| User Data | Until deletion request | GDPR |
| Event Data | 2 years after completion | Analytics |
| Audit Logs | 1 year | Security |

### User Rights (GDPR)

| Right | Implementation |
|-------|----------------|
| Access | GET /profiles/:id endpoint |
| Rectification | PATCH /profiles/me |
| Erasure | DELETE /profiles/me (soft delete) |
| Portability | Export in JSON format |

### Security Headers

```typescript
// Recommended middleware
reply.header('X-Content-Type-Options', 'nosniff');
reply.header('X-Frame-Options', 'DENY');
reply.header('X-XSS-Protection', '1; mode=block');
reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
```

---

## Security Checklist

### For Developers

- [ ] Never commit secrets to git
- [ ] Always validate user input
- [ ] Use parameterized queries (Firestore handles this)
- [ ] Check permissions before mutations
- [ ] Log security-relevant events
- [ ] Use TypeScript for type safety
- [ ] Run ESLint before commits
- [ ] Test edge cases in authorization

### For Code Review

- [ ] Verify auth checks on mutations
- [ ] Check for SQL/NoSQL injection patterns
- [ ] Ensure sensitive data not exposed in responses
- [ ] Validate error messages don't leak info
- [ ] Confirm rate limiting where needed

### Infrastructure

- [ ] Firebase rules properly configured
- [ ] Firestore indexes secure
- [ ] API keys rotated regularly
- [ ] SSL/TLS enforced
- [ ] CORS configured correctly
- [ ] Redis auth enabled
- [ ] Backup strategy in place

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. **DO** email security@thec1rcle.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## References

- Firebase Security: https://firebase.google.com/docs/security
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- GDPR Reference: https://gdpr.eu/

---

*Last Updated: May 2026*