import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  // Keep track of connected clients
  const clients = new Set<any>();

  fastify.get("/ws/updates", { websocket: true }, (connection, req) => {
    clients.add(connection.socket);
    fastify.log.info("New WebSocket client connected");

    connection.socket.on("close", () => {
      clients.delete(connection.socket);
      fastify.log.info("WebSocket client disconnected");
    });

    // Send initial welcome
    connection.socket.send(
      JSON.stringify({ type: "welcome", message: "Connected to C1RCLE Real-time" }),
    );
  });

  // Strategy for broadcasting:
  // This function can be called by other routes or Firestore listeners
  fastify.decorate("broadcast", (payload: any) => {
    const message = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === 1) {
        // OPEN
        client.send(message);
      }
    }
  });

  // Optional: Auto-broadcast Event changes (Listener)
  // In a production environment, you might want to listen to Firestore changes:
  /*
    fastify.db.collection('events').onSnapshot(snapshot => {
        fastify.broadcast({
            type: 'EVENT_UPDATE',
            count: snapshot.size
        });
    });
    */
});

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    broadcast: (payload: any) => void;
  }
}
