import { FastifyInstance } from 'fastify';
import { z } from 'zod';
// @ts-ignore
import {
    getPromoterByUsername,
    getPromoterActiveEvents,
    getPromoterLinkByVanityAlias,
    trackPromoterLinkClick,
} from '@c1rcle/core/promoter-engine';

const PromoterUsernameParam = z.object({
    username: z.string().min(1),
}).strict();

const VanityAliasParam = z.object({
    username: z.string().min(1),
    alias: z.string().min(1),
}).strict();

export default async function guestPromoterRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/public/promoters/:username
     * Resolve a promoter's public profile + active events by vanity username.
     */
    fastify.get('/promoters/:username', {
        preHandler: [fastify.validate({ params: PromoterUsernameParam })],
    }, async (request: any, reply) => {
        try {
            const username = request.params.username.toLowerCase();
            const promoter = await getPromoterByUsername(username);
            if (!promoter) {
                return reply.status(404).send({ error: 'Promoter not found' });
            }

            const events = await getPromoterActiveEvents(promoter.id);

            return {
                success: true,
                promoter,
                events,
            };
        } catch (error: any) {
            request.log.error({ requestId: request.id, error: error.message }, 'GET /public/promoters/:username failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/v1/public/promoters/:username/links/:alias
     * Resolve a promoter vanity alias (e.g. /@handle/event-name) to the
     * underlying promoter link record containing eventId and ref code.
     */
    fastify.get('/promoters/:username/links/:alias', {
        preHandler: [fastify.validate({ params: VanityAliasParam })],
    }, async (request: any, reply) => {
        try {
            const username = request.params.username.toLowerCase();
            const alias = request.params.alias;

            const link = await getPromoterLinkByVanityAlias(username, alias);
            if (!link) {
                return reply.status(404).send({ error: 'Vanity link not found' });
            }

            // Fire-and-forget: track the click without blocking the redirect
            if (link.code) {
                trackPromoterLinkClick(link.code, { source: 'vanity-link' }).catch(() => {});
            }

            return {
                success: true,
                link,
            };
        } catch (error: any) {
            request.log.error({ requestId: request.id, error: error.message }, 'GET /public/promoters/:username/links/:alias failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
