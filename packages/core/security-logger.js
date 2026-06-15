/**
 * @c1rcle/core — Security Event Logger
 *
 * Writes security events to Firestore `security_events` collection for long-term
 * analysis and audit trails. All Redis state (blocks, counters, reputation) is
 * ephemeral — this is the permanent record.
 *
 * Design:
 *   - logSecurityEvent() is fire-and-forget — never blocks the calling hot path
 *   - querySecurityEvents() is used by the dashboard API for recent event history
 *   - Silently no-ops when Firebase is not configured (dev/test without creds)
 *
 * Storage model:
 *   Redis  → real-time enforcement (blocks, rate limits, reputation scores)
 *   Firestore → permanent audit trail (what happened, when, and what was done)
 */

import { getAdminDb } from './admin.js';
import { FieldValue } from 'firebase-admin/firestore';

// ── Severity mapping ──────────────────────────────────────────────────────────

const SEVERITY_MAP = {
  CREDENTIAL_STUFFING: 'high',
  PAYMENT_FRAUD: 'high',
  ADMIN_ABUSE: 'critical',
  RATE_LIMIT_BURST: 'medium',
  PATTERN_DETECTED: 'medium',
  SUSPICIOUS_PATTERN: 'medium',
  IP_BLOCKED: 'high',
  USER_BLOCKED: 'high',
  ADMIN_SUSPENDED: 'critical',
  USER_FLAGGED: 'low',
};

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Record a security event to Firestore. Fire-and-forget — never awaited by callers.
 *
 * @param {string} type     - event type (e.g. 'CREDENTIAL_STUFFING', 'PAYMENT_FRAUD')
 * @param {object} data
 * @param {string|null} data.ip
 * @param {string|null} data.uid
 * @param {string|null} data.adminId
 * @param {string|null} data.endpoint
 * @param {string|null} data.reason      - why the event was raised
 * @param {number}      data.count       - counter value at detection time
 * @param {boolean}     data.mitigated   - was auto-mitigation applied?
 * @param {string|null} data.mitigationAction - 'IP_BLOCKED' | 'USER_BLOCKED' | 'ADMIN_SUSPENDED' | 'USER_FLAGGED'
 * @param {string[]}    data.patterns    - detected pattern labels
 * @param {object}      data.metadata    - any additional context
 */
export function logSecurityEvent(type, data = {}) {
  const event = {
    type,
    severity: SEVERITY_MAP[type] || 'low',
    ip: data.ip ?? null,
    uid: data.uid ?? null,
    adminId: data.adminId ?? null,
    endpoint: data.endpoint ?? null,
    reason: data.reason ?? null,
    count: data.count ?? 0,
    mitigated: data.mitigated ?? false,
    mitigationAction: data.mitigationAction ?? null,
    patterns: data.patterns ?? [],
    metadata: data.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  };

  // Deliberately fire-and-forget — errors here must not affect the request
  try {
    const db = getAdminDb();
    db.collection('security_events')
      .add(event)
      .catch(() => {});
  } catch (_) {
    // Firebase not configured (e.g. dev/test without creds) — skip silently
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Query recent security events. Used by the security dashboard API.
 *
 * @param {object} opts
 * @param {number}       opts.limit    - default 50
 * @param {string}       [opts.type]   - filter by event type
 * @param {string}       [opts.severity] - filter by severity
 * @param {boolean}      [opts.mitigatedOnly]
 * @param {any}          [opts.after]  - Firestore cursor for pagination
 * @returns {Promise<Array<{id: string, [key: string]: any}>>}
 */
export async function querySecurityEvents({
  limit = 50,
  type,
  severity,
  mitigatedOnly,
  after,
} = {}) {
  try {
    const db = getAdminDb();
    let q = db.collection('security_events').orderBy('createdAt', 'desc');
    if (type) q = q.where('type', '==', type);
    if (severity) q = q.where('severity', '==', severity);
    if (mitigatedOnly) q = q.where('mitigated', '==', true);
    if (after) q = q.startAfter(after);
    q = q.limit(Math.min(limit, 200));

    const snap = await q.get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        // Convert Firestore Timestamp → ISO string for JSON serialisation
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });
  } catch (_) {
    return [];
  }
}

// ── Incident helpers ──────────────────────────────────────────────────────────

/**
 * Create a security incident record in Firestore.
 * Incidents are the investigatable, assignable, resolvable layer on top of raw events.
 *
 * Status flow:  flagged → under_review → resolved | false_positive
 *
 * @param {object} payload
 * @returns {Promise<string>} incidentId
 */
export async function createIncident(payload) {
  const db = getAdminDb();
  const doc = await db.collection('security_incidents').add({
    entityType: payload.entityType, // 'user' | 'ip' | 'admin'
    entityId: payload.entityId,
    status: 'flagged',
    severity: payload.severity || 'medium',
    reason: payload.reason,
    evidence: payload.evidence || {},
    linkedEventId: payload.linkedEventId || null,
    assignedTo: null,
    createdBy: payload.createdBy,
    resolvedBy: null,
    resolution: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return doc.id;
}

/**
 * Update an incident's status, assignment, or resolution.
 *
 * @param {string} incidentId
 * @param {object} updates  - subset of { status, assignedTo, resolution, resolvedBy }
 */
export async function updateIncident(incidentId, updates) {
  const db = getAdminDb();
  const allowed = ['status', 'assignedTo', 'resolution', 'resolvedBy', 'severity'];
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  await db
    .collection('security_incidents')
    .doc(incidentId)
    .update({
      ...safe,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Query security incidents.
 *
 * @param {object} opts
 * @param {string}  [opts.status]   - filter by status
 * @param {string}  [opts.severity] - filter by severity
 * @param {string}  [opts.entityType]
 * @param {number}  [opts.limit]
 * @param {any}     [opts.after]
 * @returns {Promise<Array>}
 */
export async function queryIncidents({ status, severity, entityType, limit = 50, after } = {}) {
  try {
    const db = getAdminDb();
    let q = db.collection('security_incidents').orderBy('createdAt', 'desc');
    if (status) q = q.where('status', '==', status);
    if (severity) q = q.where('severity', '==', severity);
    if (entityType) q = q.where('entityType', '==', entityType);
    if (after) q = q.startAfter(after);
    q = q.limit(Math.min(limit, 200));

    const snap = await q.get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });
  } catch (_) {
    return [];
  }
}

/**
 * Get a single incident by ID.
 */
export async function getIncident(incidentId) {
  try {
    const db = getAdminDb();
    const doc = await db.collection('security_incidents').doc(incidentId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
    };
  } catch (_) {
    return null;
  }
}
