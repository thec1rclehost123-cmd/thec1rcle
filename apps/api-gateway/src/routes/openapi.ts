import { FastifyInstance } from 'fastify';
import { guestV1OpenApi } from '../openapi/guest-v1';
import { v2PartnerOpenApi } from '../openapi/v2-partner';

export default async function openApiRoutes(fastify: FastifyInstance) {
  fastify.get('/openapi/guest-v1.json', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=60');
    return guestV1OpenApi;
  });

  fastify.get('/openapi/v2-partner.json', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=60');
    return v2PartnerOpenApi;
  });
}
