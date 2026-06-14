import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';

interface WSClient {
    socket: any;
    subscriptions: Set<string>;
    userId: string | null;
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

    subRedis.connect().then(() => {
        subRedis.subscribe('C1RCLE_BROADCAST').catch(err => {
            fastify.log.error(`Failed to subscribe to Redis broadcast: ${err.message}`);
        });
    }).catch(() => {
        fastify.log.warn('Realtime Redis connection skipped. Distributed broadcast disabled.');
    });

    fastify.get('/ws/updates', { websocket: true }, async (connection, req) => {
        let userId: string | null = null;
        const token = (req.query as Record<string, string>)?.token;
        if (token) {
            try {
                const decoded = await (fastify as any).auth.verifyIdToken(token);
                userId = decoded.uid;
            } catch { /* anonymous connection — allowed */ }
        }

        const client: WSClient = {
            socket: connection.socket,
            subscriptions: new Set<string>(),
            userId,
        };
        clients.add(client);

        connection.socket.on('message', (message: string) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'SUBSCRIBE' && data.topic) {
                    client.subscriptions.add(data.topic);
                } else if (data.type === 'UNSUBSCRIBE' && data.topic) {
                    client.subscriptions.delete(data.topic);
                }
            } catch {}
        });

        connection.socket.on('close', () => {
            clients.delete(client);
        });

        connection.socket.send(JSON.stringify({ type: 'welcome', message: 'Connected to C1RCLE Real-time' }));
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
