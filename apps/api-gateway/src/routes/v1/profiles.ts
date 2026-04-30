import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import { buildGuestProfileCreatePayload, buildGuestProfileUpdates, normalizeGuestProfile } from '../../lib/guest-auth';

const ProfileIdParam = z.object({ id: z.string() }).strict();
const ProfileTypeQuery = z.object({ type: z.string().optional() }).strict();
const ProfilePostsQuery = z.object({ type: z.string().optional(), limit: z.string().optional() }).strict();

const PersonalUpdateSchema = z.object({
    displayName: z.string().max(100).optional(),
    age: z.number().min(1).max(150).optional(),
    gender: z.string().max(20).optional(),
    city: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    phoneNumber: z.string().max(20).optional(),
    onboardingComplete: z.boolean().optional(),
}).strict();

const SocialUpdateSchema = z.object({
    instagram: z.string().max(100).optional(),
    handle: z.string().max(30).optional(),
    username: z.string().max(30).optional(),
}).strict();

const BioUpdateSchema = z.object({
    bio: z.string().max(500).optional(),
}).strict();

const AvatarUpdateSchema = z.object({
    photoURL: z.string().optional(),
    avatar: z.string().optional(),
}).strict();

const UnifiedProfileUpdateSchema = z.object({}).passthrough();

const UserProfileCreateBody = z.object({
    uid: z.string(),
    email: z.string().email(),
    displayName: z.string().max(100).optional(),
    age: z.number().min(1).max(150).optional(),
    gender: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    photoURL: z.string().optional(),
    avatar: z.string().optional(),
    city: z.string().max(100).optional(),
    instagram: z.string().max(100).optional(),
    onboardingComplete: z.boolean().optional(),
    bio: z.string().max(500).optional(),
}).strict();

export default async function profileRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/profiles/:id
     */
    fastify.get('/profiles/:id', {
        preHandler: [fastify.validate({ params: ProfileIdParam, querystring: ProfileTypeQuery })]
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { type = 'user' } = request.query;

        try {
            const viewerId = request.user?.uid;
            const data = await fastify.profileService.getPublicProfile(id, type as any, viewerId, fastify.matchingService);
            if (!data) return reply.status(404).send({ error: "Profile not found" });
            return { id, ...data };
        } catch (error: any) {
            fastify.log.error(`Error in GET /profiles/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * Intent-Specific Mutation Helpers
     */
    const handleUpdate = async (request: any, reply: any, schema: z.ZodObject<any>, updates: any) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        const parsed = schema.safeParse(updates);
        if (!parsed.success) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'Invalid fields', details: parsed.error.format(), requestId: request.id }));

        const existingDoc = await fastify.db.collection('users').doc(userId).get();
        const result = buildGuestProfileUpdates(parsed.data, existingDoc.exists ? existingDoc.data() || {} : {});

        if (result.error) return reply.status(result.statusCode || 400).send(buildErrorResponse({ code: 'UPDATE_FAILED', message: result.error, requestId: request.id }));

        await fastify.profileService.updateProfile(userId, 'user', result.safeUpdates);
        return { success: true };
    };

    fastify.patch('/profiles/personal', async (request, reply) => handleUpdate(request, reply, PersonalUpdateSchema, request.body));
    fastify.patch('/profiles/social', async (request, reply) => handleUpdate(request, reply, SocialUpdateSchema, request.body));
    fastify.patch('/profiles/bio', async (request, reply) => handleUpdate(request, reply, BioUpdateSchema, request.body));
    fastify.patch('/profiles/avatar', async (request, reply) => handleUpdate(request, reply, AvatarUpdateSchema, request.body));

    fastify.patch('/profiles', {
        preHandler: [
            async (request) => { if ((fastify as any).requireAuth) await (fastify as any).requireAuth(request); },
            fastify.validate({ body: UnifiedProfileUpdateSchema })
        ]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const { type = 'user', updates, id: targetId } = request.body || {};
        const actualId = type === 'user' ? userId : targetId;

        if (!actualId) {
            return reply.status(400).send(buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'ID required for this update type',
                requestId: request.id,
            }));
        }

        try {
            if (type !== 'user') {
                await (fastify as any).verifyPartnerAccess(request, actualId);
            }

            let safeUpdates: Record<string, any>;
            if (type === 'user') {
                const existingDoc = await fastify.db.collection('users').doc(actualId).get();
                const rawUpdates = updates || request.body || {};
                const result = buildGuestProfileUpdates(rawUpdates, existingDoc.exists ? existingDoc.data() || {} : {});

                if (result.error) {
                    const code = result.statusCode === 429 ? 'PROFILE_UPDATE_COOLDOWN' : 'UPDATE_FAILED';
                    return reply.status(result.statusCode || 400).send(buildErrorResponse({ code, message: result.error, requestId: request.id }));
                }
                safeUpdates = result.safeUpdates;
            } else {
                // Partner/Venue updates bypass guest-specific logic but should still be filtered
                safeUpdates = updates || {};
            }

            await fastify.profileService.updateProfile(actualId, type as any, safeUpdates);
            
            if (type === 'user') {
                const updatedDoc = await fastify.db.collection('users').doc(actualId).get();
                return buildSuccessResponse({
                    profile: normalizeGuestProfile(updatedDoc.exists ? updatedDoc.data() || {} : {}, request.user || {}),
                });
            }

            return { success: true };
        } catch (error: any) {
            fastify.log.error(`Error in PATCH /profiles: ${error.message}`);
            return reply.status(error.statusCode || 500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: error.message || 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });


    fastify.get('/profiles/:id/posts', async (request: any, reply) => {
        const { id } = request.params;
        const { type = 'venue', limit = 20 } = request.query;
        return await fastify.profileService.getPosts(id, type as string, Number(limit));
    });

    fastify.post('/users/profile', {
        preHandler: [fastify.validate({ body: UserProfileCreateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        const body = request.body as any;
        if (body.uid && body.uid !== userId) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Forbidden', requestId: request.id }));

        const now = new Date().toISOString();
        const profileDoc = buildGuestProfileCreatePayload(body, request.user, now);
        await fastify.profileService.createProfile(profileDoc);
        return { success: true, uid: profileDoc.uid, profile: normalizeGuestProfile(profileDoc, request.user) };
    });
}
