declare const _default: (fastify: import("fastify/fastify").FastifyInstance<import("fastify/fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify/fastify").FastifyBaseLogger, import("fastify/fastify").FastifyTypeProviderDefault>) => Promise<void>;
export default _default;
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
//# sourceMappingURL=firebase.d.ts.map