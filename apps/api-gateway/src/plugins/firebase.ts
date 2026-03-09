import fp from 'fastify-plugin';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
// Environment variables are loaded via the --env-file flag or Expo runtime

export default fp(async (fastify) => {
    if (!getApps().length) {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }

        privateKey = privateKey?.replace(/\\n/g, '\n');

        if (!privateKey) {
            console.error('FIREBASE_PRIVATE_KEY is missing or empty!');
        }

        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
    }

    const db = getFirestore();
    const auth = getAuth();

    // @ts-ignore
    const { FirebaseAuthService } = await import('@c1rcle/core/auth-infra');
    // @ts-ignore
    const { FirebaseProfileRepository } = await import('@c1rcle/core/profile-repo');
    // @ts-ignore
    const { ProfileService } = await import('@c1rcle/core/profile-service');
    // @ts-ignore
    const { FirebaseEventRepository } = await import('@c1rcle/core/event-repo');
    // @ts-ignore
    const { EventService } = await import('@c1rcle/core/event-service');
    // @ts-ignore
    const { FirebaseNotificationRepository } = await import('@c1rcle/core/notification-repo');
    // @ts-ignore
    const { NotificationService } = await import('@c1rcle/core/notification-service');
    // @ts-ignore
    const { FirebaseOrderRepository } = await import('@c1rcle/core/order-repo');
    // @ts-ignore
    const { CheckoutService } = await import('@c1rcle/core/checkout-service');
    // @ts-ignore
    const { FirebaseMatchingRepository } = await import('@c1rcle/core/match-repo');
    // @ts-ignore
    const { MatchingService } = await import('@c1rcle/core/matching-service');
    // @ts-ignore
    const { FirebaseReportRepository } = await import('@c1rcle/core/report-repo');
    // @ts-ignore
    const { ModerationService } = await import('@c1rcle/core/moderation-service');

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

    fastify.decorate('db', db);
    fastify.decorate('auth', auth);
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

    fastify.log.info('Firebase Admin, AuthService, Repositories, and Services initialized');

    // Simple Request-level User Decoration
    fastify.decorateRequest('user', null);

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
            return;
        }

        try {
            const user = await authService.verifyToken(token);
            if (user) {
                // @ts-ignore
                request.user = user;
            } else {
                request.log.warn('Auth service could not verify token');
            }
        } catch (error) {
            request.log.warn('Error in auth service verification');
        }
    });
    // Verify if user has access to a specific partnerId (Host or Venue)
    fastify.decorate('verifyPartnerAccess', async (request: any, partnerId: string) => {
        if (!request.user) throw new Error('Unauthorized');

        const { uid } = request.user;

        // 1. Direct Ownership Check
        const venueDoc = await db.collection("venues").doc(partnerId).get();
        if (venueDoc.exists && venueDoc.data()?.ownerId === uid) return true;

        const hostDoc = await db.collection("hosts").doc(partnerId).get();
        if (hostDoc.exists && hostDoc.data()?.ownerId === uid) return true;

        // 2. Staff Membership Check
        const membershipSnapshot = await db.collection("partner_memberships")
            .where("partnerId", "==", partnerId)
            .where("uid", "==", uid)
            .limit(1)
            .get();

        if (!membershipSnapshot.empty) {
            const membership = membershipSnapshot.docs[0].data();
            const isActive = membership?.isActive === true || membership?.status === 'active';
            const role = (membership?.role || "").toLowerCase();
            const managementRoles = ["manager", "ops", "owner"];

            if (isActive && managementRoles.includes(role)) return true;
        }

        // 3. System Admin Check
        const adminDoc = await db.collection("admins").doc(uid).get();
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
        verifyPartnerAccess: (request: any, partnerId: string) => Promise<boolean>;
    }
    interface FastifyRequest {
        user: DecodedIdToken | null;
    }
}
