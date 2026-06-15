import { FastifyInstance } from 'fastify';
import { guestV1OpenApi } from '../openapi/guest-v1';

export default async function openApiRoutes(fastify: FastifyInstance) {
  fastify.get('/openapi/guest-v1.json', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=60');
    return guestV1OpenApi;
  });
}
