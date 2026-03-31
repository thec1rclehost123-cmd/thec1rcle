import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';

interface WSClient {
    socket: any;
    subscriptions: Set<string>;
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

    // ⚡ Resilience: Don't block startup on subscription
    subRedis.connect().then(() => {
        subRedis.subscribe('C1RCLE_BROADCAST').catch(err => {
            fastify.log.error(`Failed to subscribe to Redis broadcast: ${err.message}`);
        });
    }).catch(err => {
        fastify.log.warn('Realtime Redis connection skipped. Distributed broadcast disabled.');
    });

    fastify.get('/ws/updates', { websocket: true }, (connection, req) => {
        const client: WSClient = {
            socket: connection.socket,
            subscriptions: new Set<string>()
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
            } catch (e) {}
        });

        connection.socket.on('close', () => {
            clients.delete(client);
        });

        connection.socket.send(JSON.stringify({ type: 'welcome', message: 'Connected to C1RCLE Real-time' }));
    });

    // Strategy for distributed broadcasting:
    // Publishes to Redis so all instances can see it
    fastify.decorate('broadcast', (payload: any, topic?: string) => {
        if (fastify.redis && fastify.redis.status === 'ready') {
            fastify.redis.publish('C1RCLE_BROADCAST', JSON.stringify({ payload, topic }));
        } else {
            // Fallback for local-only if Redis is down
            const message = JSON.stringify(payload);
            for (const client of clients) {
                if (client.socket.readyState === 1) {
                    if (!topic || client.subscriptions.has(topic)) {
                        client.socket.send(message);
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

// Extend Fastify types
declare module 'fastify' {
    interface FastifyInstance {
        broadcast: (payload: any, topic?: string) => void;
    }
}
