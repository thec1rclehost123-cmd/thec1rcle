import fp from 'fastify-plugin';
// @ts-ignore
import { inngest, sendEvent, Events } from '@c1rcle/core/inngest-client';

export default fp(async (fastify) => {
    fastify.decorate('inngest', inngest);
    fastify.decorate('sendInngestEvent', sendEvent);
    fastify.decorate('InngestEvents', Events);
});

declare module 'fastify' {
    interface FastifyInstance {
        inngest: any;
        sendInngestEvent: typeof sendEvent;
        InngestEvents: typeof Events;
    }
}
