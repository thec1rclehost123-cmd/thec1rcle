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
// @ts-ignore
import { PublicDiscoveryService } from '@c1rcle/core/public-discovery-service';
// @ts-ignore
import { IdempotencyService } from '@c1rcle/core/idempotency-service';
import { buildRequestAuthContext, type RequestAuthContext } from '../lib/auth-context';
import { writeAuditLog as persistAuditLog, type AuditLogInput } from '../lib/audit-log';
import { parseCookieHeader, verifyGuestCsrfRequest } from '../lib/guest-csrf';
import { PromoterServiceV2 } from '../services/promoter-v2';

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
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET ||
          `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
      });
      fastify.log.info('Firebase Admin initialized successfully');
    } catch (err: any) {
      fastify.log.error(`Firebase initialization failed: ${err.message}`);
      throw err;
    }
  }

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
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
  const idempotencyService = new IdempotencyService(db);
  const promoterServiceV2 = new PromoterServiceV2(db);

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
  fastify.decorate('idempotencyService', idempotencyService);
  fastify.decorate('promoterServiceV2', promoterServiceV2);
  fastify.decorate('writeAuditLog', (entry: AuditLogInput) => persistAuditLog(fastify, entry));

  fastify.decorate('invalidatePublicDiscovery', async (target: any = 'all') => {
    // @ts-ignore
    await fastify.sendInngestEvent('discovery/sync', {
      type: target === 'all' ? 'all' : target,
      id: 'system',
    });
  });

  fastify.decorate('enrichAuthContext', async (request: any) => {
    if (request?.user) {
      await ensureMembershipsForRequest(request);
    }
  });

  fastify.log.info('Firebase Admin, AuthService, Repositories, and Services initialized');

  // Simple Request-level User & Workspace Decoration
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('authContext', null);
  fastify.decorateRequest('authVerification', null);
  fastify.decorateRequest('workspaceId', null);
  fastify.decorateRequest('workspace', null); // 🏢 SaaS: Full workspace metadata

  function logSlowRequestStep(
    request: any,
    label: string,
    startedAt: number,
    details: Record<string, any> = {},
  ) {
    const durationMs = Number((Date.now() - startedAt).toFixed(2));
    if (durationMs < 150 || !request?.log) return;
    request.log.info({ durationMs, ...details }, label);
  }

  async function loadMemberships(uid: string) {
    const startedAt = Date.now();
    const activeQuery = db
      .collection('partner_memberships')
      .where('uid', '==', uid)
      .where('isActive', '==', true)
      .limit(25);

    const snapshot = await activeQuery
      .get()
      .catch(async () =>
        db.collection('partner_memberships').where('uid', '==', uid).limit(25).get(),
      );

    // Backward compat: if isActive query returns nothing, fall back to status-based
    // query for older docs that were created before the isActive field was added.
    let finalSnapshot = snapshot;
    if (snapshot.empty) {
      const legacySnapshot = await db
        .collection('partner_memberships')
        .where('uid', '==', uid)
        .where('status', '==', 'active')
        .limit(25)
        .get()
        .catch(() => null);
      if (legacySnapshot && !legacySnapshot.empty) {
        finalSnapshot = legacySnapshot;
      }
    }

    const memberships = finalSnapshot.docs.map((doc) => doc.data());
    const durationMs = Number((Date.now() - startedAt).toFixed(2));
    if (durationMs >= 150) {
      fastify.log.info(
        { uid, durationMs, count: memberships.length },
        'Partner memberships loaded',
      );
    }
    return memberships;
  }

  function applyRequestAuth(
    request: any,
    user: Record<string, any>,
    memberships: Array<Record<string, any>> = [],
  ) {
    const authContext = buildRequestAuthContext(user, memberships);
    request.user = {
      ...user,
      activeMembership: authContext.activeMembership || user.activeMembership || null,
    };
    request.authContext = authContext;
    return authContext;
  }

  async function ensureMembershipsForRequest(request: any) {
    if (!request?.user || request.user.isSystem === true) {
      return request?.authContext?.memberships || [];
    }

    if (
      Array.isArray(request.authContext?.memberships) &&
      request.authContext.memberships.length > 0
    ) {
      return request.authContext.memberships;
    }

    const startedAt = Date.now();
    const memberships = await loadMemberships(request.user.uid).catch((error) => {
      request.log.warn(
        { uid: request.user?.uid, error: error?.message || String(error) },
        'Unable to enrich auth context memberships',
      );
      return [];
    });
    applyRequestAuth(request, request.user, memberships);
    logSlowRequestStep(request, 'Auth membership enrichment completed', startedAt, {
      uid: request.user.uid,
      count: memberships.length,
    });
    return memberships;
  }

  // Global Auth Hook (Extract Token)
  fastify.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const cookies = parseCookieHeader(request.headers.cookie);
    const sessionCookie = cookies.__session;
    const tokenSource = authHeader?.startsWith('Bearer ')
      ? 'bearer'
      : sessionCookie
        ? 'session_cookie'
        : null;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : sessionCookie;

    if (!token) return;

    // Validate internal system-to-system key before attempting Firebase verification
    const internalKey = process.env.INTERNAL_API_KEY;
    if (internalKey && token === internalKey) {
      // Enforce IP allowlist check for internal system keys if configured
      const internalAllowlist = process.env.INTERNAL_IP_ALLOWLIST;
      if (internalAllowlist) {
        const allowedIPs = internalAllowlist
          .split(',')
          .map((ip: string) => ip.trim())
          .filter(Boolean);
        if (allowedIPs.length > 0 && !allowedIPs.includes(request.ip)) {
          request.log.error(
            { ip: request.ip, allowedIPs, requestId: request.id },
            'SECURITY: System bypass blocked — Request IP not in INTERNAL_IP_ALLOWLIST',
          );
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Internal API access not permitted from this location',
          });
        }
      }

      // @ts-ignore
      request.user = { uid: 'system', role: 'system', isSystem: true };
      // @ts-ignore
      request.authContext = buildRequestAuthContext(
        { uid: 'system', role: 'system', isSystem: true },
        [],
      );
      // @ts-ignore
      request.authVerification = {
        status: 'valid',
        source: 'internal_key',
        tokenSource: 'internal_key',
      };
      return;
    }

    const startedAt = Date.now();
    try {
      const verification =
        typeof authService.verifyTokenDetailed === 'function'
          ? await authService.verifyTokenDetailed(
              token,
              tokenSource === 'session_cookie' ? 'session_cookie' : 'id_token',
            )
          : {
              status: 'valid',
              user: await authService.verifyToken(token),
              source: tokenSource === 'session_cookie' ? 'session_cookie' : 'id_token',
              errorCode: null,
              errorMessage: null,
            };

      // @ts-ignore
      request.authVerification = {
        ...verification,
        tokenSource,
        providedToken: true,
        durationMs: Number((Date.now() - startedAt).toFixed(2)),
      };

      if (verification.user) {
        applyRequestAuth(request, verification.user, []);
        logSlowRequestStep(request, 'Auth token verification completed', startedAt, {
          uid: verification.user.uid,
          source: verification.source,
          tokenSource,
        });
      } else if (verification.status === 'error') {
        request.log.warn(
          {
            status: verification.status,
            tokenSource,
            source: verification.source,
            errorCode: verification.errorCode,
            errorMessage: verification.errorMessage,
          },
          'Auth verification temporarily unavailable',
        );
      } else {
        request.log.warn(
          {
            status: verification.status,
            tokenSource,
            source: verification.source,
            errorCode: verification.errorCode,
          },
          'Auth service could not verify token',
        );
        return reply.status(401).send({ error: 'Unauthorized: Invalid token' });
      }
    } catch (error: any) {
      // @ts-ignore
      request.authVerification = {
        status: 'error',
        source: null,
        tokenSource,
        providedToken: true,
        durationMs: Number((Date.now() - startedAt).toFixed(2)),
        errorCode: error?.code || null,
        errorMessage: error?.message || null,
      };
      request.log.warn(
        { tokenSource, error: error?.message || String(error) },
        'Error in auth service verification',
      );
      return reply.status(401).send({ error: 'Unauthorized: Token verification failed' });
    }

    if ((request as any).user) {
      const csrf = verifyGuestCsrfRequest(request);
      if (!csrf.ok) {
        return reply.status(403).send(csrf.response);
      }
    }
  });

  // Workspace Context Hook — validate x-workspace-id against auth context; never trust blindly
  fastify.addHook('preHandler', async (request, _reply) => {
    // @ts-ignore
    const user = request.user as any;
    // @ts-ignore
    let authCtx = request.authContext as any;
    // @ts-ignore
    const isSystem = user?.isSystem === true;

    // Auto-enrich auth context so workspaceId can fall back to activeMembership.partnerId
    if (user && !authCtx) {
      await fastify.enrichAuthContext(request);
      // @ts-ignore
      authCtx = request.authContext as any;
    }

    const requestedId = request.headers['x-workspace-id'] as string | undefined;

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

      if ((request as any).user) {
        await ensureMembershipsForRequest(request);
      }

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
      fastify.log.warn(
        {
          uid: request.user.uid,
          route: `${request.method} ${request.url}`,
          ip: request.ip,
          requestId: request.id,
        },
        'SECURITY: Non-admin attempted admin route access',
      );
      return reply.status(403).send({ error: 'Forbidden: Admin access required' });
    }

    // IP allowlist — enforced only when the env var is explicitly set
    const allowlist = process.env.ADMIN_IP_ALLOWLIST;
    if (allowlist) {
      const allowedIPs = allowlist
        .split(',')
        .map((ip: string) => ip.trim())
        .filter(Boolean);
      if (allowedIPs.length > 0 && !allowedIPs.includes(request.ip)) {
        fastify.log.error(
          {
            uid: request.user.uid,
            ip: request.ip,
            allowedIPs,
            route: `${request.method} ${request.url}`,
            requestId: request.id,
          },
          'SECURITY: Admin access BLOCKED — IP not in allowlist',
        );
        return reply
          .status(403)
          .send({ error: 'Forbidden: Access not permitted from this location' });
      }
    }

    // Every admin route access is permanently and visibly logged
    fastify.log.warn(
      {
        uid: request.user.uid,
        email: request.user.email,
        route: `${request.method} ${request.url}`,
        ip: request.ip,
        requestId: request.id,
      },
      'AUDIT: Admin route accessed',
    );
  });

  // Feature Gating Guard
  fastify.decorate('requireFeature', (feature: string) => {
    return async (request: any, reply: any) => {
      if (!request.workspace) throw new Error('Forbidden: Workspace context required');
      if (!request.workspace.features.includes(feature)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Feature '${feature}' is not enabled for your current workspace plan.`,
        });
      }
    };
  });
  // Verify if user has access to a specific partnerId (Host or Venue)
  fastify.decorate('verifyPartnerAccess', async (request: any, partnerId: string) => {
    if (!request.user) throw new Error('Unauthorized');

    if (request.user?.isSystem === true || request.user?.role === 'admin') return true;

    await ensureMembershipsForRequest(request);

    const { uid } = request.user;
    request.log.info({ partnerId, uid }, 'verifyPartnerAccess lookup started');

    const membershipMatch = request.authContext?.memberships?.find((membership: any) => {
      if (membership.partnerId !== partnerId) return false;
      if (!membership.isActive) return false;
      return [
        'manager',
        'ops',
        'owner',
        'promoter',
        'cohost',
        'staff',
        'finance_admin',
        'security',
        'door',
      ].includes(String(membership.role || '').toLowerCase());
    });
    if (membershipMatch) {
      request.log.info({ partnerId, uid }, 'verifyPartnerAccess matches via cached memberships');
      return true;
    }

    // 🛡️ Reliability: Execute with timeout to prevent cascading failures
    const timeout = <T>(promise: Promise<T>, ms: number) => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
      ]);
    };

    const [venueSnap, hostSnap, membershipSnapshot, adminDoc] = await timeout(
      Promise.all([
        db
          .collection('venues')
          .where('__name__', '==', partnerId)
          .select('ownerId', 'ownerUid')
          .limit(1)
          .get(),
        db
          .collection('hosts')
          .where('__name__', '==', partnerId)
          .select('ownerUid', 'userId', 'identityUid', 'ownerId')
          .limit(1)
          .get(),
        db
          .collection('partner_memberships')
          .where('partnerId', '==', partnerId)
          .where('uid', '==', uid)
          .select('isActive', 'status', 'role')
          .limit(1)
          .get(),
        db.collection('admins').doc(uid).get(),
      ]),
      5000,
    ); // 5s timeout for auth checks

    const venueDoc = venueSnap.docs[0];
    const hostDoc = hostSnap.docs[0];

    request.log.info(
      {
        venueDocExists: venueDoc?.exists,
        venueData: venueDoc?.data(),
        hostDocExists: hostDoc?.exists,
        hostData: hostDoc?.data(),
        membershipEmpty: membershipSnapshot.empty,
        adminDocExists: adminDoc.exists,
        uid,
        partnerId,
      },
      'verifyPartnerAccess queries completed',
    );

    // 1. Direct Ownership Check
    if (venueDoc?.exists) {
      const data = venueDoc.data();
      if (data?.ownerId === uid || data?.ownerUid === uid) {
        request.log.info({ partnerId, uid }, 'verifyPartnerAccess matches via venue ownership');
        return true;
      }
    }
    if (hostDoc?.exists) {
      const data = hostDoc.data();
      if (
        data?.ownerUid === uid ||
        data?.userId === uid ||
        data?.identityUid === uid ||
        data?.ownerId === uid
      ) {
        request.log.info({ partnerId, uid }, 'verifyPartnerAccess matches via host ownership');
        return true;
      }
    }

    // 2. Staff Membership Check
    if (!membershipSnapshot.empty) {
      const membership = membershipSnapshot.docs[0].data();
      const isActive = membership?.isActive === true || membership?.status === 'active';
      const role = (membership?.role || '').toLowerCase();
      const managementRoles = [
        'manager',
        'ops',
        'owner',
        'promoter',
        'cohost',
        'staff',
        'finance_admin',
        'security',
        'door',
      ];

      if (isActive && managementRoles.includes(role)) {
        request.log.info({ partnerId, uid }, 'verifyPartnerAccess matches via staff membership');
        return true;
      }
    }

    // 3. System Admin Check
    if (adminDoc.exists) {
      request.log.info({ partnerId, uid }, 'verifyPartnerAccess matches via admin status');
      return true;
    }

    request.log.warn({ partnerId, uid }, 'verifyPartnerAccess rejected: No access');
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
    idempotencyService: any;
    promoterServiceV2: any;
    storage: ReturnType<typeof getStorage>;
    invalidatePublicDiscovery: (
      target?: 'events' | 'hosts' | 'venues' | 'search' | 'all',
    ) => Promise<void>;
    enrichAuthContext: (request: any) => Promise<void>;
    verifyPartnerAccess: (request: any, partnerId: string) => Promise<boolean>;
    requireAuth: (request: any, reply: any) => Promise<void>;
    requirePartnerAccess: (
      getPartnerId: (request: any) => string,
    ) => (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
    requireFeature: (feature: string) => (request: any, reply: any) => Promise<void>;
    writeAuditLog: (entry: AuditLogInput) => Promise<void>;
  }
  interface FastifyRequest {
    user: DecodedIdToken | null;
    authContext: RequestAuthContext | null;
    authVerification: Record<string, any> | null;
    workspaceId: string | null;
    workspace: any | null;
  }
}
