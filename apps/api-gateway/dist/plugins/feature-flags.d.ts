import { FastifyInstance } from 'fastify';
export interface FeatureFlagsPluginOptions {
    defaults?: Record<string, boolean>;
}
declare const _default: (fastify: FastifyInstance, opts: FeatureFlagsPluginOptions) => Promise<void>;
export default _default;
declare module 'fastify' {
    interface FastifyInstance {
        isFeatureEnabled: (flag: string, defaultValue?: boolean) => Promise<boolean>;
    }
}
//# sourceMappingURL=feature-flags.d.ts.map