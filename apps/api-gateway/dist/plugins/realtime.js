import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
export default fp(async (fastify) => {
    const clients = new Set();
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    // Dedicated client for PUB/SUB (subscribers must have their own connection)
    const subRedis = new Redis(redisUrl);
    subRedis.on('message', (channel, message) => {
        if (channel === 'C1RCLE_BROADCAST') {
            try {
                const { payload, topic } = JSON.parse(message);
                const broadcastMessage = JSON.stringify(payload);
                for (const client of clients) {
                    if (client.socket.readyState === 1) {
                        if (!topic || client.subscriptions.has(topic)) {
                            client.socket.send(broadcastMessage);
                        }
                    }
                }
            }
            catch (e) {
                fastify.log.error('Failed to process Redis broadcast message');
            }
        }
    });
    await subRedis.subscribe('C1RCLE_BROADCAST');
    fastify.get('/ws/updates', { websocket: true }, (connection, req) => {
        const client = {
            socket: connection.socket,
            subscriptions: new Set()
        };
        clients.add(client);
        connection.socket.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'SUBSCRIBE' && data.topic) {
                    client.subscriptions.add(data.topic);
                }
                else if (data.type === 'UNSUBSCRIBE' && data.topic) {
                    client.subscriptions.delete(data.topic);
                }
            }
            catch (e) { }
        });
        connection.socket.on('close', () => {
            clients.delete(client);
        });
        connection.socket.send(JSON.stringify({ type: 'welcome', message: 'Connected to C1RCLE Real-time' }));
    });
    // Strategy for distributed broadcasting:
    // Publishes to Redis so all instances can see it
    fastify.decorate('broadcast', (payload, topic) => {
        if (fastify.redis && fastify.redis.status === 'ready') {
            fastify.redis.publish('C1RCLE_BROADCAST', JSON.stringify({ payload, topic }));
        }
        else {
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
//# sourceMappingURL=realtime.js.map