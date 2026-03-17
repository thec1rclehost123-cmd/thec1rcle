/// <reference types="node" />
declare const _default: (fastify: import("fastify").FastifyInstance<import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault>) => Promise<void>;
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
        workspaceService: any;
        billingService: any;
        verifyPartnerAccess: (request: any, partnerId: string) => Promise<boolean>;
        requireFeature: (feature: string) => (request: any, reply: any) => Promise<void>;
    }
    interface FastifyRequest {
        user: DecodedIdToken | null;
        workspaceId: string | null;
        workspace: any | null;
    }
}
//# sourceMappingURL=firebase.d.ts.map