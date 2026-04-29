import fp from 'fastify-plugin';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// @ts-ignore
import { FirebaseAuthService } from '@c1rcle/core/auth-infra';
// @ts-ignore
import { FirebaseProfileRepository } from '@c1rcle/core/profile-repo';
// @ts-ignore
import { ProfileService } from '@c1rcle/core/profile-service';
// @ts-ignore
import { FirebaseEventRepository } from '@c1rcle/core/event-repo';
// @ts-ignore
import { EventService } from '@c1rcle/core/event-service';
// @ts-ignore
import { FirebaseNotificationRepository } from '@c1rcle/core/notification-repo';
// @ts-ignore
import { NotificationService } from '@c1rcle/core/notification-service';
// @ts-ignore
import { FirebaseOrderRepository } from '@c1rcle/core/order-repo';
// @ts-ignore
import { CheckoutService } from '@c1rcle/core/checkout-service';
// @ts-ignore
import { FirebaseMatchingRepository } from '@c1rcle/core/match-repo';
// @ts-ignore
import { MatchingService } from '@c1rcle/core/matching-service';
// @ts-ignore
import { FirebaseReportRepository } from '@c1rcle/core/report-repo';
// @ts-ignore
import { ModerationService } from '@c1rcle/core/moderation-service';
// @ts-ignore
import { FirebaseWorkspaceRepository } from '@c1rcle/core/workspace-repo';
// @ts-ignore
import { WorkspaceService } from '@c1rcle/core/workspace-service';
// @ts-ignore
import { BillingService } from '@c1rcle/core/billing-service';
import { PublicDiscoveryService } from '../services/public-discovery';
import { buildRequestAuthContext, type RequestAuthContext } from '../lib/auth-context';
import { writeAuditLog as persistAuditLog, type AuditLogInput } from '../lib/audit-log';

