import fp from 'fastify-plugin';
import { ZodError } from 'zod';
/**
 * 🛡️ Centralized Zod Validation Plugin
 *
 * Enforces strict request validation.
 */
export default fp(async (fastify) => {
    fastify.decorate('validate', (schemas) => {
        return async (request, reply) => {
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
            }
            catch (error) {
                if (error instanceof ZodError) {
                    const zodError = error;
                    fastify.log.warn({
                        requestId: request.id,
                        url: request.url,
                        validationErrors: zodError.errors
                    }, 'Validation Failed');
                    return reply.status(400).send({
                        error: 'Bad Request',
                        message: 'Validation failed',
                        requestId: request.id,
                        details: (zodError.issues || []).map((e) => ({
                            path: (e.path || []).join('.'),
                            message: e.message
                        }))
                    });
                }
                throw error;
            }
        };
    });
    fastify.log.info('Validation schema plugin initialized');
});
//# sourceMappingURL=validate.js.map