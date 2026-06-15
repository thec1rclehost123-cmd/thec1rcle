import { FastifyInstance } from 'fastify';
import { joinWaitlist, processWaitlist, verifyWaitlistAccess } from '@c1rcle/core/waitlist-engine';
import { z } from 'zod';

const JoinBody = z
  .object({
    eventId: z.string(),
    tierId: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .strict();
const ProcessBody = z
  .object({
    eventId: z.string(),
    tierId: z.string(),
  })
  .strict();
const VerifyQuery = z
  .object({
    eventId: z.string(),
    email: z.string().email(),
  })
  .strict();

export default async function waitlistRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/waitlist/join
   */
  fastify.post(
    '/join',
    {
      preHandler: [fastify.validate({ body: JoinBody })],
    },
    async (request: any, reply) => {
      const body = request.body as any;
      const resolvedEmail = request.user?.email || body.email || null;
      if (!resolvedEmail) {
        return reply.status(400).send({ error: 'email is required' });
      }

      try {
        return await joinWaitlist({
          eventId: body.eventId,
          tierId: body.tierId,
          email: resolvedEmail,
          phone: body.phone || null,
          userId: request.user?.uid || null,
        });
      } catch (error: any) {
        reply.status(400).send({ error: 'Request failed' });
      }
    },
  );

  /**
   * POST /api/v1/waitlist/process
   * Internal endpoint — requires INTERNAL_API_KEY, not a user token.
   */
  fastify.post(
    '/process',
    {
      preHandler: [
        async (request: any, reply: any) => {
          const internalKey = process.env.INTERNAL_API_KEY;
          const token = request.headers.authorization?.split(' ')[1];
          if (!internalKey || token !== internalKey) {
            return reply.status(401).send({ error: 'Unauthorized: Internal endpoint' });
          }
        },
        fastify.validate({ body: ProcessBody }),
      ],
    },
    async (request, reply) => {
      const { eventId, tierId } = request.body as { eventId: string; tierId: string };
      try {
        const next = await processWaitlist(eventId, tierId);
        if (!next) return { status: 'empty' };
        return next;
      } catch (error: any) {
        reply.status(400).send({ error: 'Request failed' });
      }
    },
  );

  /**
   * GET /api/v1/waitlist/status
   */
  fastify.get(
    '/status',
    {
      preHandler: [
        fastify.validate({
          querystring: z
            .object({
              eventId: z.string(),
              email: z.string(),
            })
            .strict(),
        }),
      ],
    },
    async (request: any, reply) => {
      const { eventId, email } = request.query;

      try {
        const col = fastify.db.collection('waitlist');

        // Get total waiting count
        const totalSnap = await col
          .where('eventId', '==', eventId)
          .where('status', '==', 'waiting')
          .count()
          .get();

        const totalWaiting = totalSnap.data().count;

        // Check if user is on waitlist
        const userSnap = await col
          .where('eventId', '==', eventId)
          .where('email', '==', email)
          .where('status', '==', 'waiting')
          .limit(1)
          .get();

        if (userSnap.empty) {
          return { joined: false, totalWaiting };
        }

        const userDoc = userSnap.docs[0];
        const userCreatedAt = userDoc.data().createdAt;

        // Calculate position
        const beforeSnap = await col
          .where('eventId', '==', eventId)
          .where('status', '==', 'waiting')
          .where('createdAt', '<', userCreatedAt)
          .count()
          .get();

        return {
          joined: true,
          position: beforeSnap.data().count + 1,
          totalWaiting,
        };
      } catch (error: any) {
        fastify.log.error(`Error in GET /waitlist/status: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * GET /api/v1/waitlist/verify
   */
  fastify.get(
    '/verify',
    {
      preHandler: [fastify.validate({ querystring: VerifyQuery })],
    },
    async (request, reply) => {
      const { eventId, email } = request.query as { eventId: string; email: string };
      try {
        return await verifyWaitlistAccess(eventId, email);
      } catch (error: any) {
        reply.status(400).send({ error: 'Request failed' });
      }
    },
  );
}
