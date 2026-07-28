import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
// @ts-ignore
import {
  findGuestUserByEmail,
  getGuestProfileSummary,
} from '@c1rcle/core/guest-wallet-profile-notification-service';

const GuestProfileIdParam = z
  .object({
    id: z.string(),
  })
  .strict();

const GuestProfileLookupQuery = z
  .object({
    email: z.string().email(),
  })
  .strict();

export default async function guestProfileRoutes(fastify: FastifyInstance) {
  fastify.post('/guest-profiles/avatar', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );

    try {
      const data = await request.file();
      if (!data)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'No file uploaded',
            requestId: request.id,
          }),
        );

      const bucket = fastify.storage.bucket();
      const extension = (data.filename?.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
      const fileName = `guest-profiles/${userId}/avatar-${Date.now()}.${extension || 'jpg'}`;
      const file = bucket.file(fileName);

      const stream = file.createWriteStream({
        metadata: {
          contentType: data.mimetype,
          cacheControl: 'public, max-age=31536000',
        },
        public: true,
      });

      await new Promise((resolve, reject) => {
        data.file.pipe(stream).on('finish', resolve).on('error', reject);
      });

      const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      return buildSuccessResponse({ url });
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'POST /guest-profiles/avatar failed',
      );
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Upload failed',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.get(
    '/guest-profiles/lookup',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: GuestProfileLookupQuery })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      try {
        const user = await findGuestUserByEmail(fastify.db, request.query.email);
        if (!user)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Profile not found',
              requestId: request.id,
            }),
          );

        const userRecord = {
          uid: user.uid,
          displayName: user.displayName || user.name || 'Member',
          email: user.email || null,
          photoURL: user.photoURL || user.avatar || null,
          avatar: user.photoURL || user.avatar || null,
        };
        return buildSuccessResponse({ user: userRecord });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'GET /guest-profiles/lookup failed',
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

  fastify.get(
    '/guest-profiles/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: GuestProfileIdParam })],
    },
    async (request: any, reply) => {
      try {
        const viewerId = request.user?.uid || null;
        const result = await getGuestProfileSummary(
          fastify.db,
          fastify.auth,
          request.params.id,
          viewerId,
        );
        if (!result.profile)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Profile not found',
              requestId: request.id,
            }),
          );
        return buildSuccessResponse(result as Record<string, unknown>);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, error: error.message },
          'GET /guest-profiles/:id failed',
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
}
