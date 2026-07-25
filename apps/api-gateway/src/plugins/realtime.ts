import fp from 'fastify-plugin';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';

interface RealtimeClaims {
  uid: string;
  authTime: number;
  iat: number;
  exp: number;
  jti: string;
}

interface WSClient {
  socket: any;
  subscriptions: Set<string>;
  userId: string | null;
  claims: RealtimeClaims | null;
  expiryTimer: ReturnType<typeof setTimeout> | null;
}

const SESSION_TTL_SECONDS = 60;
const TOPIC_PATTERN = /^(event-chat|dm|event|partner):([A-Za-z0-9_-]{1,180})$/;

function realtimeSecret() {
  const configured = process.env.WEBSOCKET_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return 'c1rcle-realtime-development-secret-32';
  }
  throw new Error('WEBSOCKET_SESSION_SECRET is not configured');
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function mintRealtimeSession(uid: string, authTime: number) {
  const now = Math.floor(Date.now() / 1000);
  const claims: RealtimeClaims = {
    uid,
    authTime,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    jti: randomBytes(16).toString('hex'),
  };
  const payload = encode(claims);
  const signature = createHmac('sha256', realtimeSecret()).update(payload).digest('base64url');
  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    expiresInSeconds: SESSION_TTL_SECONDS,
  };
}