export default fp(async (fastify) => {
    if (!getApps().length) {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }

        // Handle both double-escaped (\\n) and single-escaped (\n) literals
        privateKey = privateKey?.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();

        if (privateKey && !privateKey.endsWith('\n')) {
            privateKey += '\n';
        }

        if (!privateKey) {
            fastify.log.error('FIREBASE_PRIVATE_KEY is missing or empty!');
        }

        try {
            initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey,
                }),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
            });
            fastify.log.info('Firebase Admin initialized successfully');
        } catch (err: any) {
            fastify.log.error(`Firebase initialization failed: ${err.message}`);
            throw err;
        }
    }

    const db = getFirestore();
    const auth = getAuth();
    const storage = getStorage();

    const authService = new FirebaseAuthService(auth);
    const profileRepo = new FirebaseProfileRepository(db);
    const profileService = new ProfileService(profileRepo);
    const eventRepo = new FirebaseEventRepository(db);
    const eventService = new EventService(eventRepo);
    const notificationRepo = new FirebaseNotificationRepository(db);
    const notificationService = new NotificationService(notificationRepo);
    const orderRepo = new FirebaseOrderRepository(db);
    const checkoutService = new CheckoutService(orderRepo, eventRepo);
    const matchingRepo = new FirebaseMatchingRepository(db);
    const matchingService = new MatchingService(matchingRepo, profileRepo, eventRepo);
    const reportRepo = new FirebaseReportRepository(db);
    const moderationService = new ModerationService(reportRepo);
    const workspaceRepo = new FirebaseWorkspaceRepository(db);
    const workspaceService = new WorkspaceService(workspaceRepo);
    const billingService = new BillingService(db);
    const publicDiscoveryService = new PublicDiscoveryService(db);

    fastify.decorate('db', db);
    fastify.decorate('auth', auth);
    fastify.decorate('storage', storage);
    fastify.decorate('authService', authService);
    fastify.decorate('profileRepo', profileRepo);
    fastify.decorate('profileService', profileService);
    fastify.decorate('eventRepo', eventRepo);
    fastify.decorate('eventService', eventService);
    fastify.decorate('notificationRepo', notificationRepo);
    fastify.decorate('notificationService', notificationService);
    fastify.decorate('orderRepo', orderRepo);
    fastify.decorate('checkoutService', checkoutService);
    fastify.decorate('matchingService', matchingService);
    fastify.decorate('moderationService', moderationService);
    fastify.decorate('workspaceService', workspaceService);
    fastify.decorate('billingService', billingService);
    fastify.decorate('publicDiscoveryService', publicDiscoveryService);
    fastify.decorate('writeAuditLog', (entry: AuditLogInput) => persistAuditLog(fastify, entry));

    fastify.log.info('Firebase Admin, AuthService, Repositories, and Services initialized');

    // Simple Request-level User & Workspace Decoration
    fastify.decorateRequest('user', null);
    fastify.decorateRequest('authContext', null);
    fastify.decorateRequest('workspaceId', null);
    fastify.decorateRequest('workspace', null); // 🏢 SaaS: Full workspace metadata

    async function loadMemberships(uid: string) {
        const activeQuery = db.collection('partner_memberships')
            .where('uid', '==', uid)
            .where('isActive', '==', true)
            .limit(25);

        const snapshot = await activeQuery.get().catch(async () =>
            db.collection('partner_memberships')
                .where('uid', '==', uid)
                .limit(25)
                .get()
        );

        return snapshot.docs.map((doc) => doc.data());
    }

    // Global Auth Hook (Extract Token)
    fastify.addHook('onRequest', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return;

        const token = authHeader.split(' ')[1];

        // Validate internal system-to-system key before attempting Firebase verification
        const internalKey = process.env.INTERNAL_API_KEY;
        if (internalKey && token === internalKey) {
            // @ts-ignore
            request.user = { uid: 'system', role: 'system', isSystem: true };
            // @ts-ignore
            request.authContext = buildRequestAuthContext({ uid: 'system', role: 'system', isSystem: true }, []);
            return;
        }

        try {
            const user = await authService.verifyToken(token);
            if (user) {
                const memberships = await loadMemberships(user.uid).catch(() => []);
                const authContext = buildRequestAuthContext(user, memberships);
                // @ts-ignore
                request.user = {
                    ...user,
                    activeMembership: authContext.activeMembership || user.activeMembership || null,
                };
                // @ts-ignore
                request.authContext = authContext;
            } else {
                request.log.warn('Auth service could not verify token');
                return reply.status(401).send({ error: 'Unauthorized: Invalid token' });
            }
        } catch (error) {
            request.log.warn('Error in auth service verification');
            return reply.status(401).send({ error: 'Unauthorized: Token verification failed' });
        }
    });

    // Workspace Context Hook — validate x-workspace-id against auth context; never trust blindly
    fastify.addHook('preHandler', async (request, _reply) => {
        const requestedId = request.headers['x-workspace-id'] as string | undefined;
        // @ts-ignore
        const authCtx = request.authContext as any;
        // @ts-ignore
        const isSystem = (request.user as any)?.isSystem === true;

        let workspaceId: string | null = null;

        if (requestedId) {
            // Only honour the header if the authenticated user actually belongs to that workspace
            const allowedPartnerIds: string[] = authCtx?.scopes?.partnerIds || [];
            if (isSystem || allowedPartnerIds.includes(requestedId)) {
                workspaceId = requestedId;
            }
            // If user lacks membership in requestedId — silently ignore (routes will 400 if required)
        } else if (authCtx?.activeMembership?.partnerId) {
            // No header supplied — fall back to the user's active membership
            workspaceId = authCtx.activeMembership.partnerId;
        }

        if (workspaceId) {
            // @ts-ignore
            request.workspaceId = workspaceId;

            // 🛡️ SaaS: Cache workspace metadata in request to avoid re-fetching
            try {
                const ws = await workspaceService.getWorkspace(workspaceId);
                if (ws) {
                    // @ts-ignore
                    request.workspace = ws;

                    // 📊 Usage Tracking: Increment API usage metric
                    await billingService.incrementUsage(workspaceId, 'apiCalls');
                }
            } catch (e) {
                request.log.warn(`Failed to fetch workspace ${workspaceId}`);
            }
        }
    });

    // Auth Guard — rejects unauthenticated requests immediately
    fastify.decorate('requireAuth', async (request: any, reply: any) => {
        if (!request.user) {
            return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
        }
    });

    // Partner Access Guard — auth + ownership/membership check in one preHandler
    // Usage: preHandler: [fastify.requirePartnerAccess((req) => req.params.id)]
    fastify.decorate('requirePartnerAccess', (getPartnerId: (request: any) => string) => {
        return async (request: any, reply: any) => {
            if (!request.user) {
                return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
            }
            try {
                await fastify.verifyPartnerAccess(request, getPartnerId(request));
            } catch {
                return reply.status(403).send({ error: 'Forbidden: Insufficient access to this resource' });
            }
        };
    });

    // Admin Guard — role check + optional IP allowlist + mandatory audit log on every access.
    // Set ADMIN_IP_ALLOWLIST=1.2.3.4,5.6.7.8 in production to restrict to known ops IPs.
    fastify.decorate('requireAdmin', async (request: any, reply: any) => {
        if (!request.user) {
            return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
        }
        if (request.user.role !== 'admin') {
            fastify.log.warn({
                uid: request.user.uid,
                route: `${request.method} ${request.url}`,
                ip: request.ip,
                requestId: request.id,
            }, 'SECURITY: Non-admin attempted admin route access');
            return reply.status(403).send({ error: 'Forbidden: Admin access required' });
        }

        // IP allowlist — enforced only when the env var is explicitly set
        const allowlist = process.env.ADMIN_IP_ALLOWLIST;
        if (allowlist) {
            const allowedIPs = allowlist.split(',').map((ip: string) => ip.trim()).filter(Boolean);
            if (allowedIPs.length > 0 && !allowedIPs.includes(request.ip)) {
                fastify.log.error({
                    uid: request.user.uid,
                    ip: request.ip,
                    allowedIPs,
                    route: `${request.method} ${request.url}`,
                    requestId: request.id,
                }, 'SECURITY: Admin access BLOCKED — IP not in allowlist');
                return reply.status(403).send({ error: 'Forbidden: Access not permitted from this location' });
            }
        }

        // Every admin route access is permanently and visibly logged
        fastify.log.warn({
            uid: request.user.uid,
            email: request.user.email,
            route: `${request.method} ${request.url}`,
            ip: request.ip,
            requestId: request.id,
        }, 'AUDIT: Admin route accessed');
    });

    // Feature Gating Guard
    fastify.decorate('requireFeature', (feature: string) => {
        return async (request: any, reply: any) => {
            if (!request.workspace) throw new Error('Forbidden: Workspace context required');
            if (!request.workspace.features.includes(feature)) {
                return reply.status(403).send({ 
                    error: "Forbidden", 
                    message: `Feature '${feature}' is not enabled for your current workspace plan.` 
                });
            }
        };
    });
    // Verify if user has access to a specific partnerId (Host or Venue)
    fastify.decorate('verifyPartnerAccess', async (request: any, partnerId: string) => {
        if (!request.user) throw new Error('Unauthorized');

        const { uid } = request.user;

        // 🛡️ Reliability: Execute with timeout to prevent cascading failures
        const timeout = <T>(promise: Promise<T>, ms: number) => {
            return Promise.race([
                promise,
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
            ]);
        };

        const [venueSnap, hostSnap, membershipSnapshot, adminDoc] = await timeout(Promise.all([
            db.collection("venues").where('__name__', '==', partnerId).select('ownerId').limit(1).get(),
            db.collection("hosts").where('__name__', '==', partnerId).select('ownerId').limit(1).get(),
            db.collection("partner_memberships")
                .where("partnerId", "==", partnerId)
                .where("uid", "==", uid)
                .select('isActive', 'status', 'role')
                .limit(1)
                .get(),
            db.collection("admins").doc(uid).get()
        ]), 5000); // 5s timeout for auth checks

        const venueDoc = venueSnap.docs[0];
        const hostDoc = hostSnap.docs[0];

        // 1. Direct Ownership Check
        if (venueDoc.exists && venueDoc.data()?.ownerId === uid) return true;
        if (hostDoc.exists && hostDoc.data()?.ownerId === uid) return true;

        // 2. Staff Membership Check
        if (!membershipSnapshot.empty) {
            const membership = membershipSnapshot.docs[0].data();
            const isActive = membership?.isActive === true || membership?.status === 'active';
            const role = (membership?.role || "").toLowerCase();
            const managementRoles = ["manager", "ops", "owner"];

            if (isActive && managementRoles.includes(role)) return true;
        }

        // 3. System Admin Check
        if (adminDoc.exists) return true;

        throw new Error('Forbidden: No access to this partner');
    });
});

