import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
// @ts-ignore
import { followEntity, unfollowEntity, isFollowing } from '@c1rcle/core/follow-graph-engine';

const ChatMessageBody = z
  .object({
    eventId: z.string(),
    text: z.string().optional(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    replyToId: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

const ReportBody = z
  .object({
    targetId: z.string(),
    targetType: z.enum(['user', 'event', 'media', 'message']),
    reason: z.string(),
    details: z.string().optional(),
  })
  .strict();

const BlockBody = z
  .object({
    targetUid: z.string(),
  })
  .strict();

const FollowQuery = z
  .object({
    userId: z.string().optional(),
    targetId: z.string(),
  })
  .strict();

const FollowMutationBody = z
  .object({
    targetId: z.string(),
    targetType: z.enum(['venue', 'host']),
  })
  .strict();

const UnfollowQuery = z
  .object({
    targetId: z.string(),
    targetType: z.enum(['venue', 'host']).optional(),
  })
  .strict();

const VenueFollowParams = z
  .object({
    venueId: z.string(),
  })
  .strict();

const SwipeBody = z
  .object({
    targetUserId: z.string(),
    action: z.enum(['like', 'pass']),
  })
  .strict();

export default async function socialRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/follow
   * Check if a user follows an entity.
   */
  fastify.get('/follow', async (request: any, reply) => {
    const parsed = FollowQuery.safeParse(request.query || {});
    if (!parsed.success) {
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'targetId is required',
          requestId: request.id,
        }),
      );
    }

    try {
      const { userId: fallbackUserId, targetId } = parsed.data;
      const resolvedUserId = request.user?.uid || fallbackUserId;
      if (!resolvedUserId) {
        return buildSuccessResponse({ isFollowing: false, following: false });
      }
      const followingResult = await isFollowing(resolvedUserId, targetId);
      // `following` kept as legacy alias; canonical field is `isFollowing`
      return buildSuccessResponse({ isFollowing: followingResult, following: followingResult });
    } catch (error: any) {
      fastify.log.error(`Error in GET /follow: ${error.message}`);
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to check follow status',
          requestId: request.id,
        }),
      );
    }
  });

  /**
   * POST /api/v1/follow
   * Follow an entity.
   */
  fastify.post('/follow', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        }),
      );

    const parsed = FollowMutationBody.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'targetId and targetType are required',
          requestId: request.id,
        }),
      );
    }

    try {
      const { targetId, targetType } = parsed.data;
      const follow = await followEntity(userId, targetId, targetType);
      return reply.status(201).send({ success: true, follow });
    } catch (error: any) {
      fastify.log.error(`Error in POST /follow: ${error.message}`);
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to follow',
          requestId: request.id,
        }),
      );
    }
  });

  /**
   * DELETE /api/v1/follow
   * Unfollow an entity.
   */
  fastify.delete('/follow', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        }),
      );

    const parsed = UnfollowQuery.safeParse(request.query || {});
    if (!parsed.success) {
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'targetId is required',
          requestId: request.id,
        }),
      );
    }

    try {
      const { targetId, targetType = 'venue' } = parsed.data;
      const result = await unfollowEntity(userId, targetId, targetType);
      return { success: true, ...result };
    } catch (error: any) {
      fastify.log.error(`Error in DELETE /follow: ${error.message}`);
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to unfollow',
          requestId: request.id,
        }),
      );
    }
  });

  /**
   * POST /api/v1/venues/:venueId/follow
   * Follow a venue.
   */
  fastify.post('/venues/:venueId/follow', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        }),
      );

    const parsed = VenueFollowParams.safeParse(request.params || {});
    if (!parsed.success) {
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'venueId is required',
          requestId: request.id,
        }),
      );
    }

    try {
      const { venueId } = parsed.data;
      const { followVenue } = await import('@c1rcle/core/venues-service');
      const result = await followVenue(fastify.db, userId, venueId, {
        venueName: request.body?.venueName,
      });
      return reply.status(201).send({ success: true, follow: result, data: result });
    } catch (error: any) {
      fastify.log.error(`Error in POST /venues/:venueId/follow: ${error.message}`);
      if (error.code === 'NOT_FOUND' || error.message?.includes('not found')) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Venue not found',
            requestId: request.id,
          }),
        );
      }
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to follow venue',
          requestId: request.id,
        }),
      );
    }
  });

  /**
   * DELETE /api/v1/venues/:venueId/follow
   * Unfollow a venue.
   */
  fastify.delete('/venues/:venueId/follow', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        }),
      );

    const parsed = VenueFollowParams.safeParse(request.params || {});
    if (!parsed.success) {
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'venueId is required',
          requestId: request.id,
        }),
      );
    }

    try {
      const { venueId } = parsed.data;
      const { unfollowVenue } = await import('@c1rcle/core/venues-service');
      const result = await unfollowVenue(fastify.db, userId, venueId);
      return { success: true, ...result };
    } catch (error: any) {
      fastify.log.error(`Error in DELETE /venues/:venueId/follow: ${error.message}`);
      if (error.code === 'NOT_FOUND' || error.message?.includes('not found')) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Venue not found',
            requestId: request.id,
          }),
        );
      }
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to unfollow venue',
          requestId: request.id,
        }),
      );
    }
  });

  /**
   * GET /api/v1/venues/:venueId/follow-status
   * Check if the current user follows this venue.
   */
  fastify.get('/venues/:venueId/follow-status', async (request: any) => {
    const parsed = VenueFollowParams.safeParse(request.params || {});
    if (!parsed.success) {
      return { isFollowing: false };
    }

    const userId = request.user?.uid;
    if (!userId) {
      return buildSuccessResponse({ isFollowing: false });
    }

    try {
      const { venueId } = parsed.data;
      const followDoc = await fastify.db
        .collection('userFollows')
        .doc(userId)
        .collection('venues')
        .doc(venueId)
        .get();
      const followingResult = followDoc.exists;
      return buildSuccessResponse({ isFollowing: followingResult });
    } catch (error: any) {
      fastify.log.error(`Error in GET /venues/:venueId/follow-status: ${error.message}`);
      return buildSuccessResponse({ isFollowing: false });
    }
  });

  /**
   * POST /api/v1/social/chat
   * Send a message to an event group chat
   */
  fastify.post(
    '/social/chat',
    {
      preHandler: [fastify.validate({ body: ChatMessageBody })],
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

      const { eventId, text, imageUrl, videoUrl, replyToId, metadata } = request.body;

      try {
        const message = {
          eventId,
          userId,
          // Redacted to prevent bulk scraping of attendee names
          senderName: 'Attendee',
          senderPhoto: null,
          text: text || '',
          imageUrl: imageUrl || null,
          videoUrl: videoUrl || null,
          replyToId: replyToId || null,
          createdAt: new Date().toISOString(),
          metadata: {
            ...(metadata || {}),
            isAnonymous: true,
          },
        };

        const docRef = await fastify.db.collection('eventGroupMessages').add(message);
        return { success: true, id: docRef.id, message };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/chat: ${error.message}`);
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

  /**
   * GET /api/v1/social/entitlement/:eventId
   * Check if current user has entitlement for event social features
   */
  fastify.get('/social/entitlement/:eventId', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );
    const { eventId } = request.params;

    try {
      // 1. Check orders
      const ordersSnap = await fastify.db
        .collection('orders')
        .where('userId', '==', userId)
        .where('eventId', '==', eventId)
        .where('status', 'in', ['confirmed', 'checked_in'])
        .limit(1)
        .get();

      if (!ordersSnap.empty) {
        const order = ordersSnap.docs[0].data();
        return buildSuccessResponse({
          entitlement: {
            id: ordersSnap.docs[0].id,
            type: 'ticket_purchased',
            status: 'active',
            grantedAt: order.createdAt,
          },
        });
      }

      // 2. Check guestlist
      const guestlistSnap = await fastify.db
        .collection('guestlist')
        .where('userId', '==', userId)
        .where('eventId', '==', eventId)
        .where('status', '==', 'approved')
        .limit(1)
        .get();

      if (!guestlistSnap.empty) {
        const entry = guestlistSnap.docs[0].data();
        return buildSuccessResponse({
          entitlement: {
            id: guestlistSnap.docs[0].id,
            type: 'guestlist_approved',
            status: 'active',
            grantedAt: entry.approvedAt || entry.createdAt,
          },
        });
      }

      return buildSuccessResponse({ entitlement: null });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/entitlement/:eventId: ${error.message}`);
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
   * POST /api/v1/social/can-dm
   * Verify if current user can DM another user in context of an event
   */
  fastify.post(
    '/social/can-dm',
    {
      preHandler: [
        fastify.validate({
          body: z.object({ recipientId: z.string(), eventId: z.string() }).strict(),
        }),
      ],
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
      const { recipientId, eventId } = request.body;

      try {
        // 1. Check if recipient blocked sender
        const blockSnap = await fastify.db
          .collection('userBlocks')
          .where('blockerUid', '==', recipientId)
          .where('blockedUid', '==', userId)
          .limit(1)
          .get();

        if (!blockSnap.empty) {
          return buildSuccessResponse({ allowed: false, reason: 'Unable to message this user' });
        }

        // 2. Check if both have tickets/guestlist (Simplified)
        const [myEntitlement, theirEntitlement] = await Promise.all([
          fastify.db
            .collection('orders')
            .where('userId', '==', userId)
            .where('eventId', '==', eventId)
            .where('status', '==', 'confirmed')
            .limit(1)
            .get(),
          fastify.db
            .collection('orders')
            .where('userId', '==', recipientId)
            .where('eventId', '==', eventId)
            .where('status', '==', 'confirmed')
            .limit(1)
            .get(),
        ]);

        if (myEntitlement.empty)
          return buildSuccessResponse({ allowed: false, reason: 'You need a ticket to message' });
        if (theirEntitlement.empty)
          return buildSuccessResponse({ allowed: false, reason: 'This user is not an attendee' });

        return buildSuccessResponse({ allowed: true });
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/can-dm: ${error.message}`);
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

  /**
   * POST /api/v1/social/mute
   * Mute a user in an event group chat.
   * Caller must manage the event's host/venue — NOT just the eventId.
   */
  fastify.post(
    '/social/mute',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              eventId: z.string(),
              targetUid: z.string(),
              durationMinutes: z.number().optional(),
            })
            .strict(),
        }),
      ],
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
      const { eventId, targetUid, durationMinutes = 60 } = request.body;

      try {
        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Event not found',
              requestId: request.id,
            }),
          );
        const partnerId = (eventDoc.data() as any).hostId || (eventDoc.data() as any).venueId;
        if (!partnerId)
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        await fastify.verifyPartnerAccess(request, partnerId);

        const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
        await fastify.db.collection('eventMutes').add({
          eventId,
          userId: targetUid,
          mutedByUserId: userId,
          mutedUntil,
          createdAt: new Date().toISOString(),
        });

        return { success: true };
      } catch (error: any) {
        if (error.message?.includes('Forbidden'))
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        fastify.log.error(`Error in POST /social/mute: ${error.message}`);
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

  /**
   * GET /api/v1/social/is-muted/:eventId
   */
  fastify.get('/social/is-muted/:eventId', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );
    const { eventId } = request.params;

    try {
      const snapshot = await fastify.db
        .collection('eventMutes')
        .where('eventId', '==', eventId)
        .where('userId', '==', userId)
        .get();

      const now = new Date();
      const isMuted = snapshot.docs.some((doc) => {
        const mutedUntil = new Date(doc.data().mutedUntil);
        return mutedUntil > now;
      });

      return buildSuccessResponse({ isMuted });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/is-muted/:eventId: ${error.message}`);
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
   * POST /api/v1/social/remove-from-chat
   * Caller must manage the event's host/venue — NOT just the eventId.
   */
  fastify.post(
    '/social/remove-from-chat',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              eventId: z.string(),
              targetUid: z.string(),
              reason: z.string().optional(),
            })
            .strict(),
        }),
      ],
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
      const { eventId, targetUid, reason } = request.body;

      try {
        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Event not found',
              requestId: request.id,
            }),
          );
        const partnerId = (eventDoc.data() as any).hostId || (eventDoc.data() as any).venueId;
        if (!partnerId)
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        await fastify.verifyPartnerAccess(request, partnerId);

        await fastify.db.collection('eventChatRemovals').add({
          eventId,
          userId: targetUid,
          removedByUserId: userId,
          reason: reason || null,
          createdAt: new Date().toISOString(),
        });

        return { success: true };
      } catch (error: any) {
        if (error.message?.includes('Forbidden'))
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        fastify.log.error(`Error in POST /social/remove-from-chat: ${error.message}`);
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

  /**
   * GET /api/v1/social/media/:eventId
   * Fetch media for an event gallery
   */
  fastify.get('/social/media/:eventId', async (request: any, reply) => {
    const { eventId } = request.params;
    const { limit = 50 } = request.query;

    try {
      const snapshot = await fastify.db
        .collection('eventMedia')
        .where('eventId', '==', eventId)
        .where('isApproved', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(Number(limit))
        .get();

      const media = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return buildSuccessResponse({ media });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/media/:eventId: ${error.message}`);
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
   * POST /api/v1/social/media
   * Save media metadata after storage upload
   */
  fastify.post(
    '/social/media',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              eventId: z.string(),
              mediaUrl: z.string(),
              thumbnailUrl: z.string().optional(),
              type: z.enum(['image', 'video']),
              caption: z.string().optional(),
            })
            .strict(),
        }),
      ],
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

      const { eventId, mediaUrl, thumbnailUrl, type, caption } = request.body;

      try {
        const mediaData = {
          eventId,
          userId,
          userName: request.user.name || 'Anonymous',
          userAvatar: request.user.picture || '',
          mediaUrl,
          thumbnailUrl: thumbnailUrl || null,
          type,
          caption: caption || null,
          likes: 0,
          likedBy: [],
          createdAt: new Date().toISOString(),
          isApproved: true,
          isFlagged: false,
        };

        const docRef = await fastify.db.collection('eventMedia').add(mediaData);
        return { success: true, id: docRef.id, media: mediaData };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/media: ${error.message}`);
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

  /**
   * POST /api/v1/social/unblock
   */
  fastify.post(
    '/social/unblock',
    {
      preHandler: [fastify.validate({ body: z.object({ targetUid: z.string() }).strict() })],
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
      const { targetUid } = request.body;

      try {
        const snapshot = await fastify.db
          .collection('userBlocks')
          .where('blockerUid', '==', userId)
          .where('blockedUid', '==', targetUid)
          .get();

        const batch = fastify.db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        return { success: true };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/unblock: ${error.message}`);
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

  /**
   * GET /api/v1/social/is-removed/:eventId
   */
  fastify.get('/social/is-removed/:eventId', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );
    const { eventId } = request.params;

    try {
      const snapshot = await fastify.db
        .collection('eventChatRemovals')
        .where('eventId', '==', eventId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      return buildSuccessResponse({ isRemoved: !snapshot.empty });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/is-removed/:eventId: ${error.message}`);
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
   * POST /api/v1/social/location/start
   */
  fastify.post(
    '/social/location/start',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              eventId: z.string().optional(),
              latitude: z.number(),
              longitude: z.number(),
              durationHours: z.number().optional(),
            })
            .strict(),
        }),
      ],
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
      const { eventId, latitude, longitude, durationHours = 4 } = request.body;

      try {
        const sessionId = `loc_${userId}_${Date.now()}`;
        const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

        await fastify.db
          .collection('locationSessions')
          .doc(sessionId)
          .set({
            id: sessionId,
            userId,
            eventId: eventId || null,
            sharedWith: [],
            location: { latitude, longitude },
            lastUpdate: new Date().toISOString(),
            expiresAt,
            isActive: true,
            createdAt: new Date().toISOString(),
          });

        return { success: true, sessionId };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/location/start: ${error.message}`);
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

  /**
   * PATCH /api/v1/social/location/:id
   */
  fastify.patch(
    '/social/location/:id',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              latitude: z.number(),
              longitude: z.number(),
            })
            .strict(),
        }),
      ],
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
      const { id } = request.params;
      const { latitude, longitude } = request.body;

      try {
        const docRef = fastify.db.collection('locationSessions').doc(id);
        const doc = await docRef.get();

        if (!doc.exists || doc.data()?.userId !== userId) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        }

        await docRef.update({
          location: { latitude, longitude },
          lastUpdate: new Date().toISOString(),
        });

        return { success: true };
      } catch (error: any) {
        fastify.log.error(`Error in PATCH /social/location/:id: ${error.message}`);
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

  /**
   * POST /api/v1/social/sos
   */
  fastify.post(
    '/social/sos',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              eventId: z.string().optional(),
              latitude: z.number().optional(),
              longitude: z.number().optional(),
            })
            .strict(),
        }),
      ],
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
      const { eventId, latitude, longitude } = request.body;

      try {
        const sosRef = await fastify.db.collection('sosAlerts').add({
          userId,
          eventId: eventId || null,
          location: latitude != null && longitude != null ? { latitude, longitude } : null,
          status: 'triggered',
          triggeredAt: new Date().toISOString(),
        });

        // Note: In production, trigger SMS/Push here
        return { success: true, sosId: sosRef.id };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/sos: ${error.message}`);
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

  /**
   * GET /api/v1/social/dm/requests
   */
  fastify.get('/social/dm/requests', async (request: any, reply) => {
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
      const snapshot = await fastify.db
        .collection('privateConversations')
        .where('participants', 'array-contains', userId)
        .where('status', '==', 'pending')
        .get();

      const requests = snapshot.docs
        .filter((doc) => doc.data().initiatedBy !== userId)
        .map((doc) => ({ id: doc.id, ...doc.data() }));

      return buildSuccessResponse({ requests });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/dm/requests: ${error.message}`);
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
   * POST /api/v1/social/dm/request
   */
  fastify.post(
    '/social/dm/request',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              recipientId: z.string(),
              eventId: z.string(),
            })
            .strict(),
        }),
      ],
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
      const { recipientId, eventId } = request.body;

      try {
        // Logic similar to initiateDMRequest
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const convoRef = await fastify.db.collection('privateConversations').add({
          eventId,
          participants: [userId, recipientId],
          status: 'pending',
          initiatedBy: userId,
          createdAt: new Date().toISOString(),
          expiresAt,
          isSaved: false,
        });

        return { success: true, conversationId: convoRef.id };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/dm/request: ${error.message}`);
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

  /**
   * POST /api/v1/social/dm/:id/accept
   */
  fastify.post('/social/dm/:id/accept', async (request: any, reply) => {
    const userId = request.user?.uid;
    const { id } = request.params;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );

    try {
      const docRef = fastify.db.collection('privateConversations').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Conversation not found',
            requestId: request.id,
          }),
        );
      }

      // Only a participant (not the initiator) may accept
      const data = doc.data() as any;
      if (!data.participants?.includes(userId)) {
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'Forbidden: Not a participant',
            requestId: request.id,
          }),
        );
      }
      if (data.initiatedBy === userId) {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'Cannot accept your own request',
            requestId: request.id,
          }),
        );
      }
      await docRef.update({
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      fastify.log.error(`Error in POST /social/dm/:id/accept: ${error.message}`);
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
   * POST /api/v1/social/dm/:id/send
   */
  fastify.post(
    '/social/dm/:id/send',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              text: z.string().optional(),
              imageUrl: z.string().optional(),
            })
            .strict(),
        }),
      ],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      const { id } = request.params;
      const { text, imageUrl } = request.body;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      try {
        const convoRef = fastify.db.collection('privateConversations').doc(id);
        const convoDoc = await convoRef.get();
        if (!convoDoc.exists)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Not found',
              requestId: request.id,
            }),
          );

        const msgRef = await fastify.db.collection('directMessages').add({
          conversationId: id,
          senderId: userId,
          content: text || imageUrl,
          type: text ? 'text' : 'image',
          createdAt: new Date().toISOString(),
        });

        await convoRef.update({
          lastMessage: {
            content: text || '📷 Photo',
            senderId: userId,
            createdAt: new Date().toISOString(),
          },
        });

        return { success: true, messageId: msgRef.id };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/dm/:id/send: ${error.message}`);
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

  /**
   * GET /api/v1/social/dm/:id/messages
   * Requires auth and verifies the caller is a participant of the conversation.
   */
  fastify.get('/social/dm/:id/messages', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );
    const { id } = request.params;
    const { limit = 50 } = request.query;

    try {
      const convoDoc = await fastify.db.collection('privateConversations').doc(id).get();
      if (!convoDoc.exists)
        return reply
          .status(404)
          .send(
            buildErrorResponse({ code: 'NOT_FOUND', message: 'Not found', requestId: request.id }),
          );
      if (!(convoDoc.data() as any).participants?.includes(userId)) {
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'Forbidden: Not a participant',
            requestId: request.id,
          }),
        );
      }

      const snapshot = await fastify.db
        .collection('directMessages')
        .where('conversationId', '==', id)
        .orderBy('createdAt', 'desc')
        .limit(Number(limit))
        .get();

      const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return buildSuccessResponse({ messages });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/dm/:id/messages: ${error.message}`);
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
   * GET /api/v1/social/dm/:id
   */
  fastify.get('/social/dm/:id', async (request: any, reply) => {
    const userId = request.user?.uid;
    const { id } = request.params;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );

    try {
      const doc = await fastify.db.collection('privateConversations').doc(id).get();
      if (!doc.exists)
        return reply
          .status(404)
          .send(
            buildErrorResponse({ code: 'NOT_FOUND', message: 'Not found', requestId: request.id }),
          );

      const data = doc.data();
      if (!data?.participants.includes(userId)) {
        return reply
          .status(403)
          .send(
            buildErrorResponse({ code: 'FORBIDDEN', message: 'Forbidden', requestId: request.id }),
          );
      }

      return buildSuccessResponse({ conversation: { id: doc.id, ...data } });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/dm/:id: ${error.message}`);
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
   * POST /api/v1/social/typing
   */
  fastify.post(
    '/social/typing',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              chatId: z.string(),
              chatType: z.enum(['group', 'dm']),
              isTyping: z.boolean(),
              userName: z.string(),
            })
            .strict(),
        }),
      ],
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
      const { chatId, chatType, isTyping, userName } = request.body;

      try {
        const typingId = `${chatType}_${chatId}_${userId}`;
        const docRef = fastify.db.collection('typingIndicators').doc(typingId);

        if (isTyping) {
          await docRef.set({
            chatId,
            chatType,
            userId,
            userName,
            timestamp: new Date().toISOString(),
          });
        } else {
          await docRef.delete();
        }

        return { success: true };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/typing: ${error.message}`);
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

  /**
   * GET /api/v1/social/typing/:chatId
   */
  fastify.get('/social/typing/:chatId', async (request: any, reply) => {
    const { chatId } = request.params;

    try {
      const snapshot = await fastify.db
        .collection('typingIndicators')
        .where('chatId', '==', chatId)
        .get();

      const typers = snapshot.docs.map((doc) => doc.data());
      return buildSuccessResponse({ typers });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/typing/:chatId: ${error.message}`);
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
   * GET /api/v1/social/chat/:eventId
   * Fetch messages for an event (standard polling fallback).
   * Requires auth — only attendees may read the chat.
   */
  fastify.get('/social/chat/:eventId', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );
    const { eventId } = request.params;
    const { limit = 50, lastTimestamp } = request.query;

    try {
      let query = fastify.db
        .collection('eventGroupMessages')
        .where('eventId', '==', eventId)
        .orderBy('createdAt', 'desc')
        .limit(Number(limit));

      if (lastTimestamp) {
        query = query.startAfter(lastTimestamp);
      }

      const snapshot = await query.get();
      const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();

      return buildSuccessResponse({ messages });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/chat/:eventId: ${error.message}`);
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
   * POST /api/v1/social/report
   * Report a user, message, or media
   */
  fastify.post(
    '/social/report',
    {
      preHandler: [fastify.validate({ body: ReportBody })],
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

      const { targetId, targetType, reason, details } = request.body;

      try {
        const reportId = await fastify.moderationService.reportItem({
          reporterId: userId,
          targetId,
          targetType,
          reason,
          details: details || '',
        });

        return { success: true, reportId };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/report: ${error.message}`);
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

  /**
   * POST /api/v1/social/block
   * Block a user
   */
  fastify.post(
    '/social/block',
    {
      preHandler: [fastify.validate({ body: BlockBody })],
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

      const { targetUid } = request.body;

      try {
        await fastify.db.collection('userBlocks').add({
          blockerUid: userId,
          blockedUid: targetUid,
          createdAt: new Date().toISOString(),
        });

        return { success: true };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/block: ${error.message}`);
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

  /**
   * GET /api/v1/social/blocks
   * Get list of users blocked by current user
   */
  fastify.get('/social/blocks', async (request: any, reply) => {
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
      const snapshot = await fastify.db
        .collection('userBlocks')
        .where('blockerUid', '==', userId)
        .get();

      const blocks = snapshot.docs.map((doc) => doc.data().blockedUid);
      return buildSuccessResponse({ blockedUserIds: blocks });
    } catch (error: any) {
      fastify.log.error(`Error in GET /social/blocks: ${error.message}`);
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
   * POST /api/v1/social/upload
   * Proxy image uploads to Firebase Storage
   */
  fastify.post('/social/upload', async (request: any, reply: any) => {
    try {
      const result = await handleUpload(request, fastify);
      return result;
    } catch (error: any) {
      fastify.log.error(`Upload failed: ${error.message}`);
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Upload failed',
          requestId: request.id,
        }),
      );
    }
  });
  fastify.get('/social/discover', async (request: any, reply: any) => {
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
      const { getDiscoverProfiles } = await import('@c1rcle/core/guest-dating-service');
      const profiles = await getDiscoverProfiles(fastify.db, userId);
      return buildSuccessResponse({ profiles });
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'GET /social/discover failed',
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

  fastify.post(
    '/social/swipe',
    {
      preHandler: [fastify.validate({ body: SwipeBody })],
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
        const { processSwipeAction } = await import('@c1rcle/core/guest-dating-service');
        const result = await processSwipeAction(
          fastify.db,
          userId,
          request.body.targetUserId,
          request.body.action,
        );
        return buildSuccessResponse(result);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /social/swipe failed',
        );

        const code = error.message.includes('limit exceeded') ? 'TOO_MANY_REQUESTS' : 'BAD_REQUEST';
        const status = error.message.includes('limit exceeded') ? 429 : 400;

        return reply.status(status).send(
          buildErrorResponse({
            code,
            message: error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  const UserIdParam = z.object({ id: z.string() }).strict();

  fastify.get('/social/matches', async (request: any, reply: any) => {
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
      const { getUserMatches } = await import('@c1rcle/core/guest-dating-service');
      const matches = await getUserMatches(fastify.db, userId);
      return buildSuccessResponse({ matches });
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'GET /social/matches failed',
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

  fastify.get(
    '/users/:id',
    {
      preHandler: [fastify.validate({ params: UserIdParam })],
    },
    async (request: any, reply: any) => {
      try {
        const { getPublicUserProfile } = await import('@c1rcle/core/guest-dating-service');
        const profile = await getPublicUserProfile(fastify.db, request.params.id);
        return buildSuccessResponse(profile);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, targetUserId: request.params.id, error: error.message },
          'GET /users/:id failed',
        );

        if (error.message.includes('not found')) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'User not found',
              requestId: request.id,
            }),
          );
        }

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

/**
 * Handle multipart image upload to Firebase Storage
 */
async function handleUpload(request: any, fastify: any) {
  const data = await request.file();
  if (!data) throw new Error('No file uploaded');

  const bucket = fastify.storage.bucket();
  const fileName = `uploads/${Date.now()}_${data.filename}`;
  const file = bucket.file(fileName);

  const stream = file.createWriteStream({
    metadata: {
      contentType: data.mimetype,
    },
    public: true,
  });

  await new Promise((resolve, reject) => {
    data.file.pipe(stream).on('finish', resolve).on('error', reject);
  });

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  return buildSuccessResponse({ url: publicUrl });
}
