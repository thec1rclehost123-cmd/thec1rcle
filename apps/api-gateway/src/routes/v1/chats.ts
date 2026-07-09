import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
// @ts-ignore - JS module with runtime exports
import {
  getChatMessages,
  listUserChats,
  reportChatMessage,
  sendChatMessage,
} from '@c1rcle/core/guest-chat-service';

const ChatListQuery = z
  .object({
    type: z.enum(['all', 'direct', 'event']).optional().default('all'),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  })
  .strict();

const ChatParams = z
  .object({
    id: z.string().min(1).max(180),
  })
  .strict();

const ReportMessageParams = z
  .object({
    chatId: z.string().min(1).max(180),
    messageId: z.string().min(1).max(180),
  })
  .strict();

const ChatMessagesQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(50),
    before: z.string().min(1).max(80).optional(),
  })
  .strict();

const SendChatMessageBody = z
  .object({
    text: z.string().trim().max(1000).optional(),
    imageUrl: z.string().url().optional(),
    type: z.enum(['text', 'image']).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.text || body.imageUrl), {
    message: 'text or imageUrl is required',
  });

const ReportMessageBody = z
  .object({
    reason: z.string().trim().max(300).optional(),
  })
  .strict()
  .optional()
  .default({});

function statusForChatError(message = '') {
  if (
    message === 'Chat not found' ||
    message === 'Event not found' ||
    message === 'Message not found'
  ) {
    return 404;
  }
  if (
    message === 'Forbidden' ||
    message === 'Removed from chat' ||
    message === 'Muted in chat' ||
    message === 'Chat is not open' ||
    message === 'Chat banned'
  ) {
    return 403;
  }
  if (
    message === 'Message content is required' ||
    message === 'Message is too long' ||
    message.includes('required')
  ) {
    return 400;
  }
  return 500;
}

function codeForStatus(status: number, message = '') {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 403) {
    if (message === 'Removed from chat') return 'CHAT_REMOVED';
    if (message === 'Muted in chat') return 'CHAT_MUTED';
    if (message === 'Chat is not open') return 'CHAT_NOT_OPEN';
    if (message === 'Chat banned') return 'CHAT_BANNED';
    return 'FORBIDDEN';
  }
  if (status === 404) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
}

function messageForStatus(status: number, message = '') {
  if (status === 500) return 'Internal server error';
  if (message === 'Forbidden') return 'You do not have access to this chat';
  if (message === 'Chat banned') return 'You are banned from chat';
  return message || 'Request failed';
}

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/chats',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: ChatListQuery })],
    },
    async (request: any, reply) => {
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
        reply.header('Cache-Control', 'private, no-store');
        const result = await listUserChats(fastify.db, userId, {
          type: request.query.type,
          limit: request.query.limit,
        });
        return buildSuccessResponse(result);
      } catch (error: any) {
        request.log.error({ error, userId }, 'GET /chats failed');
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
    '/chats/:id/messages',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: ChatParams, querystring: ChatMessagesQuery }),
      ],
    },
    async (request: any, reply) => {
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
        reply.header('Cache-Control', 'private, no-store');
        const result = await getChatMessages(fastify.db, userId, request.params.id, {
          limit: request.query.limit,
          before: request.query.before || null,
        });
        return buildSuccessResponse(result);
      } catch (error: any) {
        const status = statusForChatError(error.message);
        request.log.warn({ error, userId, chatId: request.params.id }, 'GET chat messages failed');
        return reply.status(status).send(
          buildErrorResponse({
            code: codeForStatus(status, error.message),
            message: messageForStatus(status, error.message),
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/chats/:id/messages',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: ChatParams, body: SendChatMessageBody }),
      ],
    },
    async (request: any, reply) => {
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
        const result = await sendChatMessage(fastify.db, userId, request.params.id, request.body);
        return reply.status(201).send(buildSuccessResponse(result));
      } catch (error: any) {
        const status = statusForChatError(error.message);
        request.log.warn({ error, userId, chatId: request.params.id }, 'POST chat message failed');
        return reply.status(status).send(
          buildErrorResponse({
            code: codeForStatus(status, error.message),
            message: messageForStatus(status, error.message),
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/chats/:chatId/messages/:messageId/report',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: ReportMessageParams, body: ReportMessageBody }),
      ],
    },
    async (request: any, reply) => {
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
        const result = await reportChatMessage(
          fastify.db,
          userId,
          request.params.chatId,
          request.params.messageId,
          request.body || {},
        );
        return buildSuccessResponse(result);
      } catch (error: any) {
        const status = statusForChatError(error.message);
        request.log.warn(
          {
            error,
            userId,
            chatId: request.params.chatId,
            messageId: request.params.messageId,
          },
          'POST chat message report failed',
        );
        return reply.status(status).send(
          buildErrorResponse({
            code: codeForStatus(status, error.message),
            message: messageForStatus(status, error.message),
            requestId: request.id,
          }),
        );
      }
    },
  );
}
