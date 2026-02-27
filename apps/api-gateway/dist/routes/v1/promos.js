import { upsertPromoCode, getPromoCodeById, getEventPromoCodes, validatePromoCode } from '@c1rcle/core/promo-service';
export default async function promoRoutes(fastify) {
    /**
     * GET /api/v1/promos/event/:eventId
     */
    fastify.get('/event/:eventId', async (request, reply) => {
        const { eventId } = request.params;
        try {
            return await getEventPromoCodes(eventId);
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/promos/:id
     */
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            return await getPromoCodeById(id);
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/promos
     */
    fastify.post('/', async (request, reply) => {
        const { eventId, codeData } = request.body;
        const user = request.user;
        try {
            return await upsertPromoCode(eventId, codeData, user);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/promos/validate
     */
    fastify.post('/validate', async (request, reply) => {
        const { eventId, code, userId, items } = request.body;
        try {
            return await validatePromoCode(eventId, code, userId, items);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=promos.js.map