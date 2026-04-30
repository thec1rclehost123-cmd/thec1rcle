import { FastifyInstance } from 'fastify';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
import { buildGuestAuthBootstrap } from '../../lib/guest-auth';
import { sendGuestOtp, verifyGuestOtp } from '../../lib/guest-otp';
import { getPermissionsForRole, getDefaultTabVisibility, PROMOTER_COMMISSION_TIERS } from '../../lib/rbac-permissions';

const AuthCheckSchema = z.object({
    email: z.string().email(),
}).strict();

const OtpSendSchema = z.object({
    type: z.enum(['email', 'phone']),
    recipient: z.string().min(3),
});

const OtpVerifySchema = z.object({
    type: z.enum(['email', 'phone']),
    recipient: z.string().min(3),
    code: z.string().min(4).max(10),
});

const OnboardSchema = z.object({
    type: z.string(),
    email: z.string().email(),
    name: z.string(),
    company: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
    instagram: z.string().optional(),
    contactPerson: z.string().optional(),
    city: z.string().optional(),
    area: z.string().optional(),
    capacity: z.string().optional(),
    plan: z.string().optional(),
    role: z.string().optional(),
    association: z.string().optional(),
    associatedHostId: z.string().optional(),
    bio: z.string().optional()
});

const CreateAccountSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().optional(),
});

const HostVerificationSchema = z.object({
    documentType: z.string().optional(),
    documentId: z.string().optional(),
    companyName: z.string().optional(),
    taxId: z.string().optional(),
    country: z.string().optional()
}).catchall(z.any()); // Allowed catchall just for host-verification because frontend fields vary, but will use .strict() in standard entities.

async function getGuestOnboardingRequest(fastify: FastifyInstance, userId: string) {
    const reqSnapshot = await fastify.db.collection('onboarding_requests')
        .where('uid', '==', userId)
        .limit(1)
        .get();

    if (reqSnapshot.empty) return null;

    const doc = reqSnapshot.docs[0];
    const raw = doc.data();
    return {
        id: doc.id,
        status: raw.status,
        type: raw.type,
        submittedAt: raw.submittedAt ?? raw.createdAt ?? null,
        reviewedAt: raw.reviewedAt ?? null,
        rejectionReason: raw.rejectionReason ?? null,
    };
}

async function getUnreadNotificationCount(fastify: FastifyInstance, userId: string) {
    try {
        const snapshot = await fastify.db.collection('notifications')
            .where('userId', '==', userId)
            .where('isRead', '==', false)
            .count()
            .get();
        return snapshot.data().count || 0;
    } catch (error) {
        fastify.log.warn({ userId, error }, 'Unable to load guest unread notification count');
        return 0;
    }
}

