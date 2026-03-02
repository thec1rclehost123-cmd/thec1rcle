import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

export interface FeatureFlagsPluginOptions {
    defaults?: Record<string, boolean>;
}

export default fp(async (fastify: FastifyInstance, opts: FeatureFlagsPluginOptions) => {
    const defaults = opts.defaults || {};

    fastify.decorate('isFeatureEnabled', async (flag: string, defaultValue?: boolean): Promise<boolean> => {
        // 1. Check Redis dynamically if cache plugin is available
        if (fastify.cache) {
            try {
                const cached = await fastify.cache.get('flags', flag);
                if (cached !== null && cached !== undefined) {
                    return cached === true || cached === 'true';
                }
            } catch (e) {
                // Ignore cache errors
            }
        }

        // 2. Check process.env (e.g. FF_NEW_DASHBOARD=true)
        const envKey = `FF_${flag.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
        if (process.env[envKey] !== undefined) {
            return process.env[envKey] === 'true';
        }

        // 3. Fallback
        if (defaultValue !== undefined) return defaultValue;
        if (defaults[flag] !== undefined) return defaults[flag];

        return false;
    });
});

declare module 'fastify' {
    interface FastifyInstance {
        isFeatureEnabled: (flag: string, defaultValue?: boolean) => Promise<boolean>;
    }
}
