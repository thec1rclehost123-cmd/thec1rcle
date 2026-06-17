import { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
// @ts-ignore - JS module with runtime exports
import { archiveExpiredEventChats } from '@c1rcle/core/guest-chat-service';

const ArchiveChatsBody = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional().default(200),
    dryRun: z.boolean().optional().default(false),
  })
  .strict()
  .default({ limit: 200, dryRun: false });

function readProvidedSecret(request: any) {
  const headerSecret = request.headers['x-cron-secret'];
  if (typeof headerSecret === 'string' && headerSecret.trim()) return headerSecret.trim();

  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }

  return '';
}

function isValidCronSecret(provided: string) {
  const expected = process.env.CRON_SECRET || process.env.ARCHIVE_CHATS_CRON_SECRET || '';
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export default async function cronRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/cron/archive-chats',
    {
      preHandler: [fastify.validate({ body: ArchiveChatsBody })],
    },
    async (request: any, reply) => {
      if (!process.env.CRON_SECRET && !process.env.ARCHIVE_CHATS_CRON_SECRET) {
        request.log.error('CRON_SECRET is not configured');
        return reply.status(503).send(
          buildErrorResponse({
            code: 'CRON_SECRET_MISSING',
            message: 'Cron secret is not configured',
            requestId: request.id,
          }),
        );
      }

      if (!isValidCronSecret(readProvidedSecret(request))) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );
      }

      try {
        const result = await archiveExpiredEventChats(fastify.db, {
          limit: request.body?.limit,
          dryRun: request.body?.dryRun,
          olderThanHours: 48,
        });
        return buildSuccessResponse(result);
      } catch (error: any) {
        request.log.error({ error }, 'POST cron archive chats failed');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Unable to archive chats',
            requestId: request.id,
          }),
        );
      }
    },
  );
}
