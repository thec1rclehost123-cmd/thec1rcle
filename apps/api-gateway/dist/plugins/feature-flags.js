import fp from 'fastify-plugin';
export default fp(async (fastify, opts) => {
    const defaults = opts.defaults || {};
    fastify.decorate('isFeatureEnabled', async (flag, defaultValue) => {
        // 1. Check Redis dynamically if cache plugin is available
        if (fastify.cache) {
            try {
                const cached = await fastify.cache.get('flags', flag);
                if (cached !== null && cached !== undefined) {
                    return cached === true || cached === 'true';
                }
            }
            catch (e) {
                // Ignore cache errors
            }
        }
        // 2. Check process.env (e.g. FF_NEW_DASHBOARD=true)
        const envKey = `FF_${flag.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
        if (process.env[envKey] !== undefined) {
            return process.env[envKey] === 'true';
        }
        // 3. Fallback
        if (defaultValue !== undefined)
            return defaultValue;
        if (defaults[flag] !== undefined)
            return defaults[flag];
        return false;
    });
});
//# sourceMappingURL=feature-flags.js.map