import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

interface WSClient {
    socket: any;
    subscriptions: Set<string>;
}

export default fp(async (fastify: FastifyInstance) => {
    // Keep track of connected clients
    const clients = new Set<WSClient>();

    fastify.get('/ws/updates', { websocket: true }, (connection, req) => {
        const client: WSClient = {
            socket: connection.socket,
            subscriptions: new Set<string>()
        };
        clients.add(client);
        fastify.log.info('New WebSocket client connected');

        connection.socket.on('message', (message: string) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'SUBSCRIBE' && data.topic) {
                    client.subscriptions.add(data.topic);
                    fastify.log.info(`Client subscribed to topic: ${data.topic}`);
                } else if (data.type === 'UNSUBSCRIBE' && data.topic) {
                    client.subscriptions.delete(data.topic);
                    fastify.log.info(`Client unsubscribed from topic: ${data.topic}`);
                }
            } catch (e) {
                fastify.log.error('Invalid WS message received');
            }
        });

        connection.socket.on('close', () => {
            clients.delete(client);
            fastify.log.info('WebSocket client disconnected');
        });

        // Send initial welcome
        connection.socket.send(JSON.stringify({ type: 'welcome', message: 'Connected to C1RCLE Real-time' }));
    });

    // Strategy for selectively broadcasting:
    // This function can be called by other routes to emit targeted updates
    fastify.decorate('broadcast', (payload: any, topic?: string) => {
        const message = JSON.stringify(payload);
        for (const client of clients) {
            if (client.socket.readyState === 1) { // OPEN
                // If a topic is provided, only broadcast to clients subscribed to that topic
                if (!topic || client.subscriptions.has(topic)) {
                    client.socket.send(message);
                }
            }
        }
    });

    // Gracefully handle server shutdown
    fastify.addHook('onClose', (instance, done) => {
        fastify.log.info(`Closing ${clients.size} active WebSocket connections...`);
        for (const client of clients) {
            if (client.socket.readyState === 1) { // OPEN
                client.socket.close(1001, 'Server shutting down');
            }
        }
        clients.clear();
        done();
    });
});

// Extend Fastify types
declare module 'fastify' {
    interface FastifyInstance {
        broadcast: (payload: any, topic?: string) => void;
    }
}
