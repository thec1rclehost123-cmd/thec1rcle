export const v2PartnerOpenApi = {
  openapi: '3.1.0',
  info: {
    title: 'C1RCLE Partner API v2',
    version: '2.0.0',
    description: 'Partner-facing Fastify contract for v2 endpoints.',
  },
  servers: [{ url: '/api/v2/partner' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      StandardErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
  },
  paths: {},
} as const;

export type V2PartnerOpenApi = typeof v2PartnerOpenApi;
