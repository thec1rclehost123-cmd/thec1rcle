import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
// @ts-ignore
import { hasActiveEventEntitlement } from '@c1rcle/core/guest-chat-service';

interface WSClient {
  socket: any;
  subscriptions: Set<string>;
  userId: string | null;
  claims: Record<string, any> | null;
}

async function canSubscribeToTopic(fastify: FastifyInstance, client: WSClient, topic: string) {
  if (!client.userId || !topic || topic.length > 300) return false;
  const [scope, ...rest] = topic.split(':');
  const id = rest.join(':');
  if (!id) return false;

  if (scope === 'event-chat') {
    return await hasActiveEventEntitlement(fastify.db, client.userId, id);
  }
  if (scope === 'dm') {
    const doc = await fastify.db.collection('privateConversations').doc(id).get();
    const data = doc.exists ? doc.data() : null;
    return Boolean(
      data?.participants?.includes(client.userId) &&
        data.status === 'accepted' &&
        (!data.expiresAt || new Date(data.expiresAt).getTime() > Date.now()),
    );
  }
  if (scope === 'workspace') {
    const membership = await fastify.db
      .collection('workspace_memberships')
      .where('workspaceId', '==', id)
      .where('userId', '==', client.userId)
      .limit(1)
      .get();
    return !membership.empty;
  }
  if (scope === 'event') {
    const role = String(client.claims?.role || client.claims?.userType || '').toLowerCase();
    return Boolean(
      client.claims?.admin === true ||
        ['admin', 'superadmin', 'host', 'venue', 'scanner', 'staff', 'partner'].includes(role),
    );
  }
  return false;
}

export default fp(async (fastify: FastifyInstance) => {
  const clients = new Set<WSClient>();
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  const subRedis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2000,
    lazyConnect: true,
  });

  subRedis.on('error', (err) => {
    fastify.log.warn(`Realtime PUB/SUB Redis unavailable: ${err.message}`);
  });

  // Forward Redis pub/sub messages to all matching local WS clients.
  // This must be registered BEFORE connect() so no messages are missed.
  subRedis.on('message', (_channel: string, rawMessage: string) => {
    try {
      const { payload, topic } = JSON.parse(rawMessage) as { payload: unknown; topic?: string };
      const messageStr = JSON.stringify(payload);
      for (const client of clients) {
        if (client.socket.readyState === 1) {
          if (!topic || client.subscriptions.has(topic)) {
            client.socket.send(messageStr);
          }
        }
      }
    } catch {}
  });

  subRedis
    .connect()
    .then(() => {
      subRedis.subscribe('C1RCLE_BROADCAST').catch((err) => {
        fastify.log.error(`Failed to subscribe to Redis broadcast: ${err.message}`);
      });
    })
    .catch(() => {
      fastify.log.warn('Realtime Redis connection skipped. Distributed broadcast disabled.');
    });

  fastify.get('/ws/updates', { websocket: true }, async (connection, req) => {
    const client: WSClient = {
      socket: connection,
      subscriptions: new Set<string>(),
      userId: null,
      claims: null,
    };
    clients.add(client);

    connection.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'AUTH' && data.token) {
          (fastify as any).auth
            .verifyIdToken(data.token)
            .then((decoded: any) => {
              client.userId = decoded.uid;
              client.claims = decoded;
              connection.send(JSON.stringify({ type: 'AUTH_SUCCESS', uid: decoded.uid }));
            })
            .catch(() => {
              connection.close(4001, 'Token rejected or revoked');
            });
        } else if (client.userId === null) {
          connection.close(4001, 'Authentication required');
        } else if (data.type === 'SUBSCRIBE' && data.topic) {
          if (client.subscriptions.size >= 100) {
            connection.send(
              JSON.stringify({ type: 'SUBSCRIBE_DENIED', payload: { topic: data.topic } }),
            );
            return;
          }
          const allowed = await canSubscribeToTopic(fastify, client, String(data.topic));
          if (allowed) {
            client.subscriptions.add(String(data.topic));
            connection.send(
              JSON.stringify({ type: 'SUBSCRIBE_SUCCESS', payload: { topic: data.topic } }),
            );
          } else {
            connection.send(
              JSON.stringify({ type: 'SUBSCRIBE_DENIED', payload: { topic: data.topic } }),
            );
          }
        } else if (data.type === 'UNSUBSCRIBE' && data.topic) {
          client.subscriptions.delete(data.topic);
        }
      } catch {}
    });

    connection.on('close', () => {
      clients.delete(client);
    });

    connection.send(JSON.stringify({ type: 'welcome', message: 'Connected to C1RCLE Real-time' }));
  });

  // Publishes to Redis so all gateway instances forward to their local clients.
  // Falls back to direct local fanout when Redis is unavailable.
  fastify.decorate('broadcast', (payload: unknown, topic?: string) => {
    if (fastify.redis && fastify.redis.status === 'ready') {
      fastify.redis.publish('C1RCLE_BROADCAST', JSON.stringify({ payload, topic }));
    } else {
      const messageStr = JSON.stringify(payload);
      for (const client of clients) {
        if (client.socket.readyState === 1) {
          if (!topic || client.subscriptions.has(topic)) {
            client.socket.send(messageStr);
          }
        }
      }
    }
  });

  fastify.addHook('onClose', async () => {
    await subRedis.quit();
    for (const client of clients) {
      client.socket.close(1001, 'Server shutting down');
    }
    clients.clear();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    broadcast: (payload: unknown, topic?: string) => void;
  }
}
