import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import {
  buildGuestProfileCreatePayload,
  buildGuestProfileUpdates,
  GUEST_PHONE_REGEX,
  normalizeGuestProfile,
} from '../../lib/guest-auth';
import {
  enrichHostProfileWithSignedUrls,
  cleanHostProfilePatch,
  enrichPromoterProfileWithSignedUrls,
  cleanPromoterProfilePatch,
  enrichVenueProfileWithSignedUrls,
  cleanVenueProfilePatch,
} from '../../lib/signed-urls.js';
import { getPartnerProfileWithPii } from '../../utils/partner-profiles.js';

const ProfileIdParam = z.object({ id: z.string() }).strict();
const ProfileTypeQuery = z.object({ type: z.string().optional() }).strict();
const ProfilePostsQuery = z
  .object({ type: z.string().optional(), limit: z.string().optional() })
  .strict();

const guestPhoneSchema = z
  .string()
  .max(20)
  .refine((value) => value === '' || GUEST_PHONE_REGEX.test(value), {
    message: 'Phone number must contain exactly 10 digits',
  })
  .optional();

const PersonalUpdateSchema = z
  .object({
    displayName: z.string().max(100).optional(),
    age: z.number().min(1).max(150).optional(),
    gender: z.string().max(20).optional(),
    city: z.string().max(100).optional(),
    phone: guestPhoneSchema,
    phoneNumber: guestPhoneSchema,
    onboardingComplete: z.boolean().optional(),
  })
  .strict();

const SocialUpdateSchema = z
  .object({
    instagram: z.string().max(100).optional(),
    handle: z.string().max(30).optional(),
    username: z.string().max(30).optional(),
  })
  .strict();

const BioUpdateSchema = z
  .object({
    bio: z.string().max(500).optional(),
  })
  .strict();

const AvatarUpdateSchema = z
  .object({
    photoURL: z.string().optional(),
    avatar: z.string().optional(),
  })
  .strict();

const UnifiedProfileUpdateSchema = z.object({}).passthrough();

const UserProfileCreateBody = z
  .object({
    uid: z.string(),
    email: z.string().email(),
    displayName: z.string().max(100).optional(),
    age: z.number().min(1).max(150).optional(),
    gender: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    photoURL: z.string().optional(),
    avatar: z.string().optional(),
    city: z.string().max(100).optional(),
    instagram: z.string().max(100).optional(),
    onboardingComplete: z.boolean().optional(),
    bio: z.string().max(500).optional(),
  })
  .strict();

