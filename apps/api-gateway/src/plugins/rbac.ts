import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * 🛡️ Centralized Role-Based Access Control (RBAC) Middleware
 * 
 * Enforces route-level permissions based on user roles and custom predicates.
 */

export type Role = 'admin' | 'partner' | 'host' | 'promoter' | 'user' | 'onboarding';

export interface RBACPluginOptions {
    // Add any global RBAC options here if needed
}

export default fp(async (fastify: FastifyInstance, opts: RBACPluginOptions) => {
    /**
     * Middleware generator to restrict access to specific roles.
     * @param allowedRoles Array of roles permitted to access the route.
     * @param allowEntityOwner Optional function evaluating if the user owns the requested entity (bypasses role check).
     */
    const requireRoles = (
        allowedRoles: Role[],
        allowEntityOwner?: (request: FastifyRequest) => Promise<boolean> | boolean
    ) => {
        return async (request: FastifyRequest, reply: FastifyReply) => {
            // @ts-ignore - Assuming user and token are populated by the auth hook
            const user = request.user;

            if (!user) {
                return reply.status(401).send({ error: "Unauthorized: No valid session found." });
            }

            // 1. Check if user is a verified Admin (Admins bypass role check — always audit-logged)
            if (user.role === 'admin') {
                fastify.log.warn({
                    uid: user.uid,
                    route: `${request.method} ${request.url}`,
                    ip: request.ip,
                }, 'AUDIT: Admin role bypass used');
                return;
            }

            // 🛡️ SaaS: Workspace-level Role Check
            // @ts-ignore
            const workspaceId = request.workspaceId;
            let effectiveRole = user.role;
            const activeMembership = request.authContext?.activeMembership || user.activeMembership || null;

            if (workspaceId) {
                try {
                    const memberDoc = await (fastify as any).db
                        .collection('partner_memberships')
                        .doc(`${workspaceId}:${user.uid}`)
                        .get();
                    if (!memberDoc.exists || memberDoc.data()?.isActive === false) {
                        fastify.log.warn(`RBAC: workspace access revoked for user ${user.uid} in workspace ${workspaceId}`);
                        return reply.status(403).send({ error: "Forbidden: Workspace access has been revoked." });
                    }
                    effectiveRole = memberDoc.data()?.role || effectiveRole;
                } catch (err) {
                    fastify.log.error(`RBAC workspace role fetch failed for user ${user.uid}: ${err}`);
                    return reply.status(403).send({ error: "Forbidden: Could not verify workspace permissions." });
                }
            }

            // 2. Check Entity Ownership (e.g. User updating their own profile)
            if (allowEntityOwner) {
                try {
                    const isOwner = await allowEntityOwner(request);
                    if (isOwner) return; // Access granted via ownership
                } catch (err) {
                    fastify.log.warn(`RBAC Entity Ownership check failed: ${err}`);
                }
            }

            // 3. Check Role Inclusion
            if (!effectiveRole || !allowedRoles.includes(effectiveRole as Role)) {
                fastify.log.warn(`RBAC Denied: User ${user.uid} (Role: ${effectiveRole}) attempted to access restricted route requiring [${allowedRoles.join(', ')}] in workspace ${workspaceId || 'global'}.`);
                return reply.status(403).send({ error: "Forbidden: Insufficient permissions." });
            }

            // Access granted based on role
        };
    };

    fastify.decorate('requireRoles', requireRoles);
    fastify.log.info('RBAC security plugin initialized');
});

declare module 'fastify' {
    interface FastifyInstance {
        requireRoles: (
            allowedRoles: Role[],
            allowEntityOwner?: (request: FastifyRequest) => Promise<boolean> | boolean
        ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
