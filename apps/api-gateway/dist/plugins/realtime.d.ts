import { FastifyInstance } from 'fastify';
declare const _default: (fastify: FastifyInstance) => Promise<void>;
export default _default;
declare module 'fastify' {
    interface FastifyInstance {
        broadcast: (payload: any, topic?: string) => void;
    }
}
//# sourceMappingURL=realtime.d.ts.map