function verifyRealtimeSession(token: string): RealtimeClaims | null {
  const [payload, suppliedSignature, extra] = String(token || '').split('.');
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = createHmac('sha256', realtimeSecret())
    .update(payload)
    .digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (
      !claims.uid ||
      !claims.jti ||
      !Number.isFinite(claims.authTime) ||
      !Number.isFinite(claims.exp) ||
      now >= claims.exp
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

async function currentAccountAllowsSession(fastify: FastifyInstance, claims: RealtimeClaims) {
  const user = await fastify.auth.getUser(claims.uid);
  if (user.disabled) return false;
  const validAfterSeconds = user.tokensValidAfterTime
    ? Math.floor(new Date(user.tokensValidAfterTime).getTime() / 1000)
    : 0;
  return !validAfterSeconds || claims.authTime >= validAfterSeconds;
}

async function authorizeTopic(
  fastify: FastifyInstance,
  userId: string,
  rawTopic: string,
): Promise<boolean> {
  const match = TOPIC_PATTERN.exec(rawTopic);
  if (!match) return false;
  const [, kind, resourceId] = match;

  if (kind === 'partner') {
    const snapshot = await fastify.db
      .collection('partner_memberships')
      .where('uid', '==', userId)
      .where('partnerId', '==', resourceId)
      .limit(2)
      .get();
    return (
      snapshot.docs.length === 1 &&
      (snapshot.docs[0].data().isActive === true || snapshot.docs[0].data().status === 'active')
    );
  }

  if (kind === 'event-chat') {
    const snapshot = await fastify.db
      .collection('chatMembers')
      .where('eventId', '==', resourceId)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    return !snapshot.empty;
  }

  if (kind === 'dm') {
    const canonical = await fastify.db
      .collection('chatMembers')
      .doc(`${resourceId}_${userId}`)
      .get();
    if (canonical.exists && canonical.data()?.status === 'active') return true;
    const legacy = await fastify.db.collection('privateConversations').doc(resourceId).get();
    const data = legacy.data();
    return (
      legacy.exists &&
      data?.status === 'accepted' &&
      Array.isArray(data.participants) &&
      data.participants.includes(userId)
    );
  }

  const [memberSnapshot, eventDoc] = await Promise.all([
    fastify.db
      .collection('chatMembers')
      .where('eventId', '==', resourceId)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get(),
    fastify.db.collection('events').doc(resourceId).get(),
  ]);
  if (!memberSnapshot.empty) return true;
  if (!eventDoc.exists) return false;
  const event = eventDoc.data();
  const partnerIds = [event?.hostId, event?.venueId, event?.creatorId].filter(Boolean);
  if (!partnerIds.length) return false;
  const memberships = await fastify.db
    .collection('partner_memberships')
    .where('uid', '==', userId)
    .get();
  return memberships.docs.some((doc) => {
    const membership = doc.data();
    return (
      partnerIds.includes(membership.partnerId) &&
      (membership.isActive === true || membership.status === 'active')
    );
  });
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

  subRedis.on('message', (_channel: string, rawMessage: string) => {
    try {
      const { payload, topic } = JSON.parse(rawMessage) as { payload: unknown; topic?: string };
      if (!topic) return;
      const messageStr = JSON.stringify(payload);
      for (const client of clients) {
        if (client.userId && client.socket.readyState === 1 && client.subscriptions.has(topic)) {
          client.socket.send(messageStr);
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

  fastify.post(
    '/api/v1/realtime/session',
    { preHandler: [fastify.requireAuth] },
    async (request: any, reply) => {
      if (!request.user?.uid || request.authVerification?.revokedChecked !== true) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Verified authentication is required' },
        });
      }
      try {
        const authTime = Number(request.user.auth_time || Math.floor(Date.now() / 1000));
        return { success: true, data: mintRealtimeSession(request.user.uid, authTime) };
      } catch (error: any) {
        request.log.error({ error }, 'Realtime session minting unavailable');
        return reply.status(503).send({
          error: { code: 'REALTIME_UNAVAILABLE', message: 'Realtime is unavailable' },
        });
      }
    },
  );

  fastify.get('/ws/updates', { websocket: true }, async (connection) => {
    const client: WSClient = {
      socket: connection.socket,
      subscriptions: new Set<string>(),
      userId: null,
      claims: null,
      expiryTimer: null,
    };
    clients.add(client);

    connection.socket.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'AUTH') {
          if (client.userId) return;
          const claims = verifyRealtimeSession(data.token);
          if (!claims || !(await currentAccountAllowsSession(fastify, claims))) {
            connection.socket.close(4001, 'authentication_failed');
            return;
          }
          client.userId = claims.uid;
          client.claims = claims;
          client.expiryTimer = setTimeout(
            () => connection.socket.close(4001, 'session_expired'),
            Math.max(1, claims.exp * 1000 - Date.now()),
          );
          connection.socket.send(
            JSON.stringify({
              type: 'AUTH_SUCCESS',
              payload: { expiresAt: new Date(claims.exp * 1000).toISOString() },
            }),
          );
          return;
        }

        if (!client.userId || !client.claims) {
          connection.socket.close(4001, 'authentication_required');
          return;
        }

        if (data.type === 'SUBSCRIBE' && typeof data.topic === 'string') {
          const accountAllowed = await currentAccountAllowsSession(fastify, client.claims);
          const allowed =
            accountAllowed && (await authorizeTopic(fastify, client.userId, data.topic));
          if (!allowed) {
            connection.socket.send(
              JSON.stringify({
                type: 'SUBSCRIBE_DENIED',
                payload: { topic: data.topic, code: 'TOPIC_FORBIDDEN' },
              }),
            );
            return;
          }
          client.subscriptions.add(data.topic);
          connection.socket.send(
            JSON.stringify({ type: 'SUBSCRIBE_ACK', payload: { topic: data.topic } }),
          );
        } else if (data.type === 'UNSUBSCRIBE' && typeof data.topic === 'string') {
          client.subscriptions.delete(data.topic);
        } else if (data.type === 'ping') {
          connection.socket.send(JSON.stringify({ type: 'pong', payload: {} }));
        }
      } catch {
        connection.socket.close(4003, 'invalid_message');
      }
    });

    connection.socket.on('close', () => {
      if (client.expiryTimer) clearTimeout(client.expiryTimer);
      clients.delete(client);
    });

    connection.socket.send(
      JSON.stringify({ type: 'welcome', payload: { authenticationRequired: true } }),
    );
  });

  fastify.decorate('broadcast', (payload: unknown, topic?: string) => {
    if (!topic) {
      fastify.log.warn('Rejected realtime broadcast without an authorized topic');
      return;
    }
    if (fastify.redis && fastify.redis.status === 'ready') {
      fastify.redis.publish('C1RCLE_BROADCAST', JSON.stringify({ payload, topic }));
    } else {
      const messageStr = JSON.stringify(payload);
      for (const client of clients) {
        if (client.userId && client.socket.readyState === 1 && client.subscriptions.has(topic)) {
          client.socket.send(messageStr);
        }
      }
    }
  });

  fastify.addHook('onClose', async () => {
    await subRedis.quit();
    for (const client of clients) {
      if (client.expiryTimer) clearTimeout(client.expiryTimer);
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
