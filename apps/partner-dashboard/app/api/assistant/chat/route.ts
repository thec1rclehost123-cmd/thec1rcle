/**
 * POST /api/assistant/chat
 *
 * Partner Dashboard AI Assistant — Chat API Route
 *
 * Security model:
 *   1. Verify Firebase ID token — reject unauthenticated requests
 *   2. Resolve user's partner context from Firestore (partnerId, role, partnerType)
 *   3. Build permission context (resolves permissions from role)
 *   4. Pass to orchestrator — all tool calls enforce permissions internally
 *   5. Log access for audit
 *
 * This route NEVER trusts client-supplied partner context.
 * The user's role and partnerId are always resolved from the verified token.
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/auth';
import { buildPermissionContext } from '@/lib/assistant/permission-gate';
import { orchestrate } from '@/lib/assistant/orchestrator';
import type { AssistantChatRequest, AssistantPermissionContext } from '@/lib/assistant/types';

// ── Context Resolution ────────────────────────────────────────────────────────

/**
 * Resolve the partner context from the verified token's custom claims.
 * Falls back to Firestore if claims are incomplete.
 */
async function resolvePartnerContext(
    decodedToken: any,
    request: Request
): Promise<AssistantPermissionContext | null> {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim() || '';

    // Primary: use JWT custom claims (set at onboarding)
    const { uid } = decodedToken;
    const partnerIdFromClaims = decodedToken.partnerId as string | undefined;
    const partnerTypeFromClaims = decodedToken.partnerType as string | undefined;
    const roleFromClaims = decodedToken.partnerRole as string | undefined;

    if (partnerIdFromClaims && partnerTypeFromClaims && roleFromClaims) {
        // Normalize 'club' -> 'venue' for backward compat
        const partnerType = (partnerTypeFromClaims === 'club' ? 'venue' : partnerTypeFromClaims) as AssistantPermissionContext['partnerType'];
        return buildPermissionContext(
            uid,
            partnerIdFromClaims,
            decodedToken.partnerName || partnerIdFromClaims,
            partnerType,
            roleFromClaims as AssistantPermissionContext['role'],
            token
        );
    }

    // Fallback: resolve from Firestore partner_memberships collection
    try {
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const db = getAdminDb();

        const membershipSnap = await db.collection('partner_memberships')
            .where('uid', '==', uid)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (membershipSnap.empty) {
            // Check if user is a venue owner (direct ownership)
            const venueSnap = await db.collection('venues')
                .where('ownerId', '==', uid)
                .limit(1)
                .get();

            if (!venueSnap.empty) {
                const venueData = venueSnap.docs[0].data();
                return buildPermissionContext(
                    uid,
                    venueSnap.docs[0].id,
                    venueData.name || venueSnap.docs[0].id,
                    'venue',
                    'OWNER',
                    token
                );
            }

            // Check host ownership
            const hostSnap = await db.collection('hosts')
                .where('ownerId', '==', uid)
                .limit(1)
                .get();

            if (!hostSnap.empty) {
                const hostData = hostSnap.docs[0].data();
                return buildPermissionContext(
                    uid,
                    hostSnap.docs[0].id,
                    hostData.displayName || hostData.name || hostSnap.docs[0].id,
                    'host',
                    'OWNER',
                    token
                );
            }

            return null;
        }

        const membership = membershipSnap.docs[0].data();
        const partnerType = (membership.partnerType === 'club' ? 'venue' : membership.partnerType) as AssistantPermissionContext['partnerType'];

        return buildPermissionContext(
            uid,
            membership.partnerId,
            membership.partnerName || membership.partnerId,
            partnerType,
            membership.role as AssistantPermissionContext['role'],
            token
        );
    } catch (err: any) {
        console.error('[AssistantChat] Failed to resolve partner context:', err.message);
        return null;
    }
}

// ── Rate Limit (simple in-memory, per-user) ───────────────────────────────────

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;              // 20 requests per minute per user
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(uid: string): boolean {
    const now = Date.now();
    const entry = requestCounts.get(uid);
    if (!entry || now > entry.resetAt) {
        requestCounts.set(uid, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    entry.count++;
    if (entry.count > RATE_LIMIT) return false;
    return true;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

function auditLog(entry: {
    uid: string;
    partnerId: string;
    partnerType: string;
    role: string;
    query: string;
    toolsUsed: string[];
    latencyMs: number;
    answerType: string;
    denied?: boolean;
    denialReason?: string;
}) {
    // In Phase 1, write to stdout for log aggregation (Sentry/CloudWatch picks this up)
    console.log('[AssistantAudit]', JSON.stringify(entry));
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    const start = Date.now();

    // 1. Verify auth
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uid } = decodedToken;

    // 2. Rate limit
    if (!checkRateLimit(uid)) {
        return NextResponse.json(
            { error: 'Too many requests. Please wait a moment.' },
            { status: 429 }
        );
    }

    // 3. Parse request body
    let body: AssistantChatRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { message, session } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 500) {
        return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 });
    }

    // 4. Resolve partner context (server-side — never trust client)
    const ctx = await resolvePartnerContext(decodedToken, request);
    if (!ctx) {
        auditLog({
            uid, partnerId: 'unknown', partnerType: 'unknown', role: 'unknown',
            query: message, toolsUsed: [], latencyMs: Date.now() - start,
            answerType: 'error', denied: true, denialReason: 'No partner context',
        });
        return NextResponse.json({
            answer: {
                type: 'scoped_refusal',
                text: "Your account doesn't have an active partner membership. Please complete onboarding first.",
                dataFreshness: 'unavailable',
            },
            latencyMs: Date.now() - start,
            toolsUsed: [],
        });
    }

    // 5. Run orchestrator
    try {
        const result = await orchestrate(message, session || { history: [] }, ctx);

        auditLog({
            uid,
            partnerId: ctx.partnerId,
            partnerType: ctx.partnerType,
            role: ctx.role,
            query: message,
            toolsUsed: result.toolsUsed,
            latencyMs: result.latencyMs,
            answerType: result.answer.type,
        });

        return NextResponse.json({
            answer: result.answer,
            latencyMs: result.latencyMs,
            toolsUsed: result.toolsUsed,
        });

    } catch (err: any) {
        console.error('[AssistantChat] Orchestrator error:', err.message);

        auditLog({
            uid, partnerId: ctx.partnerId, partnerType: ctx.partnerType, role: ctx.role,
            query: message, toolsUsed: [], latencyMs: Date.now() - start,
            answerType: 'error', denied: false, denialReason: err?.message,
        });

        return NextResponse.json({
            answer: {
                type: 'error',
                text: "Something went wrong. Please try again.",
                dataFreshness: 'unavailable',
            },
            latencyMs: Date.now() - start,
            toolsUsed: [],
        }, { status: 500 });
    }
}