export default async function authRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/auth/me
     * Canonical guest auth/profile/shell bootstrap.
     */
    fastify.get('/me', async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        try {
            const [userDoc, onboardingRequest, unreadNotificationCount] = await Promise.all([
                fastify.db.collection('users').doc(userId).get(),
                getGuestOnboardingRequest(fastify, userId),
                getUnreadNotificationCount(fastify, userId),
            ]);

            return buildGuestAuthBootstrap({
                user: request.user,
                rawProfile: userDoc.exists ? { uid: userDoc.id, ...userDoc.data() } : null,
                onboardingRequest,
                unreadNotificationCount,
                activeMembership: (request.user as any)?.activeMembership || null,
            });
        } catch (error: any) {
            fastify.log.error(`Error in GET /auth/me: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * POST /api/v1/auth/check
     * Login-step identity existence check. Returns only an exists boolean.
     */
    fastify.post('/check', {
        preHandler: [fastify.validate({ body: AuthCheckSchema })],
    }, async (request: any, reply) => {
        const { email } = request.body;

        try {
            await fastify.auth.getUserByEmail(email);
            return { exists: true };
        } catch (error: any) {
            if (error?.code === 'auth/user-not-found') return { exists: false };
            fastify.log.error(`Error in POST /auth/check: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'AUTH_CHECK_FAILED',
                message: 'Check protocol failed',
                requestId: request.id,
            }));
        }
    });

    /**
     * POST /api/v1/auth/create-account
     * Create a new Firebase user and return a custom token for client-side login.
     */
    fastify.post('/create-account', {
        preHandler: [fastify.validate({ body: CreateAccountSchema })],
    }, async (request: any, reply) => {
        const { email, password, phone } = request.body;

        try {
            // 1. Create the user in Firebase Auth
            const userRecord = await fastify.auth.createUser({
                email,
                password,
                ...(phone && { phoneNumber: phone.startsWith('+') ? phone : `+${phone}` }),
            });

            // 2. Generate a custom token so the client can sign in immediately
            const customToken = await fastify.auth.createCustomToken(userRecord.uid);

            return {
                success: true,
                uid: userRecord.uid,
                customToken
            };
        } catch (error: any) {
            if (error.code === 'auth/email-already-exists') {
                return reply.status(409).send(buildErrorResponse({
                    code: 'EMAIL_ALREADY_EXISTS',
                    message: 'This email is already registered.',
                    requestId: request.id,
                }));
            }

            fastify.log.error(`Error in POST /auth/create-account: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'CREATE_ACCOUNT_FAILED',
                message: error.message || 'Failed to create account.',
                requestId: request.id,
            }));
        }
    });

    /**
     * POST /api/v1/auth/otp/send
     */
    fastify.post('/otp/send', {
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
        preHandler: [fastify.validate({ body: OtpSendSchema })],
    }, async (request: any, reply) => {
        const { type, recipient } = request.body;

        try {
            return await sendGuestOtp(fastify.db, type, recipient);
        } catch (error: any) {
            fastify.log.warn({ requestId: request.id, type, error: error.message }, 'OTP send failed');
            return reply.status(400).send(buildErrorResponse({
                code: 'OTP_SEND_FAILED',
                message: error.message || 'An unexpected error occurred during OTP dispatch.',
                requestId: request.id,
            }));
        }
    });

    /**
     * POST /api/v1/auth/otp/verify
     */
    fastify.post('/otp/verify', {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        preHandler: [fastify.validate({ body: OtpVerifySchema })],
    }, async (request: any, reply) => {
        const { type, recipient, code } = request.body;

        try {
            return await verifyGuestOtp(fastify.db, type, recipient, code);
        } catch (error: any) {
            fastify.log.warn({ requestId: request.id, recipient, error: error.message }, 'OTP verification failed');
            return reply.status(400).send(buildErrorResponse({
                code: 'OTP_VERIFY_FAILED',
                message: error.message || 'Protocol mismatch.',
                requestId: request.id,
            }));
        }
    });

    /**
     * POST /api/v1/auth/onboard
     * Submit an onboarding application
     */
    fastify.post('/onboard', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: OnboardSchema })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;

        const body = request.body;
        const { type, email, name, ...rest } = body;

        if (!type || !email || !name) {
            return reply.status(400).send(buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'Missing required fields',
                requestId: request.id,
            }));
        }

        try {
            // Check if user doc exists, create if not
            const userRef = fastify.db.collection('users').doc(userId);
            await userRef.set({
                uid: userId,
                email,
                displayName: name,
                role: 'onboarding',
                isApproved: false,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            // Create onboarding request
            const requestId = `req_${Date.now()}_${userId.substring(0, 5)}`;
            await fastify.db.collection('onboarding_requests').doc(requestId).set({
                id: requestId,
                uid: userId,
                type,
                status: "pending",
                data: {
                    ...body,
                },
                submittedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            return { success: true, requestId };
        } catch (error: any) {
            fastify.log.error(`Error in POST /auth/onboard: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * GET /api/v1/auth/onboard-status
     */
    fastify.get('/onboard-status', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { requestId } = request.query as any;
        if (!requestId) {
            return reply.status(400).send(buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'requestId is required',
                requestId: request.id,
            }));
        }

        try {
            const doc = await fastify.db.collection('onboarding_requests').doc(requestId).get();
            if (!doc.exists) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Onboarding request not found',
                    requestId: request.id,
                }));
            }

            return doc.data();
        } catch (error: any) {
            fastify.log.error(`Error in GET /auth/onboard-status: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * POST /api/v1/auth/host-verification
     */
    fastify.post('/host-verification', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: HostVerificationSchema })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const email = request.user?.email;

        const body = request.body;

        try {
            const applicationRef = fastify.db.collection("host_applications").doc();
            await applicationRef.set({
                uid: userId,
                email: email || '',
                ...body,
                status: "pending",
                createdAt: new Date().toISOString(),
            });

            // Note: we might also update the profile hostStatus
            await fastify.profileService.updateProfile(userId, 'user', { hostStatus: 'pending' });

            return { success: true, applicationId: applicationRef.id };
        } catch (error: any) {
            fastify.log.error(`Error in POST /auth/host-verification: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * GET /api/v1/auth/partner-context
     * Returns the authenticated user's partner permissions and tab visibility
     * computed server-side from their active membership role.
     * Frontend must use these values — never compute permissions locally.
     */
    fastify.get('/partner-context', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const membership = request.authContext?.activeMembership || request.user?.activeMembership;
        if (!membership) {
            return reply.status(404).send({ error: 'No active partnership found' });
        }
        const { partnerType, role } = membership;
        const permissions = getPermissionsForRole(partnerType, role);
        const tabVisibility = getDefaultTabVisibility(partnerType, role);

        return {
            partnerType,
            role,
            permissions,
            tabVisibility,
            ...(partnerType === 'promoter'
                ? { commissionTiers: PROMOTER_COMMISSION_TIERS }
                : {}),
        };
    });
}
