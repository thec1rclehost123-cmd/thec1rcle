import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';

const CreateBody = z
  .object({
    planId: z.enum(['c1rcle_plus_monthly', 'c1rcle_plus_yearly', 'c1rcle_plus_lifetime']),
    countryCode: z.string().default('IN'),
  })
  .strict();

const VerifyBody = z
  .object({
    razorpay_subscription_id: z.string(),
    razorpay_payment_id: z.string().optional(),
    razorpay_signature: z.string().optional(),
  })
  .strict();

export default async function subscriptionRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/subscriptions/create
   * Create a Razorpay subscription order for C1RCLE+.
   */
  fastify.post(
    '/subscriptions/create',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: CreateBody })],
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

      const { planId, countryCode } = request.body;

      try {
        // Define plan pricing (INR)
        const plans: Record<string, { amount: number; period: string; interval: number }> = {
          c1rcle_plus_monthly: { amount: 49900, period: 'monthly', interval: 1 },
          c1rcle_plus_yearly: { amount: 399900, period: 'monthly', interval: 12 },
          c1rcle_plus_lifetime: { amount: 999900, period: 'one_time', interval: 1 },
        };

        const plan = plans[planId];
        if (!plan)
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'Invalid plan',
              requestId: request.id,
            }),
          );

        if (!fastify.razorpay) {
          return reply.status(500).send(
            buildErrorResponse({
              code: 'CONFIG_ERROR',
              message: 'Razorpay not configured',
              requestId: request.id,
            }),
          );
        }

        let razorpaySubscription: any;

        if (plan.period === 'one_time') {
          // One-time/lifetime: create a Razorpay order
          razorpaySubscription = await fastify.razorpay.orders.create({
            amount: plan.amount,
            currency: 'INR',
            receipt: `sub_lifetime_${userId}_${Date.now()}`,
            notes: {
              type: 'subscription',
              planId,
              userId,
            },
          });
        } else {
          // Recurring: create a Razorpay subscription
          const razorpayPlan = await fastify.razorpay.plans.create({
            period: plan.period,
            interval: plan.interval,
            item: {
              name: `C1RCLE+ ${planId}`,
              amount: plan.amount,
              currency: 'INR',
              description: `C1RCLE+ ${planId.replace('_', ' ')} subscription`,
            },
          });

          razorpaySubscription = await fastify.razorpay.subscriptions.create({
            plan_id: razorpayPlan.id,
            customer_notify: 1,
            total_count: plan.period === 'monthly' ? 12 : 1,
            notes: {
              userId,
              planId,
            },
          });
        }

        // Save pending subscription to Firestore
        await fastify.db.collection('subscriptions').add({
          userId,
          planId,
          status: 'pending',
          razorpayId: razorpaySubscription.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        fastify.log.info(
          { requestId: request.id, userId, planId, razorpayId: razorpaySubscription.id },
          'Subscription created',
        );

        return buildSuccessResponse({
          subscriptionId: razorpaySubscription.id,
          amount: plan.amount,
          currency: 'INR',
          key: process.env.RAZORPAY_KEY_ID,
        });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /subscriptions/create failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: error.message || 'Failed to create subscription',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/subscriptions/verify
   * Verify Razorpay payment/webhook and activate subscription.
   */
  fastify.post(
    '/subscriptions/verify',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: VerifyBody })],
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

      const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = request.body;

      // Verify Razorpay signature to prevent unauthorized activation
      if (razorpay_payment_id && razorpay_signature) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
          return reply.status(500).send(
            buildErrorResponse({
              code: 'CONFIG_ERROR',
              message: 'Payment verification not configured',
              requestId: request.id,
            }),
          );
        }
        const generated = crypto
          .createHmac('sha256', secret)
          .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
          .digest('hex');
        if (generated !== razorpay_signature) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Invalid payment signature',
              requestId: request.id,
            }),
          );
        }
      }

      try {
        // Find the pending subscription
        const snapshot = await fastify.db
          .collection('subscriptions')
          .where('razorpayId', '==', razorpay_subscription_id)
          .where('userId', '==', userId)
          .limit(1)
          .get();

        if (snapshot.empty) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Subscription not found',
              requestId: request.id,
            }),
          );
        }

        const subDoc = snapshot.docs[0];
        const subData = subDoc.data();

        // Update subscription status in Firestore
        const expiresAt = new Date();
        if (subData.planId?.includes('yearly')) {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else if (subData.planId?.includes('monthly')) {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else {
          expiresAt.setFullYear(expiresAt.getFullYear() + 99); // lifetime
        }

        const batch = fastify.db.batch();
        batch.update(subDoc.ref, {
          status: 'active',
          verifiedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Set premium flag on user profile
        const userRef = fastify.db.collection('users').doc(userId);
        batch.update(userRef, {
          isPremium: true,
          subscriptionStatus: 'active',
          subscriptionPlan: subData.planId,
          subscriptionExpiresAt: expiresAt.toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await batch.commit();

        fastify.log.info(
          { requestId: request.id, userId, subscriptionId: razorpay_subscription_id },
          'Subscription activated',
        );

        return buildSuccessResponse({
          status: 'active',
          expiresAt: expiresAt.toISOString(),
          planId: subData.planId,
        });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /subscriptions/verify failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: error.message || 'Failed to verify subscription',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * GET /api/v1/subscriptions/status
   * Check current user's subscription status.
   */
  fastify.get(
    '/subscriptions/status',
    { preHandler: [fastify.requireAuth] },
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
      const userDoc = await fastify.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return buildSuccessResponse({
          isPremium: false,
          status: 'none',
          planId: null,
          expiresAt: null,
        });
      }

      const userData = userDoc.data();
      if (!userData) {
        return buildSuccessResponse({
          isPremium: false,
          status: 'none',
          planId: null,
          expiresAt: null,
        });
      }
      const expiresAt = userData.subscriptionExpiresAt;
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

      return buildSuccessResponse({
        isPremium: userData.isPremium === true && !isExpired,
        status: isExpired ? 'expired' : userData.subscriptionStatus || 'none',
        planId: userData.subscriptionPlan || null,
        expiresAt: isExpired ? null : expiresAt || null,
      });
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'GET /subscriptions/status failed',
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

  /**
   * POST /api/v1/subscriptions/cancel
   * Cancel the user's active subscription.
   */
  fastify.post('/subscriptions/cancel', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply) => {
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
      // Find active subscription
      const snapshot = await fastify.db
        .collection('subscriptions')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'No active subscription found',
            requestId: request.id,
          }),
        );
      }

      const subDoc = snapshot.docs[0];
      const subData = subDoc.data();

      // Cancel with Razorpay if recurring
      if (subData.razorpayId && subData.planId !== 'c1rcle_plus_lifetime') {
        try {
          await fastify.razorpay.subscriptions.cancel(subData.razorpayId);
        } catch (rpError: any) {
          fastify.log.warn(
            { requestId: request.id, razorpayId: subData.razorpayId, error: rpError.message },
            'Razorpay cancel failed (may already be cancelled)',
          );
        }
      }

      const batch = fastify.db.batch();
      batch.update(subDoc.ref, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const userRef = fastify.db.collection('users').doc(userId);
      batch.update(userRef, {
        isPremium: false,
        subscriptionStatus: 'cancelled',
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      return buildSuccessResponse({ status: 'cancelled' });
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'POST /subscriptions/cancel failed',
      );
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to cancel subscription',
          requestId: request.id,
        }),
      );
    }
  });
}
