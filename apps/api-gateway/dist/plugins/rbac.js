import fp from 'fastify-plugin';
export default fp(async (fastify, opts) => {
    /**
     * Middleware generator to restrict access to specific roles.
     * @param allowedRoles Array of roles permitted to access the route.
     * @param allowEntityOwner Optional function evaluating if the user owns the requested entity (bypasses role check).
     */
    const requireRoles = (allowedRoles, allowEntityOwner) => {
        return async (request, reply) => {
            // @ts-ignore - Assuming user and token are populated by the auth hook
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: "Unauthorized: No valid session found." });
            }
            // 1. Check if user is a verified Admin (Admins bypass all)
            if (user.role === 'admin') {
                return; // Access granted
            }
            // 2. Check Entity Ownership (e.g. User updating their own profile)
            if (allowEntityOwner) {
                try {
                    const isOwner = await allowEntityOwner(request);
                    if (isOwner)
                        return; // Access granted via ownership
                }
                catch (err) {
                    fastify.log.warn(`RBAC Entity Ownership check failed: ${err}`);
                }
            }
            // 3. Check Role Inclusion
            if (!user.role || !allowedRoles.includes(user.role)) {
                fastify.log.warn(`RBAC Denied: User ${user.uid} (Role: ${user.role}) attempted to access restricted route requiring [${allowedRoles.join(', ')}].`);
                return reply.status(403).send({ error: "Forbidden: Insufficient permissions." });
            }
            // Access granted based on role
        };
    };
    fastify.decorate('requireRoles', requireRoles);
    fastify.log.info('RBAC security plugin initialized');
});
//# sourceMappingURL=rbac.js.map