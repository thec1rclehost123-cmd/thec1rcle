import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';

const ProfileUpdateBody = z
  .object({
    name: z.string().optional(),
    firstName: z.string().optional(),
    datingActive: z.boolean().optional(),
    photos: z.array(z.string()).optional(),
    prompts: z.array(z.any()).optional(),
    bio: z.string().optional(),
  })
  .strict();

const UserSettingsBody = z
  .object({
    bio: z.string().max(500).nullable().optional(),
    datingPhotos: z.array(z.string()).max(5).optional(),
    photos: z.array(z.string()).max(5).optional(),
    notificationPreferences: z.record(z.string(), z.boolean()).optional(),
    pushNewMatches: z.boolean().optional(),
    pushEventUpdates: z.boolean().optional(),
    displayName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    photoURL: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    instagram: z.string().nullable().optional(),
    spotify: z.string().nullable().optional(),
    datingActive: z.boolean().optional(),
  })
  .strict();

const TargetUserParam = z
  .object({
    targetUserId: z.string(),
  })
  .strict();

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/sync', async (request: any, reply: any) => {
    const userId = request.user?.uid;
    if (!userId) {
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        }),
      );
    }

    try {
      const { syncAuthUser } = await import('@c1rcle/core/user-service');
      const profile = await syncAuthUser(fastify.db, userId, request.user);
      return buildSuccessResponse({ profile });
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'POST /auth/sync failed',
      );
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.get('/users/me', async (request: any, reply: any) => {
    const userId = request.user?.uid;
    if (!userId) {
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        }),
      );
    }

    try {
      const { getPrivateProfile } = await import('@c1rcle/core/user-service');
      const profile = await getPrivateProfile(fastify.db, userId);
      return buildSuccessResponse({ profile });
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'GET /users/me failed',
      );
      return reply.status(error.message.includes('not found') ? 404 : 500).send(
        buildErrorResponse({
          code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message,
          requestId: request.id,
        }),
      );
    }
  });

  fastify.put(
    '/users/me',
    {
      preHandler: [fastify.validate({ body: ProfileUpdateBody })],
    },
    async (request: any, reply: any) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: request.id,
          }),
        );
      }

      try {
        const { updateProfile } = await import('@c1rcle/core/user-service');
        const profile = await updateProfile(fastify.db, userId, request.body);
        return buildSuccessResponse({ profile });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'PUT /users/me failed',
        );
        return reply.status(error.message.includes('not found') ? 404 : 500).send(
          buildErrorResponse({
            code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.patch(
    '/users/me/settings',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: UserSettingsBody })],
    },
    async (request: any, reply: any) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: request.id,
          }),
        );
      }

      try {
        const { updateUserProfileSettings } = await import('@c1rcle/core/profile-settings-service');
        const profile = await updateUserProfileSettings(fastify.db, userId, request.body);
        return buildSuccessResponse({ profile });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'PATCH /users/me/settings failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/users/me/block/:targetUserId',
    {
      preHandler: [fastify.validate({ params: TargetUserParam })],
    },
    async (request: any, reply: any) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: request.id,
          }),
        );
      }

      try {
        const { blockUser } = await import('@c1rcle/core/user-service');
        const result = await blockUser(fastify.db, userId, request.params.targetUserId);
        return buildSuccessResponse(result);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /users/me/block failed',
        );
        return reply.status(error.message.includes('not found') ? 404 : 500).send(
          buildErrorResponse({
            code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.delete(
    '/users/me',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: request.id,
          }),
        );
      }

      try {
        const { deleteUserAccountCascade } = await import('@c1rcle/core/account-deletion-service');
        const result = await deleteUserAccountCascade({
          db: fastify.db,
          auth: fastify.auth,
          storage: fastify.storage,
          uid: userId,
        });
        return buildSuccessResponse(result);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'DELETE /users/me failed',
        );
        return reply.status(error.message.includes('not found') ? 404 : 500).send(
          buildErrorResponse({
            code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );
}
