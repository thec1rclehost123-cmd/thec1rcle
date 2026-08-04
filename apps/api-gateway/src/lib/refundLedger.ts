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
    const outboxRef = refund.outboxEventId
      ? db.collection('domain_event_outbox').doc(String(refund.outboxEventId))
      : null;
    const [
      orderSnapshot,
      markerSnapshot,
      saleSnapshot,
      ticketsSnapshot,
      entitlementsSnapshot,
      coverWalletsSnapshot,
      outboxSnapshot,
    ] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(markerRef),
      transaction.get(db.collection('partner_ledger').where('orderId', '==', refund.orderId)),
      transaction.get(db.collection('tickets').where('orderId', '==', refund.orderId)),
      transaction.get(db.collection('entitlements').where('orderId', '==', refund.orderId)),
      transaction.get(db.collection('cover_wallets').where('orderId', '==', refund.orderId)),
      outboxRef ? transaction.get(outboxRef) : Promise.resolve(null),
    ]);
    if (!orderSnapshot.exists) {
      throw Object.assign(new Error('Refund order not found'), { code: 'ORDER_NOT_FOUND' });
    }
    const order = { id: orderSnapshot.id, ...orderSnapshot.data() } as Record<string, any>;
    const amountPaise = Number.isSafeInteger(refund.amountPaise)
      ? refund.amountPaise
      : Math.round(Number(refund.amount || 0) * 100);
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
          (refund.fullyRefunded ? entitlementsSnapshot.docs.length : requestedEntitlementIds.size))
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
          throw Object.assign(new Error('Refund ticket and entitlement mapping is inconsistent'), {
            code: 'REFUND_ADMISSION_MAPPING_INVALID',
          });
        }
      }
    }

    const coverWalletRows: Array<{
      document: any;
      transactionRef: any;
      transactionSnapshot: any;
    }> = [];
    if (revokeAdmission) {
      for (const ticket of ticketsToRevoke) {
        const ticketData = ticket.data();
        const matches = coverWalletsSnapshot.docs.filter((wallet: any) => {
          const data = wallet.data();
          return (
            String(data.tierId || '') === String(ticketData.tierId || '') &&
            Number(data.unitIndex) === Number(ticketData.slotIndex)
          );
        });
        if (matches.length > 1) {
          throw Object.assign(new Error('Refund Cover Wallet mapping is ambiguous'), {
            code: 'REFUND_COVER_WALLET_MAPPING_INVALID',
          });
        }
        if (matches.length === 1) {
          const document = matches[0];
          const transactionRef = document.ref
            .collection('txns')
            .doc(`REFUND-TERMINATION-${refundId}`);
          coverWalletRows.push({
            document,
            transactionRef,
            transactionSnapshot: await transaction.get(transactionRef),
          });
        }
      }
    }

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
    if (outboxRef) {
      if (!outboxSnapshot?.exists) {
        throw Object.assign(new Error('Refund outbox record not found'), {
          code: 'REFUND_OUTBOX_NOT_FOUND',
        });
      }
      transaction.update(outboxRef, {
        status: 'dispatched',
        providerRefundId,
        dispatchedAt: processedAt,
        leaseId: null,
        leaseExpiresAt: null,
        lastError: null,
        updatedAt: processedAt,
      });
    }

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
      for (const row of coverWalletRows) {
        const wallet = { id: row.document.id, ...row.document.data() } as Record<string, any>;
        const balancePaise = Number(wallet.currentBalancePaise);
        if (
          !Number.isSafeInteger(balancePaise) ||
          balancePaise < 0 ||
          !Number.isSafeInteger(Number(wallet.txnCount || 0))
        ) {
          throw Object.assign(new Error('Refund Cover Wallet monetary state is invalid'), {
            code: 'REFUND_COVER_WALLET_MAPPING_INVALID',
          });
        }
        const existingTransaction = row.transactionSnapshot.exists
          ? row.transactionSnapshot.data()
          : null;
        if (
          existingTransaction &&
          (existingTransaction.type !== 'REFUND_TERMINATION' ||
            existingTransaction.walletId !== wallet.id ||
            existingTransaction.refundId !== refundId ||
            existingTransaction.providerRefundId !== providerRefundId ||
            wallet.state !== 'TERMINATED' ||
            balancePaise !== 0 ||
            existingTransaction.amountPaise !== Number(wallet.totalRefundTerminatedPaise || 0))
        ) {
          throw Object.assign(new Error('Refund Cover Wallet artifact conflicts'), {
            code: 'REFUND_COVER_WALLET_MAPPING_INVALID',
          });
        }
        if (
          ['TERMINATED', 'EXPIRED'].includes(String(wallet.state).toUpperCase()) &&
          !existingTransaction
        ) {
          throw Object.assign(new Error('Refund Cover Wallet was already terminated differently'), {
            code: 'REFUND_COVER_WALLET_MAPPING_INVALID',
          });
        }
        if (!['ACTIVE', 'FROZEN', 'TERMINATED'].includes(String(wallet.state).toUpperCase())) {
          throw Object.assign(new Error('Refund Cover Wallet state is not finalizable'), {
            code: 'REFUND_COVER_WALLET_MAPPING_INVALID',
          });
        }
        if (!existingTransaction && balancePaise > 0) {
          transaction.create(row.transactionRef, {
            id: row.transactionRef.id,
            walletId: wallet.id,
            orderId: order.id,
            eventId: wallet.eventId,
            venueId: wallet.venueId,
            type: 'REFUND_TERMINATION',
            status: 'COMMITTED',
            idempotencyKey: `REFUND-TERMINATION-${refundId}`,
            refundId,
            providerRefundId,
            amountPaise: balancePaise,
            balanceAfterPaise: 0,
            operatorId: 'system',
            operatorName: 'system',
            operatorRole: 'system',
            deviceId: 'system',
            eventCodeId: 'system',
            createdAt: processedAt,
          });
        }
        if (!existingTransaction) {
          transaction.update(row.document.ref, {
            state: 'TERMINATED',
            currentBalancePaise: 0,
            totalRefundTerminatedPaise:
              Number(wallet.totalRefundTerminatedPaise || 0) + balancePaise,
            txnCount: Number(wallet.txnCount || 0) + (balancePaise > 0 ? 1 : 0),
            terminatedAt: processedAt,
            terminatedBy: 'refund_workflow',
            terminatedReason: 'ADMISSION_REFUND_PROCESSED',
            lastActivityAt: processedAt,
          });
        }
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
      coverWalletIds: revokeAdmission ? coverWalletRows.map((row) => row.document.id) : [],
    };
  });
}
