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
            // 🛡️ SaaS: Workspace-level Role Check
            // @ts-ignore
            const workspaceId = request.workspaceId;
            let effectiveRole = user.role;
            if (workspaceId) {
                // In a production system, we would fetch the user's role specifically for this workspace
                // e.g. const membership = await fastify.db.collection('workspaces').doc(workspaceId).collection('members').doc(user.uid).get();
                // effectiveRole = membership.data()?.role || 'guest';
                // For now, if activeMembership matches the workspace, we use that role
                if (user.activeMembership?.partnerId === workspaceId) {
                    effectiveRole = user.activeMembership.role;
                }
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
            if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
                fastify.log.warn(`RBAC Denied: User ${user.uid} (Role: ${effectiveRole}) attempted to access restricted route requiring [${allowedRoles.join(', ')}] in workspace ${workspaceId || 'global'}.`);
                return reply.status(403).send({ error: "Forbidden: Insufficient permissions." });
            }
            // Access granted based on role
        };
    };
    fastify.decorate('requireRoles', requireRoles);
    fastify.log.info('RBAC security plugin initialized');
});
//# sourceMappingURL=rbac.js.map