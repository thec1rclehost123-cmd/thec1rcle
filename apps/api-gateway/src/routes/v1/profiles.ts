import { FastifyInstance } from 'fastify';
import { filterSafeProfileUpdates } from '@c1rcle/core/profile-engine';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
import { buildGuestProfileCreatePayload, buildGuestProfileUpdates, normalizeGuestProfile } from '../../lib/guest-auth';

const ProfileIdParam = z.object({ id: z.string() }).strict();
const ProfileTypeQuery = z.object({ type: z.string().optional() }).strict();
const ProfilePostsQuery = z.object({ type: z.string().optional(), limit: z.string().optional() }).strict();

const ProfileUpdateBody = z.object({
    type: z.string().optional(),
    id: z.string().optional(),
    updates: z.record(z.string(), z.any())
}).strict();

const UserProfileCreateBody = z.object({
    uid: z.string(),
    email: z.string().email(),
    displayName: z.string().optional(),
    age: z.number().optional(),
    gender: z.string().optional(),
    phone: z.string().optional(),
    photoURL: z.string().optional(),
    avatar: z.string().optional(),
    city: z.string().optional(),
    instagram: z.string().optional(),
    onboardingComplete: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
}).catchall(z.any());

export default async function profileRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/profiles/:id
     * Fetch public profile data (User, Venue, or Host)
     */
    fastify.get('/profiles/:id', {
        preHandler: [fastify.validate({ params: ProfileIdParam, querystring: ProfileTypeQuery })]
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { type = 'user' } = request.query;

        try {
            const data = await fastify.profileService.getPublicProfile(id, type as any);
            if (!data) return reply.status(404).send({ error: "Profile not found" });
            return { id, ...data };
        } catch (error: any) {
            fastify.log.error(`Error in GET /profiles/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * PATCH /api/v1/profiles
     * Update current user's profile
     */
    fastify.patch('/profiles', {
        preHandler: [fastify.validate({ body: ProfileUpdateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        const { type = 'user', updates, id: targetId } = request.body;

        try {
            const actualId = type === 'user' ? userId : targetId;
            if (!actualId) {
                return reply.status(400).send(buildErrorResponse({
                    code: 'BAD_REQUEST',
                    message: 'ID required for this update type',
                    requestId: request.id,
                }));
            }

            let safeUpdates: Record<string, any>;

            if (type === 'user') {
                const existingDoc = await fastify.db.collection('users').doc(userId).get();
                const result = buildGuestProfileUpdates(updates, existingDoc.exists ? existingDoc.data() || {} : {});

                if (result.error) {
                    return reply.status(result.statusCode || 400).send(buildErrorResponse({
                        code: result.statusCode === 429 ? 'PROFILE_UPDATE_COOLDOWN' : 'PROFILE_UPDATE_INVALID',
                        message: result.error,
                        requestId: request.id,
                    }));
                }

                safeUpdates = result.safeUpdates;
            } else {
                safeUpdates = filterSafeProfileUpdates(updates);
            }

            if (Object.keys(safeUpdates).length === 0) {
                return reply.status(400).send(buildErrorResponse({
                    code: 'NO_VALID_FIELDS',
                    message: 'No valid fields to update',
                    requestId: request.id,
                }));
            }

            await fastify.profileService.updateProfile(actualId, type as any, safeUpdates);
            return { success: true, message: "Profile updated successfully" };
        } catch (error: any) {
            fastify.log.error(`Error in PATCH /profiles: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * GET /api/v1/profiles/:id/posts
     */
    fastify.get('/profiles/:id/posts', {
        preHandler: [fastify.validate({ params: ProfileIdParam, querystring: ProfilePostsQuery })]
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { type = 'venue', limit = 20 } = request.query;
        try {
            return await fastify.profileService.getPosts(id, type as string, Number(limit));
        } catch (error: any) {
            fastify.log.error(`Error in GET /profiles/:id/posts: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * GET /api/v1/profiles/:id/highlights
     */
    fastify.get('/profiles/:id/highlights', {
        preHandler: [fastify.validate({ params: ProfileIdParam, querystring: ProfileTypeQuery })]
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { type = 'venue' } = request.query;
        try {
            return await fastify.profileService.getHighlights(id, type as string);
        } catch (error: any) {
            fastify.log.error(`Error in GET /profiles/:id/highlights: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * POST /api/v1/users/profile
     */
    fastify.post('/users/profile', {
        preHandler: [fastify.validate({ body: UserProfileCreateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        const body = request.body as any;
        const { uid } = body;

        if (uid && uid !== userId) {
            return reply.status(403).send(buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Cannot create a profile for another user',
                requestId: request.id,
            }));
        }

        const now = new Date().toISOString();
        const profileDoc = buildGuestProfileCreatePayload(body, request.user, now);

        if (!profileDoc.uid || !profileDoc.email) {
            return reply.status(400).send(buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'uid and email are required',
                requestId: request.id,
            }));
        }

        try {
            await fastify.profileService.createProfile(profileDoc);
            return { success: true, uid: profileDoc.uid, profile: normalizeGuestProfile(profileDoc, request.user) };
        } catch (error: any) {
            fastify.log.error(`Error in POST /users/profile: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });
}
