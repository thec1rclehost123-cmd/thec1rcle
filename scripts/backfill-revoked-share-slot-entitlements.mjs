import { createHash } from 'node:crypto';
import { config } from 'dotenv';

const apply = process.argv.includes('--apply');
const envPath = process.argv.find((argument) => argument.startsWith('--env='))?.slice(6);
config({ path: envPath || './apps/api-gateway/.env.development' });

const { getAdminDb } = await import('../packages/core/admin.js');
const db = getAdminDb();
const bundlesSnapshot = await db.collection('share_bundles').get();
const candidates = [];

for (const bundleDoc of bundlesSnapshot.docs) {
  const bundle = bundleDoc.data();
  for (const slot of bundle.slots || []) {
    if (!['unclaimed', 'reclaimed'].includes(slot.claimStatus) || !slot.entitlementId) continue;
    const entitlementDoc = await db.collection('entitlements').doc(slot.entitlementId).get();
    const entitlement = entitlementDoc.exists ? entitlementDoc.data() : null;
    if (
      entitlement?.state === 'REVOKED' &&
      entitlement?.revokedReason === 'SHARE_REVOKED'
    ) {
      candidates.push({
        bundleId: bundleDoc.id,
        bundleOwnerId: bundle.userId,
        slotIndex: slot.slotIndex,
        entitlementId: entitlementDoc.id,
      });
    }
  }
}

if (apply) {
  for (const candidate of candidates) {
    await db.runTransaction(async (transaction) => {
      const bundleRef = db.collection('share_bundles').doc(candidate.bundleId);
      const sourceRef = db.collection('entitlements').doc(candidate.entitlementId);
      const replacementId = `ENT-RPL-${createHash('sha256')
        .update(`${candidate.bundleId}:${candidate.slotIndex}:${candidate.entitlementId}`)
        .digest('hex')
        .slice(0, 20)
        .toUpperCase()}`;
      const replacementRef = db.collection('entitlements').doc(replacementId);
      const [bundleDoc, sourceDoc, replacementDoc] = await Promise.all([
        transaction.get(bundleRef),
        transaction.get(sourceRef),
        transaction.get(replacementRef),
      ]);
      if (!bundleDoc.exists || !sourceDoc.exists) return;

      const bundle = bundleDoc.data();
      const source = sourceDoc.data();
      const currentSlot = (bundle.slots || []).find(
        (slot) => Number(slot.slotIndex) === Number(candidate.slotIndex),
      );
      if (
        !currentSlot ||
        currentSlot.entitlementId !== candidate.entitlementId ||
        !['unclaimed', 'reclaimed'].includes(currentSlot.claimStatus) ||
        source.state !== 'REVOKED' ||
        source.revokedReason !== 'SHARE_REVOKED'
      ) {
        return;
      }

      const now = new Date().toISOString();
      if (!replacementDoc.exists) {
        transaction.set(replacementRef, {
          ...source,
          id: replacementId,
          ownerUserId: bundle.userId || candidate.bundleOwnerId,
          state: 'ISSUED',
          issuedAt: now,
          scanCountUsed: 0,
          consumedAt: null,
          consumedBy: null,
          revokedAt: null,
          revokedReason: null,
          revokedBy: null,
          transferredTo: null,
          metadata: {
            ...source.metadata,
            replacedFrom: candidate.entitlementId,
            replacementReason: 'SHARE_REVOKED_BACKFILL',
          },
        });
      }
      transaction.update(bundleRef, {
        slots: (bundle.slots || []).map((slot) =>
          Number(slot.slotIndex) === Number(candidate.slotIndex)
            ? { ...slot, entitlementId: replacementId }
            : slot,
        ),
        updatedAt: now,
      });
    });
  }
}

console.log(
  JSON.stringify(
    {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
      bundlesScanned: bundlesSnapshot.size,
      candidates: candidates.length,
      applied: apply,
    },
    null,
    2,
  ),
);