export default async function profileRoutes(fastify: FastifyInstance) {
  const ALLOWED_PROMOTER_PROFILE_FIELDS = [
    'displayName',
    'name',
    'handle',
    'avatarUrl',
    'photoURL',
    'profileImage',
    'phone',
    'contactEmail',
    'contactPhone',
    'instagram',
    'instagramHandle',
    'bio',
    'summary',
    'city',
    'isPublic',
    'socialLinks',
    'website',
    'username',
    'coverImage',
    'coverURL',
    'backdropURL',
    'email',
  ];

  const ALLOWED_HOST_PROFILE_FIELDS = [
    'displayName',
    'bio',
    'tagline',
    'profileImage',
    'coverImage',
    'socialLinks',
    'contactEmail',
    'contactPhone',
    'genre',
    'city',
    'instagramHandle',
    'youtubeHandle',
    'spotifyHandle',
    'photoURL',
    'coverURL',
    'instagram',
    'phone',
    'username',
    'handle',
  ];

  const ALLOWED_VENUE_PROFILE_FIELDS = [
    'name',
    'description',
    'bio',
    'tagline',
    'address',
    'city',
    'state',
    'capacity',
    'amenities',
    'photos',
    'coverImage',
    'profileImage',
    'contactEmail',
    'contactPhone',
    'socialLinks',
    'operatingHours',
    'dressCode',
    'ageRestriction',
    'instagramHandle',
    'youtubeHandle',
    'spotifyHandle',
    'photoURL',
    'coverURL',
  ];

  fastify.get(
    '/profile',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [
        async (request) => {
          if ((fastify as any).requireAuth) await (fastify as any).requireAuth(request);
        },
      ],
    },
    async (request: any, reply) => {
      const { profileId, type, stats } = request.query as any;
      if (!profileId || !type) {
        return reply.status(400).send({ error: 'profileId and type are required' });
      }

      await fastify.verifyPartnerAccess(request, profileId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      try {
        if (type === 'promoter') {
          const doc = await fastify.db.collection('promoters').doc(profileId).get();
          if (!doc.exists) {
            return { profile: { id: profileId } };
          }
          const raw = { id: doc.id, ...doc.data() };
          const fallback = await getPartnerProfileWithPii(fastify.db, {
            viewerRole: 'promoter',
            viewerId: profileId,
            partnerId: profileId,
          });
          const profile = {
            ...fallback?.profile,
            ...raw,
            displayName: (raw as any).displayName || fallback?.profile?.name || '',
            bio: (raw as any).bio || fallback?.profile?.bio || '',
            contactEmail: (raw as any).contactEmail || (fallback?.profile as any)?.email || '',
            contactPhone: (raw as any).contactPhone || (fallback?.profile as any)?.phone || '',
            website: (raw as any).website || fallback?.profile?.website || '',
            socialLinks: {
              ...(fallback?.profile?.socialLinks || {}),
              ...((raw as any).socialLinks || {}),
            },
          };
          const enriched = await enrichPromoterProfileWithSignedUrls(profile);
          return { profile: enriched };
        }

        if (type === 'host') {
          const doc = await fastify.db.collection('hosts').doc(profileId).get();
          if (!doc.exists) {
            return reply.status(404).send({ error: 'Host not found' });
          }
          const profile = { id: doc.id, ...doc.data() };
          const enriched = await enrichHostProfileWithSignedUrls(profile);

          let statsObj = { followersCount: 0, postsCount: 0, totalLikes: 0, totalViews: 0 };
          if (stats === 'true') {
            const summaryDoc = await fastify.db
              .collection('host_summary')
              .doc(profileId)
              .get()
              .catch(() => null);
            if (summaryDoc && summaryDoc.exists) {
              const summaryData = summaryDoc.data();
              statsObj = {
                followersCount: summaryData?.followersCount || 0,
                postsCount: summaryData?.postsCount || 0,
                totalLikes: summaryData?.totalLikes || 0,
                totalViews: summaryData?.totalViews || 0,
              };
            }
          }

          const [posts, highlights] = await Promise.all([
            fastify.profileService.getPosts(profileId, 'host', 20).catch(() => []),
            fastify.profileService.getHighlights(profileId, 'host').catch(() => []),
          ]);

          return {
            profile: enriched,
            stats: statsObj,
            posts,
            highlights,
          };
        }

        if (type === 'venue') {
          const doc = await fastify.db.collection('venues').doc(profileId).get();
          if (!doc.exists) {
            return reply.status(404).send({ error: 'Venue not found' });
          }
          const profile = { id: doc.id, ...doc.data() };
          const enriched = await enrichVenueProfileWithSignedUrls(profile);

          let statsObj = { followersCount: 0, postsCount: 0, totalLikes: 0, totalViews: 0 };
          if (stats === 'true') {
            const summaryDoc = await fastify.db
              .collection('venue_summary')
              .doc(profileId)
              .get()
              .catch(() => null);
            if (summaryDoc && summaryDoc.exists) {
              const summaryData = summaryDoc.data();
              statsObj = {
                followersCount: summaryData?.followersCount || 0,
                postsCount: 0,
                totalLikes: summaryData?.totalLikes || 0,
                totalViews: summaryData?.totalViews || 0,
              };
            }
          }

          const [posts, highlights] = await Promise.all([
            fastify.profileService.getPosts(profileId, 'venue', 20).catch(() => []),
            fastify.profileService.getHighlights(profileId, 'venue').catch(() => []),
          ]);

          return {
            profile: enriched,
            stats: statsObj,
            posts,
            highlights,
          };
        }

        return reply.status(400).send({ error: `Unsupported profile type: ${type}` });
      } catch (error: any) {
        fastify.log.error(`Error in GET /profile: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  fastify.post(
    '/profile',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [
        async (request) => {
          if ((fastify as any).requireAuth) await (fastify as any).requireAuth(request);
        },
      ],
    },
    async (request: any, reply) => {
      const { profileId, type, action, data } = request.body || {};
      if (!profileId || !type || !action) {
        return reply.status(400).send({ error: 'profileId, type, and action are required' });
      }

      await fastify.verifyPartnerAccess(request, profileId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      try {
        if (action === 'updateProfile') {
          const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
          if (type === 'promoter') {
            const cleanedData = cleanPromoterProfilePatch(data);
            for (const field of ALLOWED_PROMOTER_PROFILE_FIELDS) {
              if (cleanedData[field] !== undefined) patch[field] = cleanedData[field];
            }
            if (patch.displayName && patch.name === undefined) patch.name = patch.displayName;
            await fastify.db.collection('promoters').doc(profileId).set(patch, { merge: true });
          } else if (type === 'host') {
            const cleanedData = cleanHostProfilePatch(data);
            for (const field of ALLOWED_HOST_PROFILE_FIELDS) {
              if (cleanedData[field] !== undefined) patch[field] = cleanedData[field];
            }
            await fastify.db.collection('hosts').doc(profileId).update(patch);
            await fastify.publicDiscoveryService.syncHostReadModels(profileId).catch(() => {});
            await fastify.invalidatePublicDiscovery('all').catch(() => {});
          } else if (type === 'venue') {
            const cleanedData = cleanVenueProfilePatch(data);
            for (const field of ALLOWED_VENUE_PROFILE_FIELDS) {
              if (cleanedData[field] !== undefined) patch[field] = cleanedData[field];
            }
            await fastify.db.collection('venues').doc(profileId).update(patch);
            await fastify.publicDiscoveryService.syncVenueReadModels(profileId).catch(() => {});
            await fastify.invalidatePublicDiscovery('all').catch(() => {});
          } else {
            return reply.status(400).send({ error: `Unsupported profile type: ${type}` });
          }
          return { success: true };
        }

        if (action === 'createPost') {
          const newPost = {
            profileId,
            profileType: type,
            content: data.content || '',
            imageUrl: data.imageUrl || '',
            likes: 0,
            views: 0,
            authorUid: request.user?.uid || '',
            authorName: request.user?.displayName || '',
            createdAt: new Date().toISOString(),
          };
          const docRef = await fastify.db.collection('profile_posts').add(newPost);
          return { success: true, id: docRef.id };
        }

        if (action === 'deletePost') {
          const postRef = fastify.db.collection('profile_posts').doc(data.postId);
          const postDoc = await postRef.get();
          if (!postDoc.exists) return reply.status(404).send({ error: 'Post not found' });
          const postData = postDoc.data();
          if (!postData || postData.profileId !== profileId)
            return reply.status(403).send({ error: 'Forbidden' });
          await postRef.delete();
          return { success: true };
        }

        if (action === 'createHighlight') {
          const newHighlight = {
            profileId,
            profileType: type,
            title: data.title || '',
            color: data.color || '#4F46E5',
            authorUid: request.user?.uid || '',
            createdAt: new Date().toISOString(),
          };
          const docRef = await fastify.db.collection('profile_highlights').add(newHighlight);
          return { success: true, id: docRef.id };
        }

        if (action === 'deleteHighlight') {
          const highlightRef = fastify.db.collection('profile_highlights').doc(data.highlightId);
          const highlightDoc = await highlightRef.get();
          if (!highlightDoc.exists) return reply.status(404).send({ error: 'Highlight not found' });
          const highlightData = highlightDoc.data();
          if (!highlightData || highlightData.profileId !== profileId)
            return reply.status(403).send({ error: 'Forbidden' });
          await highlightRef.delete();
          return { success: true };
        }

        if (action === 'addPhoto') {
          const updateField =
            data.field === 'coverURL'
              ? 'coverURL'
              : data.field === 'photoURL'
                ? 'photoURL'
                : data.field;
          await fastify.db
            .collection(type === 'host' ? 'hosts' : 'venues')
            .doc(profileId)
            .update({
              [updateField]: data.url,
              updatedAt: new Date().toISOString(),
            });
          if (type === 'host') {
            await fastify.publicDiscoveryService.syncHostReadModels(profileId).catch(() => {});
          } else if (type === 'venue') {
            await fastify.publicDiscoveryService.syncVenueReadModels(profileId).catch(() => {});
          }
          await fastify.invalidatePublicDiscovery('all').catch(() => {});
          return { success: true };
        }

        return reply.status(400).send({ error: `Unsupported action: ${action}` });
      } catch (error: any) {
        fastify.log.error(`Error in POST /profile: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * GET /api/v1/profiles/:id
   */
  fastify.get(
    '/profiles/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: ProfileIdParam, querystring: ProfileTypeQuery })],
    },
    async (request: any, reply) => {
      const { id } = request.params;
      const { type = 'user' } = request.query;

      try {
        const viewerId = request.user?.uid;
        const data = await fastify.profileService.getPublicProfile(
          id,
          type as any,
          viewerId,
          fastify.matchingService,
        );
        if (!data) return reply.status(404).send({ error: 'Profile not found' });
        return { id, ...data };
      } catch (error: any) {
        fastify.log.error(`Error in GET /profiles/:id: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * Intent-Specific Mutation Helpers
   */
  const handleUpdate = async (request: any, reply: any, schema: z.ZodObject<any>, updates: any) => {
    const userId = request.user?.uid;

    const parsed = schema.safeParse(updates);
    if (!parsed.success)
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'Invalid fields',
          details: parsed.error.format(),
          requestId: request.id,
        }),
      );

    const existingDoc = await fastify.db.collection('users').doc(userId).get();
    const result = buildGuestProfileUpdates(
      parsed.data,
      existingDoc.exists ? existingDoc.data() || {} : {},
    );

    if (result.error)
      return reply.status(result.statusCode || 400).send(
        buildErrorResponse({
          code: 'UPDATE_FAILED',
          message: result.error,
          requestId: request.id,
        }),
      );

    await fastify.profileService.updateProfile(userId, 'user', result.safeUpdates);
    return { success: true };
  };

  fastify.patch('/profiles/personal', async (request, reply) =>
    handleUpdate(request, reply, PersonalUpdateSchema, request.body),
  );
  fastify.patch('/profiles/social', async (request, reply) =>
    handleUpdate(request, reply, SocialUpdateSchema, request.body),
  );
  fastify.patch('/profiles/bio', async (request, reply) =>
    handleUpdate(request, reply, BioUpdateSchema, request.body),
  );
  fastify.patch('/profiles/avatar', async (request, reply) =>
    handleUpdate(request, reply, AvatarUpdateSchema, request.body),
  );

  fastify.patch(
    '/profiles',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [
        async (request) => {
          if ((fastify as any).requireAuth) await (fastify as any).requireAuth(request);
        },
        fastify.validate({ body: UnifiedProfileUpdateSchema }),
      ],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      const { type = 'user', updates, id: targetId } = request.body || {};
      const actualId = type === 'user' ? userId : targetId;

      if (!actualId) {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'ID required for this update type',
            requestId: request.id,
          }),
        );
      }

      try {
        if (type !== 'user') {
          try {
            await fastify.verifyPartnerAccess(request, actualId);
          } catch {
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Forbidden: Insufficient access to this resource',
                requestId: request.id,
              }),
            );
          }
        }

        let safeUpdates: Record<string, any>;
        if (type === 'user') {
          const existingDoc = await fastify.db.collection('users').doc(actualId).get();
          const rawUpdates = updates || request.body || {};
          const result = buildGuestProfileUpdates(
            rawUpdates,
            existingDoc.exists ? existingDoc.data() || {} : {},
          );

          if (result.error) {
            const code = result.statusCode === 429 ? 'PROFILE_UPDATE_COOLDOWN' : 'UPDATE_FAILED';
            return reply
              .status(result.statusCode || 400)
              .send(buildErrorResponse({ code, message: result.error, requestId: request.id }));
          }
          safeUpdates = result.safeUpdates;
        } else {
          // Partner/Venue updates bypass guest-specific logic but should still be filtered
          safeUpdates = updates || {};
          if (type === 'host') {
            safeUpdates = cleanHostProfilePatch(safeUpdates);
          } else if (type === 'promoter') {
            safeUpdates = cleanPromoterProfilePatch(safeUpdates);
          } else if (type === 'venue') {
            safeUpdates = cleanVenueProfilePatch(safeUpdates);
          }
        }

        await fastify.profileService.updateProfile(actualId, type as any, safeUpdates);

        if (type === 'user') {
          const updatedDoc = await fastify.db.collection('users').doc(actualId).get();
          return buildSuccessResponse({
            profile: normalizeGuestProfile(
              updatedDoc.exists ? updatedDoc.data() || {} : {},
              request.user || {},
            ),
          });
        }

        return { success: true };
      } catch (error: any) {
        fastify.log.error(`Error in PATCH /profiles: ${error.message}`);
        return reply.status(error.statusCode || 500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: error.message || 'Internal Server Error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get('/profiles/:id/posts', async (request: any, reply) => {
    const { id } = request.params;
    const { type = 'venue', limit = 20 } = request.query;
    return await fastify.profileService.getPosts(id, type as string, Number(limit));
  });

  fastify.post(
    '/users/profile',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: UserProfileCreateBody })],
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

      const body = request.body as any;
      if (body.uid && body.uid !== userId)
        return reply
          .status(403)
          .send(
            buildErrorResponse({ code: 'FORBIDDEN', message: 'Forbidden', requestId: request.id }),
          );

      const now = new Date().toISOString();
      const profileDoc = buildGuestProfileCreatePayload(body, request.user, now);
      await fastify.profileService.createProfile(profileDoc);
      return {
        success: true,
        uid: profileDoc.uid,
        profile: normalizeGuestProfile(profileDoc, request.user),
      };
    },
  );
}
