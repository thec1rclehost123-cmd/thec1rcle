import { config } from 'dotenv';

const apply = process.argv.includes('--apply');
const envPath = process.argv.find((argument) => argument.startsWith('--env='))?.slice(6);
config({ path: envPath || './apps/api-gateway/.env.development' });

const { getAdminDb } = await import('../packages/core/admin.js');
const db = getAdminDb();
const assignmentsSnapshot = await db.collection('ticket_assignments').get();
const assignments = assignmentsSnapshot.docs
  .map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter((assignment) => assignment.bundleId && assignment.orderId && assignment.tierId);

const safe = (value) =>
  String(value || 'GEN')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
const ticketIdFor = (assignment) =>
  `TKT-${safe(assignment.orderId)}-${safe(assignment.tierId)}-${Number(
    assignment.slotIndex,
  )}`.toUpperCase();

const ownershipByTicket = new Map();
for (const assignment of assignments) {
  const ticketId = assignment.originalTicketId || ticketIdFor(assignment);
  const current = ownershipByTicket.get(ticketId);
  const isCurrent = assignment.status === 'active' || assignment.status === 'used';
  if (isCurrent || !current) ownershipByTicket.set(ticketId, { assignment, isCurrent });
}

const updates = [];
for (const [ticketId, ownership] of ownershipByTicket) {
  const ticketDoc = await db.collection('tickets').doc(ticketId).get();
  if (!ticketDoc.exists) continue;
  const ticket = ticketDoc.data();
  const desiredStatus = ownership.isCurrent ? 'shared' : 'active';
  if (
    ticket.status !== desiredStatus ||
    (ownership.isCurrent && ticket.sharedAssignmentId !== ownership.assignment.id)
  ) {
    updates.push({ ticketId, ...ownership, desiredStatus });
  }
}

if (apply) {
  for (let index = 0; index < updates.length; index += 400) {
    const batch = db.batch();
    for (const update of updates.slice(index, index + 400)) {
      batch.update(db.collection('tickets').doc(update.ticketId), {
        status: update.desiredStatus,
        sharedAssignmentId: update.isCurrent ? update.assignment.id : null,
        sharedToUserId: update.isCurrent ? update.assignment.redeemerId : null,
        sharedAt: update.isCurrent
          ? update.assignment.claimedAt || update.assignment.createdAt || null
          : null,
        updatedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }
}

console.log(
  JSON.stringify(
    {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
      assignmentsScanned: assignmentsSnapshot.size,
      shareAssignments: assignments.length,
      ticketUpdates: updates.length,
      applied: apply,
    },
    null,
    2,
  ),
);
