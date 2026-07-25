import type { Firestore } from 'firebase-admin/firestore';
import { writePartnerRefundInTransaction } from '@c1rcle/core/partner-ledger-service';

type RefundFinalizationInput = {
  db: Firestore;
  refundId: string;
  providerRefundId: string;
  processedAt?: string;
};

/**
 * Finalizes a provider-confirmed refund exactly once. The refund request,
 * order state, admission revocation, canonical ledger rows, idempotency marker,
 * and ledger aggregates are committed in one Firestore transaction.
 */
export async function finalizeProcessedRefund({
  db,
  refundId,
  providerRefundId,
  processedAt = new Date().toISOString(),
}: RefundFinalizationInput) {
  const refundRef = db.collection('refund_requests').doc(refundId);
  const markerRef = db.collection('partner_ledger_idempotency').doc(`refund_${refundId}`);

  return db.runTransaction(async (transaction: any) => {
    const refundSnapshot = await transaction.get(refundRef);
    if (!refundSnapshot.exists) {
      throw Object.assign(new Error('Refund request not found'), { code: 'REFUND_NOT_FOUND' });
    }
    const refund = { id: refundSnapshot.id, ...refundSnapshot.data() } as Record<string, any>;
    if (refund.razorpayRefundId && refund.razorpayRefundId !== providerRefundId) {
      throw Object.assign(new Error('Refund is linked to another provider refund'), {
        code: 'LEDGER_IDEMPOTENCY_CONFLICT',
      });
    }

    const orderRef = db.collection('orders').doc(String(refund.orderId));
    const [orderSnapshot, markerSnapshot, saleSnapshot, ticketsSnapshot, entitlementsSnapshot] =
      await Promise.all([
        transaction.get(orderRef),
        transaction.get(markerRef),
        transaction.get(db.collection('partner_ledger').where('orderId', '==', refund.orderId)),
        transaction.get(db.collection('tickets').where('orderId', '==', refund.orderId)),
        transaction.get(db.collection('entitlements').where('orderId', '==', refund.orderId)),
      ]);
    if (!orderSnapshot.exists) {
      throw Object.assign(new Error('Refund order not found'), { code: 'ORDER_NOT_FOUND' });
    }
    const order = { id: orderSnapshot.id, ...orderSnapshot.data() } as Record<string, any>;
    const amountPaise = Number.isSafeInteger(refund.amountPaise)
      ? refund.amountPaise
      : Math.round(Number(refund.amount || 0) * 100);
    const ledger = writePartnerRefundInTransaction({
      db,
      transaction,
      order,
      refundId,
      providerRefundId,
      amountPaise,
      createdAt: processedAt,
      markerSnapshot,
      saleEntries: saleSnapshot.docs.map((document: any) => ({
        id: document.id,
        ...document.data(),
      })),
    });

    const revokeAdmission = refund.revokeAdmission === true || refund.fullyRefunded === true;
    const requestedTicketIds = new Set(
      Array.isArray(refund.ticketIds)
        ? refund.ticketIds.map(String)
        : Array.isArray(refund.refundedTicketIds)
          ? refund.refundedTicketIds.map(String)
          : [],
    );
    const requestedEntitlementIds = new Set(
      Array.isArray(refund.entitlementIds)
        ? refund.entitlementIds.map(String)
        : Array.isArray(refund.refundedEntitlementIds)
          ? refund.refundedEntitlementIds.map(String)
          : [],
    );
    if (
      revokeAdmission &&
      refund.fullyRefunded !== true &&
      (requestedTicketIds.size === 0 || requestedEntitlementIds.size === 0)
    ) {
      throw Object.assign(
        new Error('Partial admission refund requires exact ticket and entitlement IDs'),
        { code: 'REFUND_ADMISSION_MAPPING_REQUIRED' },
      );
    }

    const ticketsToRevoke = refund.fullyRefunded
      ? ticketsSnapshot.docs
      : ticketsSnapshot.docs.filter((ticket: any) => requestedTicketIds.has(ticket.id));
    const entitlementsToRevoke = refund.fullyRefunded
      ? entitlementsSnapshot.docs
      : entitlementsSnapshot.docs.filter((entitlement: any) =>
          requestedEntitlementIds.has(entitlement.id),
        );
    if (
      revokeAdmission &&
      (ticketsToRevoke.length !==
        (refund.fullyRefunded ? ticketsSnapshot.docs.length : requestedTicketIds.size) ||
        entitlementsToRevoke.length !==
          (refund.fullyRefunded
            ? entitlementsSnapshot.docs.length
            : requestedEntitlementIds.size))
    ) {
      throw Object.assign(new Error('Refund admission mapping does not belong to this order'), {
        code: 'REFUND_ADMISSION_MAPPING_INVALID',
      });
    }

    if (refund.fullyRefunded !== true) {
      const selectedTicketIds = new Set(ticketsToRevoke.map((ticket: any) => ticket.id));
      for (const entitlement of entitlementsToRevoke) {
        const ticketDocumentId = String(entitlement.data()?.ticketDocumentId || '');
        if (!selectedTicketIds.has(ticketDocumentId)) {
          throw Object.assign(
            new Error('Refund ticket and entitlement mapping is inconsistent'),
            { code: 'REFUND_ADMISSION_MAPPING_INVALID' },
          );
        }
      }
    }
    const terminalOrderStatus =
      refund.terminalOrderStatus ||
      (refund.fullyRefunded ? 'refunded' : refund.previousStatus || 'confirmed');
    transaction.update(refundRef, {
      status: 'completed',
      razorpayRefundId: providerRefundId,
      ledgerMarkerId: ledger.markerId,
      completedAt: processedAt,
      updatedAt: processedAt,
    });
    transaction.update(orderRef, {
      status: terminalOrderStatus,
      refundStatus: 'completed',
      razorpayRefundId: providerRefundId,
      refundLedgerMarkerId: ledger.markerId,
      updatedAt: processedAt,
    });

    if (revokeAdmission) {
      for (const ticket of ticketsToRevoke) {
        transaction.update(ticket.ref, {
          status: 'refunded',
          revokedAt: processedAt,
          revokedReason: 'REFUND_PROCESSED',
          updatedAt: processedAt,
        });
      }
      for (const entitlement of entitlementsToRevoke) {
        transaction.update(entitlement.ref, {
          state: 'REVOKED',
          revokedAt: processedAt,
          revokedReason: 'REFUND_PROCESSED',
          updatedAt: processedAt,
        });
      }
    }

    return {
      orderId: order.id,
      refundId,
      providerRefundId,
      ledgerMarkerId: ledger.markerId,
      alreadyFinalized: ledger.alreadyPosted,
      ticketIds: revokeAdmission ? ticketsToRevoke.map((document: any) => document.id) : [],
      entitlementIds: revokeAdmission
        ? entitlementsToRevoke.map((document: any) => document.id)
        : [],
    };
  });
}
