import { FastifyInstance } from 'fastify';

const REVENUE_CAT_WEBHOOK_SECRET = process.env.REVENUE_CAT_WEBHOOK_SECRET || '';

export default async function revenuecatWebhookRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/v1/webhooks/revenuecat',
    {
      preHandler: [],
    },
    async (request: any, reply) => {
      const authHeader = request.headers['authorization'] || '';
      if (REVENUE_CAT_WEBHOOK_SECRET && authHeader !== `Bearer ${REVENUE_CAT_WEBHOOK_SECRET}`) {
        return reply
          .status(401)
          .send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid auth' } });
      }

      const body = request.body || {};
      const event = body.event || body;

      if (!event.app_user_id || !event.type) {
        return reply
          .status(400)
          .send({
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Missing app_user_id or type' },
          });
      }

      const uid = event.app_user_id;

      try {
        const isActive =
          event.type !== 'CANCELLATION' &&
          event.type !== 'EXPIRATION' &&
          event.type !== 'SUBSCRIPTION_PAUSED';

        const subscriptionData: Record<string, any> = {
          tier: isActive ? 'premium' : 'free',
          isPremium: isActive,
          updatedAt: new Date().toISOString(),
          lastEvent: event.type,
          productId: event.product_id || null,
          environment: event.environment || null,
        };

        if (event.expiration_at_ms) {
          subscriptionData.expiresAt = new Date(event.expiration_at_ms).toISOString();
        }

        await fastify.db
          .collection('users')
          .doc(uid)
          .set({ subscription: subscriptionData }, { merge: true });

        return reply.status(200).send({ success: true });
      } catch (error: any) {
        fastify.log.error(`RevenueCat webhook error: ${error.message}`);
        return reply
          .status(500)
          .send({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' },
          });
      }
    },
  );

  fastify.post(
    '/api/v1/webhooks/revenuecat/sync',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const uid = request.user?.uid;
      if (!uid) {
        return reply
          .status(401)
          .send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const { appUserID } = request.body || {};

      try {
        const userDoc = await fastify.db.collection('users').doc(uid).get();
        const userData = userDoc.data() || {};

        return reply
          .status(200)
          .send({
            success: true,
            data: { subscription: userData.subscription || { tier: 'free', isPremium: false } },
          });
      } catch (error: any) {
        fastify.log.error(`RevenueCat sync error: ${error.message}`);
        return reply
          .status(500)
          .send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Sync failed' } });
      }
    },
  );
}
