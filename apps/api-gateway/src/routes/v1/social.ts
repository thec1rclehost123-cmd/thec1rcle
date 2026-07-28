import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import { sendGuestOtp, verifyGuestOtp } from '../../lib/guest-otp';
import { sendSosViaMsg91 } from '../../lib/msg91-sos';
// @ts-ignore
import {
  followGuestEntity,
  isGuestFollowing,
  listGuestFollows,
  unfollowGuestEntity,
} from '@c1rcle/core/guest-follow-service';
// @ts-ignore
import { getChatMessages, sendChatMessage } from '@c1rcle/core/guest-chat-service';

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
    targetType: z.enum(['venue', 'host']).optional(),
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

const HostFollowParams = z
  .object({
    hostId: z.string(),
  })
  .strict();

const SwipeBody = z
  .object({
    targetUserId: z.string(),
    action: z.enum(['like', 'pass']),
  })
  .strict();

const EmergencyContactSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/),
    relationship: z.string().trim().min(1).max(40),
  })
  .strict();

const EmergencyContactsBody = z
  .object({
    contacts: z.array(EmergencyContactSchema).max(5),
  })
  .strict();

const EmergencyContactParams = z.object({ id: z.string().min(1).max(128) }).strict();
const EmergencyContactVerifyBody = z.object({ code: z.string().regex(/^[0-9]{4,8}$/) }).strict();

