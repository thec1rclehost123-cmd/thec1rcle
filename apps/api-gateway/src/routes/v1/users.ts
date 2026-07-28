import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { syncAuthUser } from '@c1rcle/core/user-service';
import { buildGuestOnboardingSnapshot } from '@c1rcle/core/guest-onboarding-service';
import {
  buildGuestSubscriptionContext,
  getDailyUsageDocumentId,
} from '@c1rcle/core/guest-subscription-service';
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
    settings: z
      .object({
        notifications: z.record(z.string(), z.boolean()).optional(),
        privacy: z.record(z.string(), z.unknown()).optional(),
        appearance: z.record(z.string(), z.unknown()).optional(),
        updatedAt: z.string().optional(),
      })
      .optional(),
  })
  .strict();

const TargetUserParam = z
  .object({
    targetUserId: z.string(),
  })
  .strict();

const IdentityBody = z
  .object({
    displayName: z.string().trim().min(2).max(100),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const CityBody = z
  .object({
    cityId: z.string().trim().min(1).max(120),
    cityName: z.string().trim().min(1).max(120),
    source: z.enum(['manual', 'location']),
  })
  .strict();

const NightlifeTaste = z.enum([
  'clubs',
  'live_music',
  'lounges',
  'festivals',
  'college_nights',
  'underground',
  'food_culture',
  'premium',
]);

const UserIntent = z.enum(['discover', 'friends', 'meet_people', 'host_promote']);

const PreferencesBody = z
  .object({
    vibeTags: z.array(NightlifeTaste).min(3).max(8).optional(),
    intents: z.array(UserIntent).min(1).max(4).optional(),
  })
  .strict()
  .refine((value) => value.vibeTags !== undefined || value.intents !== undefined, {
    message: 'At least one preference field is required',
  });

const EmailPromptBody = z
  .object({
    status: z.enum(['shown', 'skipped', 'pending_verification', 'verified']),
  })
  .strict();

function guestAuthIdentity(user: any) {
  return {
    phoneNumber: user?.phoneNumber || user?.phone_number || user?.phone || null,
    email: user?.email || null,
  };
}

function domainErrorStatus(error: any) {
  if (error?.code === 'USER_NOT_FOUND') return 404;
  if (error?.code === 'UNAUTHORIZED') return 401;
  if (error?.code === 'PHONE_VERIFICATION_REQUIRED') return 403;
  if (
    [
      'ONBOARDING_IDENTITY_INVALID',
      'ONBOARDING_AGE_RESTRICTED',
      'ONBOARDING_CITY_INVALID',
      'ONBOARDING_PREFERENCES_INVALID',
      'ONBOARDING_EMAIL_STATUS_INVALID',
      'ONBOARDING_INCOMPLETE',
    ].includes(error?.code)
  ) {
    return 409;
  }
  return 500;
}

function sendDomainError(request: any, reply: any, error: any) {
  const status = domainErrorStatus(error);
  return reply.status(status).send(
    buildErrorResponse({
      code: status === 500 ? 'INTERNAL_ERROR' : error.code,
      message: status === 500 ? 'Internal server error' : error.message,
      requestId: request.id,
    }),
  );
}

export default async function userRoutes(fastify: FastifyInstance) {
  const authBootstrapCacheKey = (userId: string) => `user:${userId}:contract-v2`;
  const invalidateAuthBootstrap = async (userId: string) => {
    await fastify.cache.delete('auth-bootstrap', authBootstrapCacheKey(userId));
  };

  fastify.post(
    '/auth/sync',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
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
        const cacheKey = authBootstrapCacheKey(userId);
        const cached = await fastify.cache.get('auth-bootstrap', cacheKey);
        if (cached) return cached;

        const now = new Date();
        const usageRef = fastify.db
          .collection('userDailyLimits')
          .doc(getDailyUsageDocumentId(userId, now));
        // One canonical user read is enough for profile, onboarding, and
        // subscription bootstrap. The usage document is independent and can
        // load alongside it.
        const [profile, usageSnapshot] = await Promise.all([
          syncAuthUser(fastify.db, userId, request.user),
          usageRef.get(),
        ]);
        const snapshot = buildGuestOnboardingSnapshot(profile, guestAuthIdentity(request.user));
        const subscriptionContext = buildGuestSubscriptionContext(
          profile,
          usageSnapshot.exists ? usageSnapshot.data() || {} : {},
          now,
        );
        const response = buildSuccessResponse({
          profile,
          snapshot,
          onboarding: snapshot,
          requirements: { minimumAccountAge: 18, minimumTastes: 3 },
          ...subscriptionContext,
        });
        await fastify.cache.set('auth-bootstrap', cacheKey, response, 30);
        return response;
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
    },
  );

  fastify.get(
    '/users/me/onboarding',
    { preHandler: [fastify.requireAuth] },
    async (request: any, reply: any) => {
      try {
        const { getGuestOnboardingSnapshot } =
          await import('@c1rcle/core/guest-onboarding-service');
        const snapshot = await getGuestOnboardingSnapshot(
          fastify.db,
          request.user.uid,
          guestAuthIdentity(request.user),
        );
        return buildSuccessResponse({
          snapshot,
          onboarding: snapshot,
          requirements: { minimumAccountAge: 18, minimumTastes: 3 },
        });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId: request.user?.uid, code: error.code },
          'GET /users/me/onboarding failed',
        );
        return sendDomainError(request, reply, error);
      }
    },
  );

  fastify.patch(
    '/users/me/onboarding/identity',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: IdentityBody })],
    },
    async (request: any, reply: any) => {
      try {
        const { saveGuestOnboardingIdentity } =
          await import('@c1rcle/core/guest-onboarding-service');
        const snapshot = await saveGuestOnboardingIdentity(
          fastify.db,
          request.user.uid,
          guestAuthIdentity(request.user),
          request.body,
        );
        await invalidateAuthBootstrap(request.user.uid);
        return buildSuccessResponse({ snapshot, onboarding: snapshot });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId: request.user?.uid, code: error.code },
          'PATCH /users/me/onboarding/identity failed',
        );
        return sendDomainError(request, reply, error);
      }
    },
  );

  fastify.patch(
    '/users/me/onboarding/city',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: CityBody })],
    },
    async (request: any, reply: any) => {
      try {
        const { saveGuestOnboardingCity } = await import('@c1rcle/core/guest-onboarding-service');
        const snapshot = await saveGuestOnboardingCity(
          fastify.db,
          request.user.uid,
          guestAuthIdentity(request.user),
          request.body,
        );
        await invalidateAuthBootstrap(request.user.uid);
        return buildSuccessResponse({ snapshot, onboarding: snapshot });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId: request.user?.uid, code: error.code },
          'PATCH /users/me/onboarding/city failed',
        );
        return sendDomainError(request, reply, error);
      }
    },
  );

  fastify.patch(
    '/users/me/onboarding/preferences',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: PreferencesBody })],
    },
    async (request: any, reply: any) => {
      try {
        const { saveGuestOnboardingPreferences } =
          await import('@c1rcle/core/guest-onboarding-service');
        const snapshot = await saveGuestOnboardingPreferences(
          fastify.db,
          request.user.uid,
          guestAuthIdentity(request.user),
          request.body,
        );
        await invalidateAuthBootstrap(request.user.uid);
        return buildSuccessResponse({ snapshot, onboarding: snapshot });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId: request.user?.uid, code: error.code },
          'PATCH /users/me/onboarding/preferences failed',
        );
        return sendDomainError(request, reply, error);
      }
    },
  );

  fastify.post(
    '/users/me/onboarding/email-prompt',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: EmailPromptBody })],
    },
    async (request: any, reply: any) => {
      try {
        const { saveGuestEmailPromptStatus } =
          await import('@c1rcle/core/guest-onboarding-service');
        const snapshot = await saveGuestEmailPromptStatus(
          fastify.db,
          request.user.uid,
          guestAuthIdentity(request.user),
          request.body.status,
        );
        await invalidateAuthBootstrap(request.user.uid);
        return buildSuccessResponse({ snapshot, onboarding: snapshot });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId: request.user?.uid, code: error.code },
          'POST /users/me/onboarding/email-prompt failed',
        );
        return sendDomainError(request, reply, error);
      }
    },
  );

  fastify.post(
    '/users/me/onboarding/complete',
    { preHandler: [fastify.requireAuth] },
    async (request: any, reply: any) => {
      try {
        const { completeGuestOnboarding } = await import('@c1rcle/core/guest-onboarding-service');
        const snapshot = await completeGuestOnboarding(
          fastify.db,
          request.user.uid,
          guestAuthIdentity(request.user),
        );
        await invalidateAuthBootstrap(request.user.uid);
        return buildSuccessResponse({ snapshot, onboarding: snapshot });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId: request.user?.uid, code: error.code },
          'POST /users/me/onboarding/complete failed',
        );
        return sendDomainError(request, reply, error);
      }
    },
  );

  fastify.get(
    '/users/me/subscription',
    { preHandler: [fastify.requireAuth] },
    async (request: any, reply: any) => {
      try {
        const { getGuestSubscriptionContext } =
          await import('@c1rcle/core/guest-subscription-service');
        const context = await getGuestSubscriptionContext(fastify.db, request.user.uid);
        return buildSuccessResponse(context);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId: request.user?.uid, code: error.code },
          'GET /users/me/subscription failed',
        );
        return sendDomainError(request, reply, error);
      }
    },
  );

  fastify.get(
    '/users/me',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
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
    },
  );

  fastify.put(
    '/users/me',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: ProfileUpdateBody })],
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
        await invalidateAuthBootstrap(userId);
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
        await invalidateAuthBootstrap(userId);
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
      preHandler: [fastify.requireAuth, fastify.validate({ params: TargetUserParam })],
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
        await invalidateAuthBootstrap(userId);
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
        await invalidateAuthBootstrap(userId);
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
