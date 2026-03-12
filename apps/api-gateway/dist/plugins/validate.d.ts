import { FastifyInstance } from 'fastify';
import { ZodSchema } from 'zod';
export interface ValidationSchemas {
    body?: ZodSchema;
    querystring?: ZodSchema;
    params?: ZodSchema;
}
/**
 * 🛡️ Centralized Zod Validation Plugin
 *
 * Enforces strict request validation.
 */
declare const _default: (fastify: FastifyInstance) => Promise<void>;
export default _default;
declare module 'fastify' {
    interface FastifyInstance {
        validate: (schemas: ValidationSchemas) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
//# sourceMappingURL=validate.d.ts.map