import { FastifyInstance } from 'fastify';
import { hasStaffPermission } from '@c1rcle/core/staff-engine';
import { z } from 'zod';

const VenueQuerySchema = z.object({
    venueId: z.string()
}).strict();

const StaffIdParamSchema = z.object({
    id: z.string()
}).strict();

const ResolveQuerySchema = z.object({
    venueId: z.string(),
    membershipId: z.string()
}).strict();

const DEFAULT_PII_POLICY = {
    showPhone: false,
    showEmail: false,
    showLastName: true,
    showOrderAmount: false,
    showPayoutAmounts: false,
};

const OWNER_PII_POLICY = {
    showPhone: false,
    showEmail: false,
    showLastName: true,
    showOrderAmount: true,
    showPayoutAmounts: true,
};

const MANAGER_TABS = {
    overview: true,
    analytics: true,
    events: true,
    calendar: true,
    walk_ins: true,
    partnerships: true,
    staff: true,
    registers: true,
    guest_ops: true,
    page_management: true,
    settings: false,
    finance: false,
    door: true,
    partners: true,
    presence: true,
};

const STAFF_TABS = {
    overview: false,
    events: false,
    walk_ins: true,
    guest_ops: true,
    registers: true,
    analytics: false,
    finance: false,
    calendar: false,
    staff: false,
    settings: false,
    door: true,
    partners: false,
    presence: false,
};

const SECURITY_TABS = {
    guest_ops: true,
    walk_ins: true,
    registers: false,
    overview: false,
    analytics: false,
    events: false,
    finance: false,
    calendar: false,
    staff: false,
    settings: false,
    door: true,
    partners: false,
    presence: false,
};

const FINANCE_ADMIN_TABS = {
    finance: true,
    analytics: true,
    overview: true,
    events: false,
    calendar: false,
    walk_ins: false,
    staff: false,
    guest_ops: false,
    settings: false,
    door: false,
    partners: false,
    presence: false,
};

const ROLE_DEFAULT_TABS: Record<string, Record<string, boolean>> = {
    OWNER: {
        overview: true, analytics: true, events: true, finance: true, calendar: true,
        walk_ins: true, partnerships: true, staff: true, registers: true, page_management: true,
        settings: true, guest_ops: true, door: true, partners: true, presence: true, crm: true
    },
    MANAGER: MANAGER_TABS,
    FINANCE_ADMIN: FINANCE_ADMIN_TABS,
    STAFF: STAFF_TABS,
    SECURITY: SECURITY_TABS,
};

export default async function staffRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/venue/staff-profiles/resolve
     * Resolve effective profile permissions for a membership
     */
    fastify.get('/venue/staff-profiles/resolve', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: ResolveQuerySchema })]
    }, async (request: any, reply) => {
        const { venueId, membershipId } = request.query;
        const actorId = request.user?.uid;

        // RBAC: Verify actor is authorized
        const hasAccess = await hasStaffPermission(fastify.db, venueId, actorId, 'viewEvents');
        if (!hasAccess) {
            fastify.log.warn({ venueId, actorId, membershipId }, "🛡️ SECURITY ALERT: Cross-tenant staff resolution attempt blocked!");
            return reply.status(403).send({ error: "Unauthorized venue access" });
        }

        const memberDoc = await fastify.db.collection("partner_memberships").doc(membershipId).get();
        if (!memberDoc.exists) return reply.status(404).send({ error: "Membership not found" });

        const data = memberDoc.data()!;
        const baseRole = (data.role as string)?.toUpperCase() ?? "STAFF";

        if (data.staffProfileId) {
            const profileDoc = await fastify.db.collection("staff_profiles").doc(data.staffProfileId).get();
            if (profileDoc.exists && profileDoc.data()?.isActive) {
                const profile = profileDoc.data()!;
                return {
                    baseRole: profile.baseRole,
                    tabVisibility: profile.tabVisibility,
                    actionPermissions: profile.actionPermissions,
                    piiPolicy: profile.piiPolicy,
                    guestlistScope: profile.guestlistScope,
                    eventScope: profile.eventScope,
                };
            }
        }

        // Fall back to role defaults
        const pii = baseRole === "OWNER" ? OWNER_PII_POLICY : DEFAULT_PII_POLICY;
        return {
            baseRole,
            tabVisibility: ROLE_DEFAULT_TABS[baseRole] ?? {},
            actionPermissions: {},
            piiPolicy: pii,
            guestlistScope: baseRole === "OWNER" || baseRole === "MANAGER" ? "editable" : "read_only",
            eventScope: null,
        };
    });

    /**
     * GET /api/v1/venue/staff-profiles/:id
     * Fetch a specific staff profile by ID
     */
    fastify.get('/venue/staff-profiles/:id', {
        preHandler: [
            fastify.requireAuth,
            fastify.validate({ params: StaffIdParamSchema, querystring: VenueQuerySchema })
        ]
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { venueId } = request.query;
        const actorId = request.user?.uid;

        const hasAccess = await hasStaffPermission(fastify.db, venueId, actorId, 'viewEvents');
        if (!hasAccess) return reply.status(403).send({ error: "Unauthorized venue access" });

        const doc = await fastify.db.collection('staff_profiles').doc(id).get();
        if (!doc.exists || doc.data()?.venueId !== venueId) {
            return reply.status(404).send({ error: "Staff profile not found" });
        }

        return { id: doc.id, ...doc.data() };
    });
}