const SosBody = z
  .object({
    eventId: z.string().max(128).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    idempotencyKey: z.string().uuid(),
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    'latitude and longitude must be supplied together',
  );

const LocationSessionParams = z.object({ id: z.string().min(1).max(128) }).strict();
const LocationUpdateBody = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();
const LocationStartBody = LocationUpdateBody.extend({
  eventId: z.string().max(128).optional(),
  durationHours: z.number().int().min(1).max(12).default(4),
}).strict();
const LocationInviteBody = z.object({ targetUserId: z.string().min(1).max(128) }).strict();
const LocationGrantParams = z
  .object({
    id: z.string().min(1).max(128),
    targetUserId: z.string().min(1).max(128),
  })
  .strict();

async function usersAreBlocked(db: any, leftUserId: string, rightUserId: string) {
  const [left, right] = await Promise.all([
    db
      .collection('userBlocks')
      .where('blockerUid', '==', leftUserId)
      .where('blockedUid', '==', rightUserId)
      .limit(1)
      .get(),
    db
      .collection('userBlocks')
      .where('blockerUid', '==', rightUserId)
      .where('blockedUid', '==', leftUserId)
      .limit(1)
      .get(),
  ]);
  return !left.empty || !right.empty;
}

function emergencyContactId(userId: string, phone: string) {
  return createHash('sha256')
    .update(`emergency-contact:v1:${userId}:${phone.replace(/\D/g, '')}`)
    .digest('hex')
    .slice(0, 40);
}

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
      const { userId: fallbackUserId, targetId, targetType } = parsed.data;
      const resolvedUserId = request.user?.uid || fallbackUserId;
      if (!resolvedUserId) {
        return buildSuccessResponse({ isFollowing: false, following: false });
      }
      const followingResult = targetType
        ? await isGuestFollowing(fastify.db, resolvedUserId, targetType, targetId)
        : (
            await Promise.all([
              isGuestFollowing(fastify.db, resolvedUserId, 'host', targetId),
              isGuestFollowing(fastify.db, resolvedUserId, 'venue', targetId),
            ])
          ).some(Boolean);
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
      const follow = await followGuestEntity(fastify.db, userId, targetType, targetId);
      return reply.status(201).send({ success: true, follow });
    } catch (error: any) {
      fastify.log.error(`Error in POST /follow: ${error.message}`);
      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Follow target not found',
            requestId: request.id,
          }),
        );
      }
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
      const result = await unfollowGuestEntity(fastify.db, userId, targetType, targetId);
      return { success: true, ...result };
    } catch (error: any) {
      fastify.log.error(`Error in DELETE /follow: ${error.message}`);
      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Follow target not found',
            requestId: request.id,
          }),
        );
      }
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
      const result = await followGuestEntity(fastify.db, userId, 'venue', venueId, {
        displayName: request.body?.venueName,
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
      const result = await unfollowGuestEntity(fastify.db, userId, 'venue', venueId);
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
      const followingResult = await isGuestFollowing(fastify.db, userId, 'venue', venueId);
      return buildSuccessResponse({ isFollowing: followingResult });
    } catch (error: any) {
      fastify.log.error(`Error in GET /venues/:venueId/follow-status: ${error.message}`);
      return buildSuccessResponse({ isFollowing: false });
    }
  });

  /**
   * GET /api/v1/users/me/follows
   * Return the authenticated guest's canonical venue and host follow ids.
   */
  fastify.get(
    '/users/me/follows',
    { preHandler: fastify.requireAuth },
    async (request: any, reply) => {
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
        const follows = await listGuestFollows(fastify.db, userId);
        return buildSuccessResponse({ follows });
      } catch (error: any) {
        fastify.log.error(`Error in GET /users/me/follows: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Failed to load follows',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/hosts/:hostId/follow
   * Follow a host through the same canonical bidirectional graph as venues.
   */
  fastify.post('/hosts/:hostId/follow', async (request: any, reply) => {
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
    const parsed = HostFollowParams.safeParse(request.params || {});
    if (!parsed.success) {
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'hostId is required',
          requestId: request.id,
        }),
      );
    }

    try {
      const result = await followGuestEntity(fastify.db, userId, 'host', parsed.data.hostId, {
        displayName: request.body?.hostName,
      });
      return reply.status(201).send({ success: true, follow: result, data: result });
    } catch (error: any) {
      fastify.log.error(`Error in POST /hosts/:hostId/follow: ${error.message}`);
      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Host not found',
            requestId: request.id,
          }),
        );
      }
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Failed to follow host',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.delete('/hosts/:hostId/follow', async (request: any, reply) => {
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
    const parsed = HostFollowParams.safeParse(request.params || {});
    if (!parsed.success) {
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'hostId is required',
          requestId: request.id,
        }),
      );
    }

    try {
      const result = await unfollowGuestEntity(fastify.db, userId, 'host', parsed.data.hostId);
      return { success: true, ...result };
    } catch (error: any) {
      fastify.log.error(`Error in DELETE /hosts/:hostId/follow: ${error.message}`);
      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Host not found',
            requestId: request.id,
          }),
        );
      }
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Failed to unfollow host',
          requestId: request.id,
        }),
      );
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

      const { eventId, text, imageUrl, replyToId } = request.body;

      try {
        const result = await sendChatMessage(fastify.db, userId, eventId, {
          text,
          imageUrl,
          type: imageUrl ? 'image' : 'text',
          metadata: { replyTo: replyToId || null },
        });
        const topic = `event-chat:${result.chat.eventId}`;
        fastify.broadcast(
          {
            type: 'chat:new_message',
            payload: { topic, eventId: result.chat.eventId, message: result.message },
          },
          topic,
        );
        reply.header('Deprecation', 'true');
        reply.header('Sunset', 'Sat, 08 Aug 2026 00:00:00 GMT');
        return { success: true, id: result.message.id, message: result.message };
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

  fastify.get(
    '/social/emergency-contacts',
    { preHandler: [fastify.requireAuth] },
    async (request: any) => {
      const snapshot = await fastify.db
        .collection('emergency_contacts')
        .where('userId', '==', request.user.uid)
        .limit(5)
        .get();
      return buildSuccessResponse({
        contacts: snapshot.docs.map((doc: any) => {
          const contact = doc.data();
          return {
            id: doc.id,
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship,
            status: contact.status,
          };
        }),
      });
    },
  );

  fastify.put(
    '/social/emergency-contacts',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: EmergencyContactsBody })],
    },
    async (request: any) => {
      const userId = request.user.uid;
      const now = new Date().toISOString();
      const incoming = request.body.contacts.map((contact: any) => ({
        ...contact,
        phone: contact.phone.startsWith('+') ? contact.phone : `+91${contact.phone}`,
      }));
      const existing = await fastify.db
        .collection('emergency_contacts')
        .where('userId', '==', userId)
        .limit(5)
        .get();
      const existingById = new Map(existing.docs.map((doc: any) => [doc.id, doc.data()]));
      const desiredIds = new Set<string>();
      const batch = fastify.db.batch();

      for (const contact of incoming) {
        const id = emergencyContactId(userId, contact.phone);
        desiredIds.add(id);
        const previous: any = existingById.get(id);
        batch.set(
          fastify.db.collection('emergency_contacts').doc(id),
          {
            id,
            userId,
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship,
            status: previous?.status === 'verified' ? 'verified' : 'pending_verification',
            verifiedAt: previous?.verifiedAt || null,
            createdAt: previous?.createdAt || now,
            updatedAt: now,
          },
          { merge: true },
        );
      }
      for (const doc of existing.docs) {
        if (!desiredIds.has(doc.id)) batch.delete(doc.ref);
      }
      await batch.commit();
      return buildSuccessResponse({
        contacts: incoming.map((contact: any) => {
          const id = emergencyContactId(userId, contact.phone);
          const previous: any = existingById.get(id);
          return {
            id,
            ...contact,
            status: previous?.status === 'verified' ? 'verified' : 'pending_verification',
          };
        }),
      });
    },
  );

  fastify.post(
    '/social/emergency-contacts/:id/request-verification',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
      preHandler: [fastify.requireAuth, fastify.validate({ params: EmergencyContactParams })],
    },
    async (request: any, reply) => {
      const ref = fastify.db.collection('emergency_contacts').doc(request.params.id);
      const snapshot = await ref.get();
      if (!snapshot.exists || snapshot.data()?.userId !== request.user.uid) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Emergency contact not found',
            requestId: request.id,
          }),
        );
      }
      await sendGuestOtp(fastify.db, 'phone', snapshot.data()!.phone);
      await ref.set(
        { verificationRequestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return buildSuccessResponse({ accepted: true });
    },
  );

  fastify.post(
    '/social/emergency-contacts/:id/verify',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      preHandler: [
        fastify.requireAuth,
        fastify.validate({
          params: EmergencyContactParams,
          body: EmergencyContactVerifyBody,
        }),
      ],
    },
    async (request: any, reply) => {
      const ref = fastify.db.collection('emergency_contacts').doc(request.params.id);
      const snapshot = await ref.get();
      if (!snapshot.exists || snapshot.data()?.userId !== request.user.uid) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Emergency contact not found',
            requestId: request.id,
          }),
        );
      }
      await verifyGuestOtp(fastify.db, 'phone', snapshot.data()!.phone, request.body.code);
      const verifiedAt = new Date().toISOString();
      await ref.update({ status: 'verified', verifiedAt, updatedAt: verifiedAt });
      return buildSuccessResponse({ verified: true, verifiedAt });
    },
  );

  /**
   * POST /api/v1/social/location/start
   */
  fastify.post(
    '/social/location/start',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: LocationStartBody })],
    },
    async (request: any, reply) => {
      const userId = request.user.uid;
      const { eventId, latitude, longitude, durationHours = 4 } = request.body;

      try {
        const sessionId = `loc_${randomUUID()}`;
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

        await fastify.db
          .collection('locationSessions')
          .doc(sessionId)
          .set({
            id: sessionId,
            userId,
            eventId: eventId || null,
            location: { latitude, longitude },
            lastUpdate: now,
            expiresAt,
            isActive: true,
            createdAt: now,
            updatedAt: now,
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
        fastify.requireAuth,
        fastify.validate({
          params: LocationSessionParams,
          body: LocationUpdateBody,
        }),
      ],
    },
    async (request: any, reply) => {
      const userId = request.user.uid;
      const { id } = request.params;
      const { latitude, longitude } = request.body;

      try {
        const docRef = fastify.db.collection('locationSessions').doc(id);
        const doc = await docRef.get();

        const session = doc.data();
        if (!doc.exists || session?.userId !== userId) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Location session not found',
              requestId: request.id,
            }),
          );
        }
        if (!session?.isActive || new Date(session.expiresAt).getTime() <= Date.now()) {
          return reply.status(409).send(
            buildErrorResponse({
              code: 'LOCATION_SESSION_INACTIVE',
              message: 'Location session has ended',
              requestId: request.id,
            }),
          );
        }

        await docRef.update({
          location: { latitude, longitude },
          lastUpdate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

  fastify.post(
    '/social/location/:id/invites',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({
          params: LocationSessionParams,
          body: LocationInviteBody,
        }),
      ],
    },
    async (request: any, reply) => {
      const ownerUserId = request.user.uid;
      const targetUserId = request.body.targetUserId;
      if (targetUserId === ownerUserId) {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'Cannot share location with yourself',
            requestId: request.id,
          }),
        );
      }
      const sessionRef = fastify.db.collection('locationSessions').doc(request.params.id);
      const [sessionSnapshot, targetSnapshot, blocked] = await Promise.all([
        sessionRef.get(),
        fastify.db.collection('users').doc(targetUserId).get(),
        usersAreBlocked(fastify.db, ownerUserId, targetUserId),
      ]);
      const session = sessionSnapshot.data();
      if (
        !sessionSnapshot.exists ||
        session?.userId !== ownerUserId ||
        !session?.isActive ||
        new Date(session.expiresAt).getTime() <= Date.now()
      ) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Location session not found',
            requestId: request.id,
          }),
        );
      }
      if (!targetSnapshot.exists || blocked) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Recipient not found',
            requestId: request.id,
          }),
        );
      }
      const grantId = `${request.params.id}_${targetUserId}`;
      const now = new Date().toISOString();
      await fastify.db.collection('location_sharing_grants').doc(grantId).set(
        {
          id: grantId,
          sessionId: request.params.id,
          ownerUserId,
          targetUserId,
          status: 'invited',
          expiresAt: session.expiresAt,
          invitedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
      return buildSuccessResponse({ grantId, status: 'invited' });
    },
  );

  fastify.post(
    '/social/location/invites/:id/accept',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: LocationSessionParams })],
    },
    async (request: any, reply) => {
      const grantRef = fastify.db.collection('location_sharing_grants').doc(request.params.id);
      const grantSnapshot = await grantRef.get();
      const grant = grantSnapshot.data();
      if (!grantSnapshot.exists || !grant || grant.targetUserId !== request.user.uid) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Location invitation not found',
            requestId: request.id,
          }),
        );
      }
      const sessionSnapshot = await fastify.db
        .collection('locationSessions')
        .doc(grant.sessionId)
        .get();
      const session = sessionSnapshot.data();
      if (
        !sessionSnapshot.exists ||
        !session?.isActive ||
        new Date(session.expiresAt).getTime() <= Date.now() ||
        (await usersAreBlocked(fastify.db, grant.ownerUserId, request.user.uid))
      ) {
        return reply.status(409).send(
          buildErrorResponse({
            code: 'LOCATION_INVITE_INACTIVE',
            message: 'Location invitation is no longer active',
            requestId: request.id,
          }),
        );
      }
      const acceptedAt = new Date().toISOString();
      await grantRef.update({ status: 'accepted', acceptedAt, updatedAt: acceptedAt });
      return buildSuccessResponse({ sessionId: grant.sessionId, status: 'accepted' });
    },
  );

  fastify.get(
    '/social/location/:id',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: LocationSessionParams })],
    },
    async (request: any, reply) => {
      const sessionSnapshot = await fastify.db
        .collection('locationSessions')
        .doc(request.params.id)
        .get();
      const session = sessionSnapshot.data();
      if (
        !sessionSnapshot.exists ||
        !session?.isActive ||
        new Date(session.expiresAt).getTime() <= Date.now()
      ) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Location session not found',
            requestId: request.id,
          }),
        );
      }
      const isOwner = session.userId === request.user.uid;
      if (!isOwner) {
        const grant = await fastify.db
          .collection('location_sharing_grants')
          .doc(`${request.params.id}_${request.user.uid}`)
          .get();
        if (
          !grant.exists ||
          grant.data()?.status !== 'accepted' ||
          (await usersAreBlocked(fastify.db, session.userId, request.user.uid))
        ) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Location session not found',
              requestId: request.id,
            }),
          );
        }
      }
      return {
        id: sessionSnapshot.id,
        userId: session.userId,
        eventId: session.eventId,
        location: session.location,
        lastUpdate: session.lastUpdate,
        expiresAt: session.expiresAt,
        isActive: true,
      };
    },
  );

  fastify.post(
    '/social/location/:id/stop',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: LocationSessionParams })],
    },
    async (request: any, reply) => {
      const sessionRef = fastify.db.collection('locationSessions').doc(request.params.id);
      const snapshot = await sessionRef.get();
      if (!snapshot.exists || snapshot.data()?.userId !== request.user.uid) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Location session not found',
            requestId: request.id,
          }),
        );
      }
      const stoppedAt = new Date().toISOString();
      await sessionRef.update({ isActive: false, stoppedAt, updatedAt: stoppedAt });
      return buildSuccessResponse({ stopped: true, stoppedAt });
    },
  );

  fastify.delete(
    '/social/location/:id/grants/:targetUserId',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: LocationGrantParams })],
    },
    async (request: any, reply) => {
      const { id, targetUserId } = request.params;
      const session = await fastify.db.collection('locationSessions').doc(id).get();
      if (!session.exists || session.data()?.userId !== request.user.uid) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Location session not found',
            requestId: request.id,
          }),
        );
      }
      const revokedAt = new Date().toISOString();
      await fastify.db
        .collection('location_sharing_grants')
        .doc(`${id}_${targetUserId}`)
        .set({ status: 'revoked', revokedAt, updatedAt: revokedAt }, { merge: true });
      return buildSuccessResponse({ revoked: true, revokedAt });
    },
  );

  /**
   * POST /api/v1/social/sos
   */
  fastify.post(
    '/social/sos',
    {
      config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: SosBody })],
    },
    async (request: any, reply) => {
      const userId = request.user.uid;
      const { eventId, latitude, longitude, idempotencyKey } = request.body;
      const sosId = createHash('sha256')
        .update(`sos:v1:${userId}:${idempotencyKey}`)
        .digest('hex')
        .slice(0, 40);
      const sosRef = fastify.db.collection('sos_alerts').doc(sosId);

      try {
        const existing = await sosRef.get();
        if (existing.exists && existing.data()?.status === 'accepted') {
          const data = existing.data()!;
          return buildSuccessResponse({
            sosId,
            accepted: true,
            alreadyAccepted: true,
            acceptedCount: Number(data.acceptedCount || 0),
          });
        }

        const contactSnapshot = await fastify.db
          .collection('emergency_contacts')
          .where('userId', '==', userId)
          .limit(5)
          .get();
        const contacts = contactSnapshot.docs
          .map((doc: any) => ({ contactId: doc.id, ...doc.data() }))
          .filter((contact: any) => contact.status === 'verified');
        if (contacts.length === 0) {
          return reply.status(409).send(
            buildErrorResponse({
              code: 'SOS_NO_VERIFIED_CONTACTS',
              message: 'Verify at least one emergency contact before sending SOS',
              requestId: request.id,
            }),
          );
        }

        const profile = await fastify.db.collection('users').doc(userId).get();
        const now = new Date().toISOString();
        await sosRef.set({
          id: sosId,
          userId,
          eventId: eventId || null,
          location: latitude != null && longitude != null ? { latitude, longitude } : null,
          recipientContactIds: contacts.map((contact: any) => contact.contactId),
          status: 'dispatching',
          idempotencyKeyHash: createHash('sha256').update(idempotencyKey).digest('hex'),
          requestId: request.id,
          attempts: Number(existing.data()?.attempts || 0) + 1,
          triggeredAt: existing.data()?.triggeredAt || now,
          updatedAt: now,
        });

        const receipts = await sendSosViaMsg91({
          sosId,
          userName: profile.data()?.displayName || profile.data()?.name || 'A C1RCLE member',
          recipients: contacts.map((contact: any) => ({
            contactId: contact.contactId,
            phone: contact.phone,
            name: contact.name,
          })),
          latitude,
          longitude,
        });
        const acceptedAt = new Date().toISOString();
        await sosRef.update({
          status: 'accepted',
          acceptedCount: receipts.length,
          receipts,
          acceptedAt,
          updatedAt: acceptedAt,
          lastError: null,
        });
        return buildSuccessResponse({
          sosId,
          accepted: true,
          alreadyAccepted: false,
          acceptedCount: receipts.length,
        });
      } catch (error: any) {
        await sosRef
          .set(
            {
              status: 'failed',
              lastErrorCode: error.code || 'SOS_PROVIDER_UNAVAILABLE',
              failedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          )
          .catch(() => undefined);
        fastify.log.error(
          { requestId: request.id, userId, sosId, error: error.message },
          'POST /social/sos failed',
        );
        return reply.status(503).send(
          buildErrorResponse({
            code: error.code || 'SOS_PROVIDER_UNAVAILABLE',
            message: 'Emergency messaging was not accepted. Call local emergency services.',
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
        const result = await sendChatMessage(fastify.db, userId, id, {
          text,
          imageUrl,
          type: imageUrl ? 'image' : 'text',
        });
        const topic = `dm:${result.chat.id || id}`;
        fastify.broadcast(
          {
            type: 'dm:new_message',
            payload: {
              topic,
              conversationId: result.chat.id || id,
              message: result.message,
            },
          },
          topic,
        );
        reply.header('Deprecation', 'true');
        reply.header('Sunset', 'Sat, 08 Aug 2026 00:00:00 GMT');
        return { success: true, messageId: result.message.id };
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
      const result = await getChatMessages(fastify.db, userId, id, { limit });
      reply.header('Deprecation', 'true');
      reply.header('Sunset', 'Sat, 08 Aug 2026 00:00:00 GMT');
      return buildSuccessResponse(result);
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
      const result = await getChatMessages(fastify.db, userId, eventId, {
        limit,
        before: lastTimestamp || null,
      });
      reply.header('Deprecation', 'true');
      reply.header('Sunset', 'Sat, 08 Aug 2026 00:00:00 GMT');
      return buildSuccessResponse(result);
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

  fastify.get(
    '/social/matches',
    {
      preHandler: [
        fastify.validate({
          querystring: z
            .object({
              cursor: z.string().optional(),
              limit: z.coerce.number().int().min(1).max(100).optional(),
            })
            .strict(),
        }),
      ],
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
        const { getUserMatches } = await import('@c1rcle/core/guest-dating-service');
        const result = await getUserMatches(fastify.db, userId, request.query);
        return buildSuccessResponse({
          matches: result.data,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        });
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
    },
  );

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