// Extend Fastify types
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';

declare module 'fastify' {
    interface FastifyInstance {
        db: Firestore;
        auth: Auth;
        authService: any;
        profileRepo: any;
        profileService: any;
        eventRepo: any;
        eventService: any;
        notificationRepo: any;
        notificationService: any;
        orderRepo: any;
        checkoutService: any;
        matchingRepo: any;
        matchingService: any;
        moderationService: any;
        workspaceService: any;
        billingService: any;
        publicDiscoveryService: any;
        storage: ReturnType<typeof getStorage>;
        invalidatePublicDiscovery: (target?: 'events' | 'hosts' | 'venues' | 'search' | 'all') => Promise<void>;
        verifyPartnerAccess: (request: any, partnerId: string) => Promise<boolean>;
        requireAuth: (request: any, reply: any) => Promise<void>;
        requirePartnerAccess: (getPartnerId: (request: any) => string) => (request: any, reply: any) => Promise<void>;
        requireAdmin: (request: any, reply: any) => Promise<void>;
        requireFeature: (feature: string) => (request: any, reply: any) => Promise<void>;
        writeAuditLog: (entry: AuditLogInput) => Promise<void>;
    }
    interface FastifyRequest {
        user: DecodedIdToken | null;
        authContext: RequestAuthContext | null;
        workspaceId: string | null;
        workspace: any | null;
    }
}
