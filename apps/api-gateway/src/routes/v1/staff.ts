import { FastifyInstance } from 'fastify';
import { ROLE_PRESETS, hasStaffPermission } from '@c1rcle/core/staff-engine';
import { z } from 'zod';

const VenueQuerySchema = z.object({
    venueId: z.string()
}).strict();

const StaffInviteSchema = z.object({
    venueId: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.string()
}).strict();

const StaffIdParamSchema = z.object({
    id: z.string()
}).strict();

const StaffUpdateSchema = z.object({
    venueId: z.string(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    role: z.string().optional(),
    isActive: z.boolean().optional()
}).strict();

export default async function staffRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/venue/staff
     * List all staff members for a venue
     */
    fastify.get('/venue/staff', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueQuerySchema })]
    }, async (request: any, reply) => {
        const { venueId } = request.query;
        const actorId = request.user?.uid;

        if (!actorId) return reply.status(401).send({ error: "Unauthorized" });
        if (!venueId) return reply.status(400).send({ error: "venueId is required" });

        const snapshot = await fastify.db.collection('venue_staff')
            .where("venueId", "==", venueId)
            .where("userId", "==", actorId)
            .where("isActive", "==", true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { permissions: null, role: null };
        }

        const staffData = snapshot.docs[0].data();
        return {
            permissions: staffData.permissions,
            role: staffData.role
        };
    });

    /**
     * POST /api/v1/venue/staff
     * Invite a new staff member to a venue
     */
    fastify.post('/venue/staff', {
        preHandler: [
            fastify.validate({ body: StaffInviteSchema }),
            fastify.requireRoles(['admin', 'partner', 'host'])
        ]
    }, async (request: any, reply) => {
        const { venueId, email, name, role } = request.body;
        const actorId = request.user?.uid;

        // RBAC: Only manager or higher can invite
        const canInvite = await hasStaffPermission(fastify.db, venueId, actorId, 'manageStaff');
        if (!canInvite) {
            return reply.status(403).send({ error: "Insufficient permissions to invite staff" });
        }

        const now = new Date().toISOString();
        const staffMember = {
            venueId,
            email: email.toLowerCase().trim(),
            name: name.trim(),
            role,
            permissions: ROLE_PRESETS[role] || ROLE_PRESETS.viewer,
            isVerified: false,
            isActive: true,
            addedBy: actorId,
            createdAt: now,
            updatedAt: now
        };

        const docRef = await fastify.db.collection('venue_staff').add(staffMember);

        return { success: true, staffId: docRef.id, member: staffMember };
    });

    /**
     * GET /api/v1/venue/staff-profiles
     */
    fastify.get('/venue/staff-profiles', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueQuerySchema })]
    }, async (request: any, reply) => {
        const { venueId } = request.query;
        const actorId = request.user?.uid;

        try {
            const snapshot = await fastify.db.collection('staff_profiles')
                .where("venueId", "==", venueId)
                .get();

            const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { profiles };
        } catch (error: any) {
            return { profiles: [] };
        }
    });

    fastify.get('/venue/staff/permissions', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueQuerySchema })]
    }, async (request: any, reply) => {
        const { venueId } = request.query;
        const actorId = request.user?.uid;

        const hasAccess = await hasStaffPermission(fastify.db, venueId, actorId, 'viewEvents');
        if (!hasAccess) {
            return reply.status(403).send({ error: "Unauthorized venue access" });
        }

        const snapshot = await fastify.db.collection('venue_staff')
            .where("venueId", "==", venueId)
            .where("isActive", "==", true)
            .get();

        const staff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { staff };
    });

    /**
     * PATCH /api/v1/venue/staff
     * Update staff member
     */
    fastify.patch('/venue/staff', {
        preHandler: [
            fastify.validate({ params: StaffIdParamSchema, body: StaffUpdateSchema }),
            fastify.requireRoles(['admin', 'partner', 'host'])
        ]
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { venueId, ...updates } = request.body;
        const actorId = request.user?.uid;

        const canManage = await hasStaffPermission(fastify.db, venueId, actorId, 'manageStaff');
        if (!canManage) return reply.status(403).send({ error: "Unauthorized" });

        const { updateStaff } = await import('@c1rcle/core/staff-engine');
        await updateStaff(fastify.db, id, updates, { uid: actorId });

        return { success: true };
    });

    /**
     * DELETE /api/v1/staff/:id
     * Deactivate staff member
     */
    fastify.delete('/:id', {
        preHandler: [
            fastify.validate({ params: StaffIdParamSchema, querystring: VenueQuerySchema }),
            fastify.requireRoles(['admin', 'partner', 'host'])
        ]
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { venueId } = request.query;
        const actorId = request.user?.uid;

        const canManage = await hasStaffPermission(fastify.db, venueId, actorId, 'manageStaff');
        if (!canManage) return reply.status(403).send({ error: "Unauthorized" });

        await fastify.db.collection('venue_staff').doc(id).update({
            isActive: false,
            updatedAt: new Date().toISOString()
        });

        return { success: true };
    });
}
