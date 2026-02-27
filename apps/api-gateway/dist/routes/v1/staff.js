import { ROLE_PRESETS, hasStaffPermission } from '@c1rcle/core/staff-engine';
export default async function staffRoutes(fastify) {
    /**
     * GET /api/v1/staff/permissions
     * Returns staff permissions for a user at a specific venue
     */
    fastify.get('/permissions', async (request, reply) => {
        const { venueId } = request.query;
        const userId = request.user?.uid;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        if (!venueId)
            return reply.status(400).send({ error: "venueId is required" });
        const snapshot = await fastify.db.collection('venue_staff')
            .where("venueId", "==", venueId)
            .where("userId", "==", userId)
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
     * POST /api/v1/staff/invite
     * Invite a new staff member to a venue
     */
    fastify.post('/invite', async (request, reply) => {
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
     * GET /api/v1/staff/list
     * List all staff members for a venue
     */
    fastify.get('/list', async (request, reply) => {
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
     * PATCH /api/v1/staff/:id
     * Update staff member
     */
    fastify.patch('/:id', async (request, reply) => {
        const { id } = request.params;
        const { venueId, ...updates } = request.body;
        const actorId = request.user?.uid;
        const canManage = await hasStaffPermission(fastify.db, venueId, actorId, 'manageStaff');
        if (!canManage)
            return reply.status(403).send({ error: "Unauthorized" });
        const { updateStaff } = await import('@c1rcle/core/staff-engine');
        await updateStaff(fastify.db, id, updates, { uid: actorId });
        return { success: true };
    });
    /**
     * DELETE /api/v1/staff/:id
     * Deactivate staff member
     */
    fastify.delete('/:id', async (request, reply) => {
        const { id } = request.params;
        const { venueId } = request.query;
        const actorId = request.user?.uid;
        const canManage = await hasStaffPermission(fastify.db, venueId, actorId, 'manageStaff');
        if (!canManage)
            return reply.status(403).send({ error: "Unauthorized" });
        await fastify.db.collection('venue_staff').doc(id).update({
            isActive: false,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    });
}
//# sourceMappingURL=staff.js.map