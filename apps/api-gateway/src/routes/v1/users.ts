import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  MAX_NIGHTLIFE_TASTES,
  MAX_USER_INTENTS,
  MIN_NIGHTLIFE_TASTES,
  MIN_USER_INTENTS,
  NIGHTLIFE_TASTES,
  USER_INTENTS,
} from '@c1rcle/types';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';

const DatingVitalsBody = z
  .object({
    height: z.string().max(40).nullable().optional(),
    gender: z.string().max(80).nullable().optional(),
    location: z.string().max(120).nullable().optional(),
  })
  .strict();

const ProfileAnthemBody = z
  .object({
    trackId: z.string().max(120).optional(),
    trackName: z.string().min(1).max(180),
    artistName: z.string().min(1).max(180),
    artworkUrl: z.string().url().nullable().optional(),
    previewUrl: z.string().url().nullable().optional(),
    source: z.enum(['itunes', 'spotify']).optional(),
    externalUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .nullable();

const ProfileUpdateBody = z
  .object({
    name: z.string().optional(),
    displayName: z.string().optional(),
    firstName: z.string().optional(),
    city: z.string().optional(),
    vibeTags: z.array(z.string()).max(20).optional(),
    photoURL: z.string().nullable().optional(),
    datingActive: z.boolean().optional(),
    datingPhotos: z.array(z.string()).max(6).optional(),
    datingVitals: DatingVitalsBody.optional(),
    anthem: ProfileAnthemBody.optional(),
    photos: z.array(z.string()).optional(),
    prompts: z.array(z.any()).optional(),
    bio: z.string().optional(),
    socialSetupComplete: z.boolean().optional(),
    verificationStatus: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
    isVerified: z.boolean().optional(),
    socialProfile: z.record(z.string(), z.any()).optional(),
    emergencyContacts: z
      .array(
        z
          .object({
            id: z.string().optional(),
            name: z.string().min(1).max(120),
            phone: z.string().min(3).max(40),
            relationship: z.string().max(80).optional(),
          })
          .strict(),
      )
      .max(5)
      .optional(),
  })
  .strict();

const VerificationBody = z
  .object({
    type: z.enum(['profile', 'social']).optional(),
    status: z.literal('pending').optional(),
    selfieUrl: z.string().url().nullable().optional(),
    displayName: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    photoURL: z.string().url().nullable().optional(),
    matchScore: z.number().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const SettingsNotificationBody = z
  .object({
    tickets: z.boolean().optional(),
    events: z.boolean().optional(),
    chat: z.boolean().optional(),
    dm: z.boolean().optional(),
    promo: z.boolean().optional(),
    allowAlerts: z.boolean().optional(),
    smsTransactional: z.boolean().optional(),
    marketingPromotions: z.boolean().optional(),
    eventInvites: z.boolean().optional(),
    eventReminders: z.boolean().optional(),
    eventBlasts: z.boolean().optional(),
    eventUpdates: z.boolean().optional(),
    feedbackRequests: z.boolean().optional(),
    guestRegistrations: z.boolean().optional(),
    feedbackResponses: z.boolean().optional(),
    newMembers: z.boolean().optional(),
    eventSubmissions: z.boolean().optional(),
  })
  .strict();

const SettingsPrivacyBody = z
  .object({
    dmPrivacy: z.enum(['anyone', 'event', 'contacts', 'none']).optional(),
    showOnlineStatus: z.boolean().optional(),
    showLastSeen: z.boolean().optional(),
    publicProfile: z.boolean().optional(),
    showOnGuestlists: z.boolean().optional(),
    showEventsAttending: z.boolean().optional(),
    contactsSyncing: z.boolean().optional(),
    locationAccess: z.boolean().optional(),
  })
  .strict();

const SettingsAppearanceBody = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    reduceMotion: z.boolean().optional(),
    haptics: z.boolean().optional(),
  })
  .strict();

const UserSettingsBody = z
  .object({
    bio: z.string().max(150).nullable().optional(),
    datingPhotos: z.array(z.string()).max(6).optional(),
    datingVitals: DatingVitalsBody.optional(),
    anthem: ProfileAnthemBody.optional(),
    photos: z.array(z.string()).max(6).optional(),
    vibeTags: z.array(z.string()).max(20).optional(),
    notificationPreferences: z.record(z.string(), z.boolean()).optional(),
    pushNewMatches: z.boolean().optional(),
    pushEventUpdates: z.boolean().optional(),
    displayName: z.string().max(100).nullable().optional(),
    name: z.string().max(100).nullable().optional(),
    firstName: z.string().max(100).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    photoURL: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    instagram: z.string().max(100).nullable().optional(),
    spotify: z.string().max(100).nullable().optional(),
    gender: z.string().nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    datingActive: z.boolean().optional(),
    socialSetupComplete: z.boolean().optional(),
    notifications: SettingsNotificationBody.optional(),
    privacy: SettingsPrivacyBody.optional(),
    appearance: SettingsAppearanceBody.optional(),
    settings: z
      .object({
        notifications: SettingsNotificationBody.optional(),
        privacy: SettingsPrivacyBody.optional(),
        appearance: SettingsAppearanceBody.optional(),
        updatedAt: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const TargetUserParam = z
  .object({
    targetUserId: z.string(),
  })
  .strict();

const DeviceTokenBody = z
  .object({
    token: z.string().min(8).max(512),
    provider: z.enum(['expo', 'apns', 'fcm']).optional().default('expo'),
    platform: z.enum(['ios', 'android', 'web', 'unknown']).optional().default('unknown'),
    deviceId: z.string().min(1).max(180).optional(),
    installationId: z.string().min(1).max(180).optional(),
    projectId: z.string().min(1).max(120).optional(),
    appVersion: z.string().min(1).max(80).optional(),
  })
  .strict();

const AuthSyncBody = z.object({}).strict().optional().default({});

const OnboardingIdentityBody = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const OnboardingCityBody = z
  .object({
    cityId: z.string().trim().min(1).max(120),
    cityName: z.string().trim().min(1).max(120),
    source: z.enum(['manual', 'location']),
  })
  .strict();

const NightlifeTaste = z.enum(NIGHTLIFE_TASTES);

const UserIntent = z.enum(USER_INTENTS);

const OnboardingPreferencesBody = z
  .object({
    vibeTags: z
      .array(NightlifeTaste)
      .min(MIN_NIGHTLIFE_TASTES)
      .max(MAX_NIGHTLIFE_TASTES)
      .optional(),
    intents: z.array(UserIntent).min(MIN_USER_INTENTS).max(MAX_USER_INTENTS).optional(),
  })
  .strict()
  .refine((value) => value.vibeTags !== undefined || value.intents !== undefined, {
    message: 'vibeTags or intents are required',
  });

const EmailPromptBody = z
  .object({
    status: z.enum(['shown', 'skipped']),
  })
  .strict();

async function loadFirebaseUser(fastify: FastifyInstance, userId: string, fallback: any = {}) {
  if (fastify.auth && typeof fastify.auth.getUser === 'function') {
    return fastify.auth.getUser(userId);
  }
  return fallback;
}

function sendOnboardingError(request: any, reply: any, error: any) {
  const statusCode = Number(error?.statusCode || 500);
  return reply.status(statusCode).send(
    buildErrorResponse({
      code: error?.code || 'INTERNAL_ERROR',
      message: error?.message || 'Internal server error',
      details: error?.details,
      requestId: request.id,
    }),
  );
}

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/auth/sync',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: AuthSyncBody })],
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
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
        const authRecord = await loadFirebaseUser(fastify, userId, request.user);
        const { syncAuthUser } = await import('@c1rcle/core/user-service');
        const syncedProfile = await syncAuthUser(fastify.db, userId, authRecord, {
          auth: fastify.auth,
        });
        const { syncOnboardingAuthState } = await import('@c1rcle/core/onboarding-service');
        const firstRun = await syncOnboardingAuthState(fastify.db, userId, authRecord);
        const profile = {
          ...syncedProfile,
          email: firstRun.identity.email,
          phoneNumber: firstRun.identity.phoneNumberE164,
        };
        return buildSuccessResponse({
          user: profile,
          profile,
          claims: profile.claims || {},
          requiresTokenRefresh: true,
          identity: firstRun.identity,
          onboarding: firstRun.onboarding,
          onboardingProfile: firstRun.onboardingProfile,
          routeAccess: firstRun.routeAccess,
        });
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
    {
      preHandler: [fastify.requireAuth],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request: any, reply: any) => {
      const userId = request.user?.uid;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: request.id,
          }),
        );
      try {
        const authRecord = await loadFirebaseUser(fastify, userId, request.user);
        const { syncOnboardingAuthState } = await import('@c1rcle/core/onboarding-service');
        return buildSuccessResponse(await syncOnboardingAuthState(fastify.db, userId, authRecord));
      } catch (error: any) {
        request.log.error(
          { requestId: request.id, userId, error: error?.message },
          'GET /users/me/onboarding failed',
        );
        return sendOnboardingError(request, reply, error);
      }
    },
  );

  const onboardingMutation = (
    path: string,
    schema: any,
    operation: 'identity' | 'city' | 'preferences' | 'emailPrompt',
  ) => {
    const register =
      operation === 'emailPrompt' ? fastify.post.bind(fastify) : fastify.patch.bind(fastify);
    register(
      path,
      {
        preHandler: [fastify.requireAuth, fastify.validate({ body: schema })],
        config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      },
      async (request: any, reply: any) => {
        const userId = request.user?.uid;
        if (!userId)
          return reply.status(401).send(
            buildErrorResponse({
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
              requestId: request.id,
            }),
          );
        try {
          const service = await import('@c1rcle/core/onboarding-service');
          if (operation === 'identity')
            await service.updateOnboardingIdentity(fastify.db, userId, request.body);
          if (operation === 'city')
            await service.updateOnboardingCity(fastify.db, userId, request.body);
          if (operation === 'preferences')
            await service.updateOnboardingPreferences(fastify.db, userId, request.body);
          if (operation === 'emailPrompt')
            await service.recordEmailPrompt(fastify.db, userId, request.body.status);
          if (operation === 'city' || operation === 'preferences') {
            await fastify.cache.invalidateNamespace('recommendations');
          }
          const authRecord = await loadFirebaseUser(fastify, userId, request.user);
          return buildSuccessResponse(
            await service.syncOnboardingAuthState(fastify.db, userId, authRecord),
          );
        } catch (error: any) {
          request.log.error(
            { requestId: request.id, userId, operation, error: error?.message },
            `PATCH ${path} failed`,
          );
          return sendOnboardingError(request, reply, error);
        }
      },
    );
  };

  onboardingMutation('/users/me/onboarding/identity', OnboardingIdentityBody, 'identity');
  onboardingMutation('/users/me/onboarding/city', OnboardingCityBody, 'city');
  onboardingMutation('/users/me/onboarding/preferences', OnboardingPreferencesBody, 'preferences');
  onboardingMutation('/users/me/onboarding/email-prompt', EmailPromptBody, 'emailPrompt');

  fastify.post(
    '/users/me/onboarding/complete',
    {
      preHandler: [fastify.requireAuth],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request: any, reply: any) => {
      const userId = request.user?.uid;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: request.id,
          }),
        );
      try {
        const authRecord = await loadFirebaseUser(fastify, userId, request.user);
        const { completeOnboarding } = await import('@c1rcle/core/onboarding-service');
        const result = await completeOnboarding(fastify.db, userId, authRecord);
        await fastify.cache.invalidateNamespace('recommendations');
        return buildSuccessResponse(result);
      } catch (error: any) {
        request.log.error(
          { requestId: request.id, userId, error: error?.message },
          'POST /users/me/onboarding/complete failed',
        );
        return sendOnboardingError(request, reply, error);
      }
    },
  );

  fastify.post(
    '/users/me/device-token',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: DeviceTokenBody })],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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
        const { registerDeviceToken } = await import('@c1rcle/core/user-service');
        const result = await registerDeviceToken(fastify.db, userId, request.body);
        return buildSuccessResponse(result);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /users/me/device-token failed',
        );
        const isBadRequest = error.message?.includes('Missing');
        return reply.status(isBadRequest ? 400 : 500).send(
          buildErrorResponse({
            code: isBadRequest ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
            message: isBadRequest ? error.message : 'Internal server error',
            requestId: request.id,
          }),
        );
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
        const statusCode = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        return reply.status(statusCode).send(
          buildErrorResponse({
            code:
              error.code || (error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
            message: error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/users/me/subscription',
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
        const { getUserSubscriptionSummary } = await import('@c1rcle/core/subscription-service');
        const summary = await getUserSubscriptionSummary(fastify.db, userId);
        return buildSuccessResponse(summary);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'GET /users/me/subscription failed',
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
    '/users/me/follows',
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
        const { listUserFollows } = await import('@c1rcle/core/user-service');
        const follows = await listUserFollows(fastify.db, userId);
        return buildSuccessResponse({ follows });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'GET /users/me/follows failed',
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
        return buildSuccessResponse({ profile });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'PUT /users/me failed',
        );
        const statusCode = error.statusCode || (error.message.includes('not found') ? 404 : 500);
        return reply.status(statusCode).send(
          buildErrorResponse({
            code:
              error.code || (error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
            message: error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/users/me/verification',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: VerificationBody })],
      config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
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
        const { submitVerificationAttempt } = await import('@c1rcle/core/user-service');
        const result = await submitVerificationAttempt(fastify.db, userId, request.body);
        return reply.status(202).send(buildSuccessResponse(result));
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /users/me/verification failed',
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
    '/users/me/settings',
    {
      preHandler: [fastify.requireAuth],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
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
        const { getUserSettings } = await import('@c1rcle/core/profile-settings-service');
        const settings = await getUserSettings(fastify.db, userId);
        return buildSuccessResponse({ settings });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'GET /users/me/settings failed',
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

  fastify.patch(
    '/users/me/settings',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: UserSettingsBody })],
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
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

        const statusCode = error.statusCode || error.status || 500;
        return reply.status(statusCode).send(
          buildErrorResponse({
            code: error.code || 'INTERNAL_ERROR',
            message: error.message || 'Internal server error',
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
