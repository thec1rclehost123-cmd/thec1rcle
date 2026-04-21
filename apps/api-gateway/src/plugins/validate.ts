import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { buildErrorResponse, buildValidationDetails } from '../lib/api-contracts';

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
export default fp(async (fastify: FastifyInstance) => {
    fastify.decorate('validate', (schemas: ValidationSchemas) => {
        return async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                if (schemas.body) {
                    request.body = await schemas.body.parseAsync(request.body);
                }
                if (schemas.querystring) {
                    request.query = await schemas.querystring.parseAsync(request.query);
                }
                if (schemas.params) {
                    request.params = await schemas.params.parseAsync(request.params);
                }
            } catch (error) {
                if (error instanceof ZodError) {
                    const zodError = error as any;
                    fastify.log.warn({
                        requestId: request.id,
                        url: request.url,
                        validationErrors: zodError.errors
                    }, 'Validation Failed');

                    return reply.status(400).send(buildErrorResponse({
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        requestId: request.id,
                        details: buildValidationDetails(zodError.issues || []),
                    }));
                }
                throw error;
            }
        };
    });

    fastify.log.info('Validation schema plugin initialized');
});

declare module 'fastify' {
    interface FastifyInstance {
        validate: (schemas: ValidationSchemas) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
