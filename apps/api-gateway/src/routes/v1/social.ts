import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import { getMutualBlockedUserIds } from '../../lib/blocked-users';
// @ts-ignore
import { followEntity, unfollowEntity, isFollowing } from '@c1rcle/core/follow-graph-engine';
// @ts-ignore
import {
  assertUserCanSendChatMessage,
  countApprovedEventMedia,
  getChatMessages,
  hasActiveEventEntitlement,
  reportSocialMessage,
  sendChatMessage,
} from '@c1rcle/core/guest-chat-service';

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

const GenericReportBody = z
  .object({
    targetId: z.string().min(1).max(300),
    targetType: z.enum(['user', 'event', 'media']),
    reason: z.string().trim().min(1).max(300),
    details: z.string().trim().max(1000).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

const MessageReportBody = z
  .object({
    targetType: z.literal('message'),
    targetId: z.string().min(1).max(300).optional(),
    messageId: z.string().min(1).max(300).optional(),
    senderId: z.string().min(1).max(300),
    eventId: z.string().min(1).max(300).optional(),
    conversationId: z.string().min(1).max(300).optional(),
    chatId: z.string().min(1).max(300).optional(),
    reason: z.string().trim().max(300).optional().default('message_report'),
    details: z.string().trim().max(1000).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.messageId || body.targetId), {
    message: 'messageId is required',
  })
  .refine(
    (body) =>
      Boolean(
        body.eventId ||
        body.conversationId ||
        body.chatId ||
        body.metadata?.eventId ||
        body.metadata?.conversationId ||
        body.metadata?.chatId,
      ),
    {
      message: 'eventId, conversationId or chatId is required',
    },
  );

const ReportBody = z.union([MessageReportBody, GenericReportBody]);

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
    action: z.enum(['like', 'pass', 'askOut']),
    eventId: z.string().min(1).max(200).optional().nullable(),
    message: z.string().trim().max(280).optional().nullable(),
  })
  .strict();

const EventChatParams = z
  .object({
    eventId: z.string().min(1).max(200),
  })
  .strict();

const DirectMessageParams = z
  .object({
    id: z.string().min(1).max(200),
  })
  .strict();

const GroupChatMessagesQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(50),
    lastTimestamp: z.string().min(1).max(200).optional(),
  })
  .strict();

const DirectMessagesQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(50),
  })
  .strict();

const DirectMessageBody = z
  .object({
    text: z.string().trim().min(1).max(2000).optional(),
    imageUrl: z.string().url().max(2000).optional(),
    replyToId: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.text || body.imageUrl), {
    message: 'text or imageUrl is required',
  });

export function directMessageAccessError(
  conversation: any,
  userId: string,
  nowMs = Date.now(),
): { statusCode: number; code: string; message: string } | null {
  if (!Array.isArray(conversation?.participants) || !conversation.participants.includes(userId)) {
    return { statusCode: 403, code: 'FORBIDDEN', message: 'Forbidden: Not a participant' };
  }
  if (conversation.status !== 'accepted') {
    return {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'This private chat request has not been accepted.',
    };
  }
  const expiresAtMs = Date.parse(String(conversation.expiresAt || ''));
  if (!conversation.isSaved && Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) {
    return { statusCode: 410, code: 'GONE', message: 'This private chat has expired.' };
  }
  return null;
}

const DiscoverProfilesQuery = z
  .object({
    cursor: z.string().min(1).max(300).optional(),
  })
  .strict();

function reportedByArray(message: any): string[] {
  if (Array.isArray(message?.reportedBy)) {
    return message.reportedBy.filter(Boolean).map(String);
  }
  if (message?.reportedBy) return [String(message.reportedBy)];
  return [];
}

function isVisibleChatMessage(message: any, userId: string): boolean {
  if (message?.isHidden === true) return false;
  return !reportedByArray(message).includes(String(userId));
}

