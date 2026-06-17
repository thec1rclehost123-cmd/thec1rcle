import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';

const ProfileUpdateBody = z.object({
  name: z.string().optional(),
  firstName: z.string().optional(),
  datingActive: z.boolean().optional(),
  photos: z.array(z.string()).optional(),
  prompts: z.array(z.any()).optional(),
  bio: z.string().optional(),
}).strict();

const TargetUserParam = z.object({
  targetUserId: z.string()
}).strict();

export default async function userRoutes(fastify: FastifyInstance) {
  
  fastify.post('/auth/sync', async (request: any, reply: any) => {
    const userId = request.user?.uid;
    if (!userId) {
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        })
      );
    }

    try {
      const { syncAuthUser } = await import('@c1rcle/core/user-service');
      const profile = await syncAuthUser(fastify.db, userId, request.user);
      return buildSuccessResponse({ profile });
    } catch (error: any) {
      fastify.log.error({ requestId: request.id, userId, error: error.message }, 'POST /auth/sync failed');
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        })
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
        })
      );
    }

    try {
      const { getPrivateProfile } = await import('@c1rcle/core/user-service');
      const profile = await getPrivateProfile(fastify.db, userId);
      return buildSuccessResponse({ profile });
    } catch (error: any) {
      fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /users/me failed');
      return reply.status(error.message.includes('not found') ? 404 : 500).send(
        buildErrorResponse({
          code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message,
          requestId: request.id,
        })
      );
    }
  });

  fastify.put('/users/me', {
    preHandler: [fastify.validate({ body: ProfileUpdateBody })]
  }, async (request: any, reply: any) => {
    const userId = request.user?.uid;
    if (!userId) {
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        })
      );
    }

    try {
      const { updateProfile } = await import('@c1rcle/core/user-service');
      const profile = await updateProfile(fastify.db, userId, request.body);
      return buildSuccessResponse({ profile });
    } catch (error: any) {
      fastify.log.error({ requestId: request.id, userId, error: error.message }, 'PUT /users/me failed');
      return reply.status(error.message.includes('not found') ? 404 : 500).send(
        buildErrorResponse({
          code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message,
          requestId: request.id,
        })
      );
    }
  });

  fastify.post('/users/me/block/:targetUserId', {
    preHandler: [fastify.validate({ params: TargetUserParam })]
  }, async (request: any, reply: any) => {
    const userId = request.user?.uid;
    if (!userId) {
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        })
      );
    }

    try {
      const { blockUser } = await import('@c1rcle/core/user-service');
      const result = await blockUser(fastify.db, userId, request.params.targetUserId);
      return buildSuccessResponse(result);
    } catch (error: any) {
      fastify.log.error({ requestId: request.id, userId, error: error.message }, 'POST /users/me/block failed');
      return reply.status(error.message.includes('not found') ? 404 : 500).send(
        buildErrorResponse({
          code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message,
          requestId: request.id,
        })
      );
    }
  });

  fastify.delete('/users/me', async (request: any, reply: any) => {
    const userId = request.user?.uid;
    if (!userId) {
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        })
      );
    }

    try {
      const { softDeleteUser } = await import('@c1rcle/core/user-service');
      const result = await softDeleteUser(fastify.db, userId);
      return buildSuccessResponse(result);
    } catch (error: any) {
      fastify.log.error({ requestId: request.id, userId, error: error.message }, 'DELETE /users/me failed');
      return reply.status(error.message.includes('not found') ? 404 : 500).send(
        buildErrorResponse({
          code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: error.message,
          requestId: request.id,
        })
      );
    }
  });
}
