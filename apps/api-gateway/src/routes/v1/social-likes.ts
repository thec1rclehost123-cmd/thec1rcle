import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
// @ts-ignore - JS module with runtime exports
import { listReceivedLikes, respondToLikeRequest } from '@c1rcle/core/guest-dating-service';

const LikeRequestParams = z
  .object({
    id: z.string().min(1).max(180),
  })
  .strict();

const LikeRequestActionBody = z
  .object({
    action: z.enum(['accept', 'reject']),
  })
  .strict();

function statusForLikeError(message = '') {
  if (message === 'Like request not found') return 404;
  if (message === 'Forbidden') return 403;
  if (message.includes('required') || message === 'Invalid action') return 400;
  return 500;
}

function codeForStatus(status: number) {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
}

export default async function socialLikesRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/social/likes/received',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );
      }

      try {
        reply.header('Cache-Control', 'private, no-store');
        const result = await listReceivedLikes(fastify.db, userId);
        return buildSuccessResponse(result);
      } catch (error: any) {
        request.log.error({ error, userId }, 'GET received likes failed');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Unable to load likes',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/social/likes/:id/respond',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: LikeRequestParams, body: LikeRequestActionBody }),
      ],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );
      }

      try {
        const result = await respondToLikeRequest(
          fastify.db,
          userId,
          request.params.id,
          request.body,
        );
        return buildSuccessResponse(result);
      } catch (error: any) {
        const status = statusForLikeError(error.message);
        request.log.warn(
          { error, userId, likeId: request.params.id },
          'POST like request response failed',
        );
        return reply.status(status).send(
          buildErrorResponse({
            code: codeForStatus(status),
            message: status === 500 ? 'Unable to respond to like' : error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );
}
