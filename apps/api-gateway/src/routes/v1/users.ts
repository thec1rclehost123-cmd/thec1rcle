import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';

const ProfileUpdateBody = z
  .object({
    name: z.string().optional(),
    displayName: z.string().optional(),
    firstName: z.string().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    city: z.string().optional(),
    vibeTags: z.array(z.string()).max(20).optional(),
    photoURL: z.string().nullable().optional(),
    datingActive: z.boolean().optional(),
    photos: z.array(z.string()).optional(),
    prompts: z.array(z.any()).optional(),
    bio: z.string().optional(),
    profileSetupComplete: z.boolean().optional(),
    profileComplete: z.boolean().optional(),
    onboardingComplete: z.boolean().optional(),
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

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/auth/sync',
    {
      preHandler: [fastify.requireAuth],
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
        const { syncAuthUser } = await import('@c1rcle/core/user-service');
        const profile = await syncAuthUser(fastify.db, userId, request.user, {
          auth: fastify.auth,
        });
        return buildSuccessResponse({
          user: profile,
          profile,
          claims: profile.claims || {},
          requiresTokenRefresh: true,
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
