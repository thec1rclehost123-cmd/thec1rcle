import { filterSafeProfileUpdates } from '@c1rcle/core/profile-engine';
import { z } from 'zod';
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
    city: z.string().optional(),
    instagram: z.string().optional(),
    isVerified: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
}).catchall(z.any());
export default async function profileRoutes(fastify) {
    /**
     * GET /api/v1/profiles/:id
     * Fetch public profile data (User, Venue, or Host)
     */
    fastify.get('/profiles/:id', {
        preHandler: [fastify.validate({ params: ProfileIdParam, querystring: ProfileTypeQuery })]
    }, async (request, reply) => {
        const { id } = request.params;
        const { type = 'user' } = request.query;
        try {
            const data = await fastify.profileService.getPublicProfile(id, type);
            if (!data)
                return reply.status(404).send({ error: "Profile not found" });
            return { id, ...data };
        }
        catch (error) {
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
    }, async (request, reply) => {
        const userId = request.user?.uid;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        const { type = 'user', updates, id: targetId } = request.body;
        const safeUpdates = filterSafeProfileUpdates(updates);
        if (Object.keys(safeUpdates).length === 0) {
            return reply.status(400).send({ error: "No valid fields to update" });
        }
        try {
            const actualId = type === 'user' ? userId : targetId;
            if (!actualId)
                return reply.status(400).send({ error: "ID required for this update type" });
            await fastify.profileService.updateProfile(actualId, type, safeUpdates);
            return { success: true, message: "Profile updated successfully" };
        }
        catch (error) {
            fastify.log.error(`Error in PATCH /profiles: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * GET /api/v1/profiles/:id/posts
     */
    fastify.get('/profiles/:id/posts', {
        preHandler: [fastify.validate({ params: ProfileIdParam, querystring: ProfilePostsQuery })]
    }, async (request, reply) => {
        const { id } = request.params;
        const { type = 'venue', limit = 20 } = request.query;
        try {
            return await fastify.profileService.getPosts(id, type, Number(limit));
        }
        catch (error) {
            fastify.log.error(`Error in GET /profiles/:id/posts: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * GET /api/v1/profiles/:id/highlights
     */
    fastify.get('/profiles/:id/highlights', {
        preHandler: [fastify.validate({ params: ProfileIdParam, querystring: ProfileTypeQuery })]
    }, async (request, reply) => {
        const { id } = request.params;
        const { type = 'venue' } = request.query;
        try {
            return await fastify.profileService.getHighlights(id, type);
        }
        catch (error) {
            fastify.log.error(`Error in GET /profiles/:id/highlights: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * POST /api/v1/users/profile
     */
    fastify.post('/users/profile', {
        preHandler: [fastify.validate({ body: UserProfileCreateBody })]
    }, async (request, reply) => {
        const body = request.body;
        const { uid, email, displayName, age, gender, phone, photoURL, createdAt, updatedAt } = body;
        if (!uid || !email)
            return reply.status(400).send({ error: 'uid and email are required' });
        const now = new Date().toISOString();
        const profileDoc = {
            uid, email, displayName: displayName || '', age: age || null, gender: gender || null,
            phone: phone || null, photoURL: photoURL || '', attendedEvents: [],
            city: body.city || '', instagram: body.instagram || '',
            isVerified: body.isVerified ?? true,
            createdAt: createdAt || now, updatedAt: updatedAt || now,
        };
        try {
            await fastify.profileService.createProfile(profileDoc);
            return { success: true, uid };
        }
        catch (error) {
            fastify.log.error(`Error in POST /users/profile: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
//# sourceMappingURL=profiles.js.map