function moderationErrorStatus(message = '') {
  if (message === 'Forbidden') return 403;
  if (message === 'Message not found' || message === 'Chat not found') return 404;
  if (message.includes('required')) return 400;
  return 500;
}

function chatErrorStatus(message = '') {
  if (
    message === 'Forbidden' ||
    message === 'Chat is not open' ||
    message === 'Chat banned' ||
    message === 'Removed from chat' ||
    message === 'Muted in chat'
  ) {
    return 403;
  }
  if (message === 'Chat not found' || message === 'Event not found') return 404;
  if (message.includes('required') || message === 'Message is too long') return 400;
  return 500;
}

function chatBanResponse(request: any, reply: any) {
  return reply.status(403).send(
    buildErrorResponse({
      code: 'CHAT_BANNED',
      message: 'You are banned from chat',
      requestId: request.id,
    }),
  );
}

export default async function socialRoutes(fastify: FastifyInstance) {
  const requireVerifiedPhone =
    (fastify as any).requireVerifiedPhone || (fastify as any).requireAuth;
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
   * Rate-limited to 10 messages per 10 seconds per user.
   */
  fastify.post(
    '/social/chat',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '10 seconds',
          keyGenerator: (request: any) => request.user?.uid || request.ip,
          errorResponseBuilder: (_req: any, _context: any) => ({
            statusCode: 429,
            code: 'TOO_MANY_REQUESTS',
            error: 'Too Many Requests',
            message: 'You are sending messages too fast. Please slow down.',
          }),
        },
      },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: ChatMessageBody })],
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
        const result = await sendChatMessage(fastify.db, userId, eventId, {
          text: text || null,
          imageUrl: imageUrl || videoUrl || null,
          type: imageUrl || videoUrl ? 'image' : 'text',
          metadata: {
            ...(metadata || {}),
            replyTo: replyToId || null,
          },
        });
        const savedMessage = result.message;
        fastify.broadcast(
          {
            type: 'chat:new_message',
            payload: { eventId, message: savedMessage, topic: `event-chat:${eventId}` },
          },
          `event-chat:${eventId}`,
        );
        return { success: true, id: savedMessage.id, message: savedMessage };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/chat: ${error.message}`);
        if (error.message === 'Chat banned') {
          return chatBanResponse(request, reply);
        }
        const statusCode = chatErrorStatus(error.message);
        return reply.status(statusCode).send(
          buildErrorResponse({
            code:
              statusCode === 403
                ? 'FORBIDDEN'
                : statusCode === 404
                  ? 'NOT_FOUND'
                  : statusCode === 400
                    ? 'BAD_REQUEST'
                    : 'INTERNAL_ERROR',
            message: statusCode === 500 ? 'Internal server error' : error.message,
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
   * GET /api/v1/social/media/:eventId/count
   * Fetch the approved gallery count for an event.
   */
  fastify.get(
    '/social/media/:eventId/count',
    { preHandler: [fastify.validate({ params: EventChatParams })] },
    async (request: any, reply) => {
      try {
        const count = await countApprovedEventMedia(fastify.db, request.params.eventId);
        return buildSuccessResponse({ count });
      } catch (error: any) {
        fastify.log.error(`Error in GET /social/media/:eventId/count: ${error.message}`);
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

        const settingsRef = fastify.db.collection('users').doc(userId);
        batch.set(
          settingsRef,
          {
            settings: { blockedUsers: FieldValue.arrayRemove(targetUid) },
          },
          { merge: true },
        );

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
          location: latitude && longitude ? { latitude, longitude } : null,
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
  fastify.get(
    '/social/dm/requests',
    { preHandler: [requireVerifiedPhone] },
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
        const blockedIds = await getMutualBlockedUserIds(fastify, userId);
        const blockedSet = new Set(blockedIds);

        const snapshot = await fastify.db
          .collection('privateConversations')
          .where('participants', 'array-contains', userId)
          .where('status', '==', 'pending')
          .get();

        const requests = snapshot.docs
          .filter((doc) => doc.data().initiatedBy !== userId)
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((req: any) => {
            const otherUid = (req.participants || []).find((p: string) => p !== userId);
            return otherUid && !blockedSet.has(otherUid);
          });

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
    },
  );

  /**
   * POST /api/v1/social/dm/request
   */
  fastify.post(
    '/social/dm/request',
    {
      preHandler: [
        requireVerifiedPhone,
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
        if (recipientId === userId) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'You cannot start a private chat with yourself.',
              requestId: request.id,
            }),
          );
        }

        const [recipientDoc, senderEligible, recipientEligible, blockedIds, existingSnapshot] =
          await Promise.all([
            fastify.db.collection('users').doc(recipientId).get(),
            hasActiveEventEntitlement(fastify.db, userId, eventId),
            hasActiveEventEntitlement(fastify.db, recipientId, eventId),
            getMutualBlockedUserIds(fastify, userId),
            fastify.db
              .collection('privateConversations')
              .where('participants', 'array-contains', userId)
              .where('eventId', '==', eventId)
              .get(),
          ]);
        if (!recipientDoc.exists) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Recipient not found',
              requestId: request.id,
            }),
          );
        }
        if (!senderEligible || !recipientEligible) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Both users need an active ticket for this event.',
              requestId: request.id,
            }),
          );
        }
        if (blockedIds.includes(recipientId)) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Private chat is unavailable for this user.',
              requestId: request.id,
            }),
          );
        }
        const existing = existingSnapshot.docs.find((doc: any) => {
          const data = doc.data();
          return (
            data.participants?.includes(recipientId) &&
            (data.status === 'pending' || data.status === 'accepted')
          );
        });
        if (existing) {
          return {
            success: true,
            conversationId: existing.id,
            status: existing.data().status,
            existing: true,
          };
        }

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
  fastify.post(
    '/social/dm/:id/accept',
    { preHandler: [requireVerifiedPhone] },
    async (request: any, reply) => {
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
        if (data.status !== 'pending') {
          return reply.status(409).send(
            buildErrorResponse({
              code: 'CONFLICT',
              message: 'This private chat request is no longer pending.',
              requestId: request.id,
            }),
          );
        }
        const expiresAtMs = Date.parse(String(data.expiresAt || ''));
        if (!data.isSaved && Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
          await docRef.update({ status: 'expired', updatedAt: new Date().toISOString() });
          return reply.status(410).send(
            buildErrorResponse({
              code: 'GONE',
              message: 'This private chat request has expired.',
              requestId: request.id,
            }),
          );
        }
        const otherUserId = data.participants.find(
          (participantId: string) => participantId !== userId,
        );
        const blockedIds = await getMutualBlockedUserIds(fastify, userId);
        if (otherUserId && blockedIds.includes(otherUserId)) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Private chat is unavailable for this user.',
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
    },
  );

  /**
   * POST /api/v1/social/dm/:id/send
   */
  fastify.post(
    '/social/dm/:id/send',
    {
      preHandler: [
        requireVerifiedPhone,
        fastify.validate({ params: DirectMessageParams, body: DirectMessageBody }),
      ],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      const { id } = request.params;
      const { text, imageUrl, replyToId } = request.body;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      try {
        await assertUserCanSendChatMessage(fastify.db, userId);

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

        const conversation = convoDoc.data() as any;
        const accessError = directMessageAccessError(conversation, userId);
        if (accessError) {
          return reply.status(accessError.statusCode).send(
            buildErrorResponse({
              code: accessError.code,
              message: accessError.message,
              requestId: request.id,
            }),
          );
        }
        const otherUserId = conversation.participants.find(
          (participantId: string) => participantId !== userId,
        );
        const blockedIds = await getMutualBlockedUserIds(fastify, userId);
        if (otherUserId && blockedIds.includes(otherUserId)) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Private chat is unavailable for this user.',
              requestId: request.id,
            }),
          );
        }

        const createdAt = new Date().toISOString();
        const directMessage: any = {
          conversationId: id,
          senderId: userId,
          content: text || imageUrl,
          type: text ? 'text' : 'image',
          createdAt,
        };
        if (replyToId) {
          directMessage.replyTo = replyToId;
        }
        const msgRef = await fastify.db.collection('directMessages').add(directMessage);

        await convoRef.update({
          lastMessage: {
            content: text || '📷 Photo',
            senderId: userId,
            createdAt,
          },
        });

        const savedMessage = { id: msgRef.id, ...directMessage };
        fastify.broadcast(
          { type: 'dm:new_message', payload: { conversationId: id, message: savedMessage } },
          `dm:${id}`,
        );

        return { success: true, messageId: msgRef.id, message: savedMessage };
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/dm/:id/send: ${error.message}`);
        if (error.message === 'Chat banned') {
          return chatBanResponse(request, reply);
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

  /**
   * GET /api/v1/social/dm/:id/messages
   * Requires auth and verifies the caller is a participant of the conversation.
   */
  fastify.get(
    '/social/dm/:id/messages',
    {
      preHandler: [
        requireVerifiedPhone,
        fastify.validate({ params: DirectMessageParams, querystring: DirectMessagesQuery }),
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
      const { limit } = request.query;

      try {
        const convoDoc = await fastify.db.collection('privateConversations').doc(id).get();
        if (!convoDoc.exists)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Not found',
              requestId: request.id,
            }),
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
          .limit(limit)
          .get();

        const messages = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((message) => isVisibleChatMessage(message, userId));
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
    },
  );

  /**
   * GET /api/v1/social/dm/:id
   */
  fastify.get(
    '/social/dm/:id',
    { preHandler: [requireVerifiedPhone] },
    async (request: any, reply) => {
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
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Not found',
                requestId: request.id,
              }),
            );

        const data = doc.data();
        if (!data?.participants.includes(userId)) {
          return reply
            .status(403)
            .send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Forbidden',
                requestId: request.id,
              }),
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
    },
  );

  /**
   * POST /api/v1/social/typing
   */
  fastify.post(
    '/social/typing',
    {
      preHandler: [
        requireVerifiedPhone,
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
        if (chatType === 'group') {
          const eligible = await hasActiveEventEntitlement(fastify.db, userId, chatId);
          if (!eligible) {
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'An active event entitlement is required',
                requestId: request.id,
              }),
            );
          }
        } else {
          const conversation = await fastify.db
            .collection('privateConversations')
            .doc(chatId)
            .get();
          const data = conversation.exists ? conversation.data() : null;
          if (
            !data?.participants?.includes(userId) ||
            data.status !== 'accepted' ||
            (data.expiresAt && new Date(data.expiresAt).getTime() <= Date.now())
          ) {
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Accepted conversation access is required',
                requestId: request.id,
              }),
            );
          }
        }

        const typingId = `${chatType}_${chatId}_${userId}`;
        const docRef = fastify.db.collection('typingIndicators').doc(typingId);
        const trustedUserName = String(
          request.user?.name || request.user?.displayName || 'Attendee',
        ).slice(0, 80);
        const timestamp = new Date().toISOString();

        if (isTyping) {
          await docRef.set({
            chatId,
            chatType,
            userId,
            userName: trustedUserName,
            timestamp,
          });
        } else {
          await docRef.delete();
        }

        const topic = chatType === 'group' ? `event-chat:${chatId}` : `dm:${chatId}`;
        fastify.broadcast(
          {
            type: 'chat:typing',
            payload: {
              chatId,
              chatType,
              userId,
              userName: trustedUserName,
              isTyping,
              timestamp,
              topic,
            },
          },
          topic,
        );

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
  fastify.get(
    '/social/typing/:chatId',
    {
      preHandler: [
        requireVerifiedPhone,
        fastify.validate({
          params: z.object({ chatId: z.string().min(1) }).strict(),
          querystring: z.object({ chatType: z.enum(['group', 'dm']) }).strict(),
        }),
      ],
    },
    async (request: any, reply) => {
    const { chatId } = request.params;
    const { chatType } = request.query;
    const userId = request.user?.uid;
    if (!userId) {
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );
    }

    try {
      if (chatType === 'group') {
        const eligible = await hasActiveEventEntitlement(fastify.db, userId, chatId);
        if (!eligible) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'An active event entitlement is required',
              requestId: request.id,
            }),
          );
        }
      } else {
        const conversation = await fastify.db.collection('privateConversations').doc(chatId).get();
        const data = conversation.exists ? conversation.data() : null;
        if (!data?.participants?.includes(userId) || data.status !== 'accepted') {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Accepted conversation access is required',
              requestId: request.id,
            }),
          );
        }
      }
      const snapshot = await fastify.db
        .collection('typingIndicators')
        .where('chatId', '==', chatId)
        .where('chatType', '==', chatType)
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
   * POST /api/v1/social/chat/join
   * Join an event group chat. Verifies the user has an active ticket/entitlement.
   * Replaces the old client-side Firestore write.
   */
  fastify.post(
    '/social/chat/join',
    {
      preHandler: [
        fastify.validate({
          body: z
            .object({
              eventId: z.string(),
              displayName: z.string().optional(),
              photoURL: z.string().nullable().optional(),
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

      const { eventId, displayName, photoURL } = request.body;

      try {
        const eligible = await hasActiveEventEntitlement(fastify.db, userId, eventId);
        if (!eligible) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'An active ticket is required to join this event chat.',
              requestId: request.id,
            }),
          );
        }
        const { ensureEventChatMembership } = await import('@c1rcle/core/guest-chat-service');
        const result = await ensureEventChatMembership(fastify.db, {
          eventId,
          userId,
          userName: displayName || request.user?.name || 'C1RCLE member',
          userAvatar: photoURL || request.user?.picture || null,
          source: 'ticket',
        });
        return buildSuccessResponse({ chat: result.chat, member: result.member });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /social/chat/join failed',
        );
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: error.message || 'Failed to join chat',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * GET /api/v1/social/chat/:eventId
   * Fetch messages for an event (standard polling fallback).
   * Requires auth — only attendees may read the chat.
   */
  fastify.get(
    '/social/chat/:eventId',
    {
      preHandler: [
        requireVerifiedPhone,
        fastify.validate({ params: EventChatParams, querystring: GroupChatMessagesQuery }),
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
      const { eventId } = request.params;
      const { limit, lastTimestamp } = request.query;

      try {
        const result = await getChatMessages(fastify.db, userId, eventId, {
          limit,
          before: lastTimestamp || null,
        });
        return buildSuccessResponse({
          messages: result.messages,
          pagination: result.pagination,
          chat: result.chat,
        });
      } catch (error: any) {
        fastify.log.error(`Error in GET /social/chat/:eventId: ${error.message}`);
        const statusCode = chatErrorStatus(error.message);
        return reply.status(statusCode).send(
          buildErrorResponse({
            code:
              statusCode === 403
                ? 'FORBIDDEN'
                : statusCode === 404
                  ? 'NOT_FOUND'
                  : statusCode === 400
                    ? 'BAD_REQUEST'
                    : 'INTERNAL_ERROR',
            message: statusCode === 500 ? 'Internal server error' : error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/social/report
   * Report a user, message, or media
   */
  fastify.post(
    '/social/report',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: ReportBody })],
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

      const body = request.body;

      try {
        if (body.targetType === 'message') {
          const metadata = body.metadata || {};
          const result = await reportSocialMessage(fastify.db, userId, {
            messageId: body.messageId || body.targetId,
            senderId: body.senderId,
            eventId: body.eventId || metadata.eventId || null,
            conversationId: body.conversationId || metadata.conversationId || null,
            chatId: body.chatId || metadata.chatId || null,
            reason: body.reason,
            details: body.details || null,
          });

          return buildSuccessResponse(result);
        }

        const reportId = await fastify.moderationService.reportItem({
          reporterId: userId,
          targetId: body.targetId,
          targetType: body.targetType,
          reason: body.reason,
          details: body.details || '',
        });

        return buildSuccessResponse({ reportId });
      } catch (error: any) {
        fastify.log.error(`Error in POST /social/report: ${error.message}`);
        const status = body.targetType === 'message' ? moderationErrorStatus(error.message) : 500;
        return reply.status(status).send(
          buildErrorResponse({
            code:
              status === 400
                ? 'BAD_REQUEST'
                : status === 403
                  ? 'FORBIDDEN'
                  : status === 404
                    ? 'NOT_FOUND'
                    : 'INTERNAL_ERROR',
            message: status === 500 ? 'Internal server error' : error.message,
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
        const batch = fastify.db.batch();

        const blockRef = fastify.db.collection('userBlocks').doc();
        batch.set(blockRef, {
          blockerUid: userId,
          blockedUid: targetUid,
          createdAt: new Date().toISOString(),
        });

        const settingsRef = fastify.db.collection('users').doc(userId);
        batch.set(
          settingsRef,
          {
            settings: { blockedUsers: FieldValue.arrayUnion(targetUid) },
          },
          { merge: true },
        );

        await batch.commit();

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

      const blocks = Array.from(
        new Set(snapshot.docs.map((doc) => doc.data().blockedUid).filter(Boolean)),
      );
      const profileDocs = await Promise.all(
        blocks.map((blockedUid) =>
          fastify.db
            .collection('users')
            .doc(blockedUid)
            .get()
            .catch(() => null),
        ),
      );
      const blockedUsers = profileDocs.map((profileDoc, index) => {
        const profile = profileDoc?.exists ? profileDoc.data() || {} : {};
        return {
          uid: blocks[index],
          displayName: profile.displayName || profile.name || 'Blocked member',
          photoURL: profile.photoURL || profile.avatar || null,
        };
      });
      return buildSuccessResponse({ blockedUserIds: blocks, blockedUsers });
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
  fastify.post('/social/upload', {
    preHandler: [fastify.requireAuth],
    config: { rateLimit: { max: 12, timeWindow: '10 minutes' } },
  }, async (request: any, reply: any) => {
    try {
      const result = await handleUpload(request, fastify);
      return result;
    } catch (error: any) {
      const statusCode = Number(error.statusCode) || 500;
      fastify.log.error({ requestId: request.id, userId: request.user?.uid, error: error.message }, 'Upload failed');
      return reply.status(statusCode).send(
        buildErrorResponse({
          code: error.code || (statusCode < 500 ? 'INVALID_UPLOAD' : 'INTERNAL_ERROR'),
          message: statusCode < 500 ? error.message : 'Upload failed',
          requestId: request.id,
        }),
      );
    }
  });
  fastify.get(
    '/social/discover',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ querystring: DiscoverProfilesQuery })],
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
        const { getDiscoverProfiles } = await import('@c1rcle/core/guest-dating-service');
        const result = await getDiscoverProfiles(fastify.db, userId, {
          cursor: request.query.cursor || null,
        });
        return buildSuccessResponse(result);
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
    },
  );

  fastify.post(
    '/social/swipe',
    {
      config: { rateLimit: { max: 5, timeWindow: '10 seconds' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: SwipeBody })],
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
          {
            eventId: request.body.eventId || null,
            message: request.body.message || null,
          },
        );
        return buildSuccessResponse(result);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /social/swipe failed',
        );

        const isPremiumRequired = error.code === 'PREMIUM_REQUIRED';
        const code = isPremiumRequired ? 'PREMIUM_REQUIRED' : 'BAD_REQUEST';
        const status = isPremiumRequired ? 403 : 400;

        return reply.status(status).send(
          buildErrorResponse({
            code,
            message: error.message,
            details: error.details || null,
            requestId: request.id,
          }),
        );
      }
    },
  );

  const UserIdParam = z.object({ id: z.string() }).strict();

  fastify.get(
    '/social/matches',
    { preHandler: [requireVerifiedPhone] },
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
        const blockedIds = await getMutualBlockedUserIds(fastify, userId);
        const blockedSet = new Set(blockedIds);

        const { getUserMatches } = await import('@c1rcle/core/guest-dating-service');
        const matches = await getUserMatches(fastify.db, userId);

        const filtered = (matches || []).filter((match: any) => {
          const otherId = match.userId || match.uid || match.id;
          return otherId && !blockedSet.has(otherId);
        });

        return buildSuccessResponse({ matches: filtered });
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

  /**
   * GET /api/v1/social/my-chats
   * Returns the current user's event chats and private conversations,
   * filtering out conversations with blocked users (mutual blocking).
   */
  fastify.get(
    '/social/my-chats',
    { preHandler: [requireVerifiedPhone] },
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
        const inboxCacheNamespace = `social:my-chats:${userId}`;
        const cachedInbox = await fastify.cache.get(inboxCacheNamespace, 'v1');
        if (cachedInbox) return cachedInbox;

        const blockedIds = await getMutualBlockedUserIds(fastify, userId);
        const blockedSet = new Set(blockedIds);

        // ── Private conversations (DMs) ────────────────────────────────────
        const privateSnap = await fastify.db
          .collection('privateConversations')
          .where('participants', 'array-contains', userId)
          .get();

        const otherUids = new Set<string>();
        const privateDocs: { id: string; data: any }[] = [];
        for (const doc of privateSnap.docs) {
          const data = doc.data();
          const otherUid = (data.participants || []).find((p: string) => p !== userId);
          if (!otherUid || blockedSet.has(otherUid)) continue;
          otherUids.add(otherUid);
          privateDocs.push({ id: doc.id, data });
        }

        // Batch-fetch other user profiles
        const userProfiles = new Map<string, any>();
        if (otherUids.size > 0) {
          const userDocs = await Promise.all(
            [...otherUids].map((uid) =>
              fastify.db
                .collection('users')
                .doc(uid)
                .get()
                .catch(() => null),
            ),
          );
          for (const doc of userDocs) {
            if (doc?.exists) userProfiles.set(doc.id, doc.data());
          }
        }

        const privateChats = privateDocs.map(({ id, data }) => {
          const otherUid = (data.participants || []).find((p: string) => p !== userId);
          const profile = otherUid ? userProfiles.get(otherUid) : null;
          return {
            id,
            participants: data.participants,
            eventId: data.eventId || null,
            otherUserName: profile?.displayName || null,
            otherUserAvatar: profile?.photoURL || profile?.avatar || null,
            isOnline: false,
            lastMessageTime: data.lastMessage?.createdAt || data.updatedAt || data.createdAt,
            unreadCount: 0,
            lastMessage: data.lastMessage?.content || null,
            createdAt: data.createdAt,
          };
        });

        // ── Event chats ────────────────────────────────────────────────────
        const memberSnap = await fastify.db
          .collection('chatMembers')
          .where('userId', '==', userId)
          .where('status', '==', 'active')
          .get();

        const eventChats: Record<string, any>[] = [];
        const chatIds = memberSnap.docs.map((d: any) => d.data().chatId).filter(Boolean);
        if (chatIds.length > 0) {
          const chatDocs = await Promise.all(
            chatIds.map((chatId: string) =>
              fastify.db
                .collection('chats')
                .doc(chatId)
                .get()
                .catch(() => null),
            ),
          );
          const memberByChatId = new Map<string, any>();
          for (const doc of memberSnap.docs) {
            memberByChatId.set(doc.data().chatId, doc.data());
          }

          const eventIdsToFetch = Array.from(
            new Set(
              chatDocs.map((doc) => (doc?.exists ? doc.data()!.eventId : null)).filter(Boolean),
            ),
          );
          const eventDocs = await Promise.all(
            eventIdsToFetch.map((eventId: any) =>
              fastify.db
                .collection('events')
                .doc(eventId)
                .get()
                .catch(() => null),
            ),
          );
          const eventById = new Map<string, any>();
          for (const doc of eventDocs) {
            if (doc?.exists) {
              eventById.set(doc.id, doc.data()!);
            }
          }
          for (const doc of chatDocs) {
            if (!doc?.exists) continue;
            const chatData = doc.data()!;
            const memberData = memberByChatId.get(doc.id) || {};
            const canonicalEvent = eventById.get(chatData.eventId) || {};
            eventChats.push({
              id: doc.id,
              eventId: chatData.eventId,
              // Chat documents are durable conversation history and may retain
              // old seed/reschedule snapshots. Lifecycle labels must use the
              // canonical event record returned in this same bounded request.
              eventTitle:
                canonicalEvent.title ||
                canonicalEvent.eventTitle ||
                chatData.eventTitle ||
                chatData.title ||
                '',
              eventDate:
                canonicalEvent.startDate ||
                canonicalEvent.startAt ||
                canonicalEvent.eventDate ||
                chatData.eventDate ||
                null,
              participants: [],
              participantCount: chatData.participantCount || 0,
              lastMessage: chatData.lastMessage || null,
              createdAt: chatData.createdAt,
              eventCover:
                canonicalEvent.coverImage ||
                canonicalEvent.coverURL ||
                canonicalEvent.bannerImage ||
                canonicalEvent.photoURL ||
                canonicalEvent.image ||
                chatData.eventCover ||
                chatData.image ||
                null,
              unreadCount: memberData.unreadCount || 0,
              activeAvatars: chatData.activeAvatars || [],
            });
          }
        }

        const totalUnread =
          privateChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0) +
          eventChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

        const inbox = { eventChats, privateChats, totalUnread };
        await fastify.cache.set(inboxCacheNamespace, 'v1', inbox, 30);
        return inbox;
      } catch (error: any) {
        fastify.log.error(`Error in GET /social/my-chats: ${error.message}`);
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
export async function handleUpload(request: any, fastify: any) {
  const userId = request.user?.uid;
  if (!userId) {
    const error = new Error('Authentication required') as any;
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const data = await request.file({ limits: { files: 1, fileSize: 2 * 1024 * 1024 } });
  if (!data) {
    const error = new Error('No file uploaded') as any;
    error.statusCode = 400;
    throw error;
  }

  const extensionByMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extension = extensionByMime[data.mimetype];
  if (!extension) {
    data.file.resume();
    const error = new Error('Only JPEG, PNG, and WebP images are supported') as any;
    error.statusCode = 400;
    throw error;
  }

  const bucket = fastify.storage.bucket();
  const fileName = `users/${userId}/profile-media/${Date.now()}-${randomUUID()}.${extension}`;
  const file = bucket.file(fileName);

  const stream = file.createWriteStream({
    metadata: {
      contentType: data.mimetype,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { ownerUid: userId },
    },
    public: true,
  });

  await new Promise((resolve, reject) => {
    data.file.pipe(stream).on('finish', resolve).on('error', reject);
  });

  if (data.file.truncated) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    const error = new Error('Image exceeds the 2MB upload limit') as any;
    error.statusCode = 413;
    throw error;
  }

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  return buildSuccessResponse({ url: publicUrl });
}
