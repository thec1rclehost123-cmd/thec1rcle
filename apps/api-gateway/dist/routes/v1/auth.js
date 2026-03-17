import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
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
const HostVerificationSchema = z.object({
    documentType: z.string().optional(),
    documentId: z.string().optional(),
    companyName: z.string().optional(),
    taxId: z.string().optional(),
    country: z.string().optional()
}).catchall(z.any()); // Allowed catchall just for host-verification because frontend fields vary, but will use .strict() in standard entities.
export default async function authRoutes(fastify) {
    /**
     * GET /api/v1/auth/me
     * Fetch the current authenticated user's profile and onboarding request
     */
    fastify.get('/me', async (request, reply) => {
        const userId = request.user?.uid;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        try {
            const userDoc = await fastify.db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            // Find any onboarding requests
            const reqSnapshot = await fastify.db.collection('onboarding_requests')
                .where('uid', '==', userId)
                .limit(1)
                .get();
            const onboardingRequest = reqSnapshot.empty ? null : reqSnapshot.docs[0].data();
            return {
                user: userData,
                onboardingRequest
            };
        }
        catch (error) {
            fastify.log.error(`Error in GET /auth/me: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * POST /api/v1/auth/onboard
     * Submit an onboarding application
     */
    fastify.post('/onboard', {
        preHandler: [fastify.validate({ body: OnboardSchema })]
    }, async (request, reply) => {
        const userId = request.user?.uid;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const body = request.body;
        const { type, email, name, ...rest } = body;
        if (!type || !email || !name) {
            return reply.status(400).send({ error: "Missing required fields" });
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
        }
        catch (error) {
            fastify.log.error(`Error in POST /auth/onboard: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * POST /api/v1/auth/host-verification
     */
    fastify.post('/host-verification', {
        preHandler: [fastify.validate({ body: z.record(z.string(), z.any()) })]
    }, async (request, reply) => {
        const userId = request.user?.uid;
        const email = request.user?.email;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
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
        }
        catch (error) {
            fastify.log.error(`Error in POST /auth/host-verification: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
//# sourceMappingURL=auth.js.map