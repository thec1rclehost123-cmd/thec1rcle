import { FastifyInstance } from 'fastify';
/**
 * 🛡️ Centralized Role-Based Access Control (RBAC) Middleware
 *
 * Enforces route-level permissions based on user roles and custom predicates.
 */
export type Role = 'admin' | 'partner' | 'host' | 'promoter' | 'user' | 'onboarding';
export interface RBACPluginOptions {
}
declare const _default: (fastify: FastifyInstance, opts: RBACPluginOptions) => Promise<void>;
export default _default;
declare module 'fastify' {
    interface FastifyInstance {
        requireRoles: (allowedRoles: Role[], allowEntityOwner?: (request: FastifyRequest) => Promise<boolean> | boolean) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
//# sourceMappingURL=rbac.d.ts.map