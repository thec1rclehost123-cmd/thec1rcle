import { Firestore, Transaction } from 'firebase-admin/firestore';
import {
  FreeTicketClaim,
  IOrderRepository,
  Order,
  Reservation,
  PaymentRecord,
  OrderIdentityLookup,
} from '../../../domain/repositories/order-repository.js';
import { createHash } from 'node:crypto';

export class FirebaseOrderRepository implements IOrderRepository {
  constructor(private db: Firestore) {}

  private freeTicketClaimDocId(eventId: string, tierId: string, userId: string): string {
    return createHash('sha256').update(`${eventId}\0${tierId}\0${userId}`).digest('hex');
  }

  private paymentRecordDocId(orderId: string, razorpayOrderId: string): string {
    return `${orderId}__${razorpayOrderId}`;
  }

  async getOrderById(id: string, transaction?: Transaction): Promise<Order | null> {
    const orderRef = this.db.collection('orders').doc(id);
    const doc = transaction ? await transaction.get(orderRef) : await orderRef.get();
    if (doc.exists) return { id: doc.id, ...doc.data() } as Order;

    const rsvpRef = this.db.collection('rsvp_orders').doc(id);
    const rsvpDoc = transaction ? await transaction.get(rsvpRef) : await rsvpRef.get();
    if (rsvpDoc.exists) return { id: rsvpDoc.id, ...rsvpDoc.data() } as Order;

    return null;
  }

  async getOrderByReservationId(
    reservationId: string,
    transaction?: Transaction,
  ): Promise<Order | null> {
    const ordersQuery = this.db
      .collection('orders')
      .where('reservationId', '==', reservationId)
      .limit(1);
    const ordersSnapshot = transaction
      ? await transaction.get(ordersQuery)
      : await ordersQuery.get();

    if (!ordersSnapshot.empty) {
      const doc = ordersSnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Order;
    }

    const rsvpQuery = this.db
      .collection('rsvp_orders')
      .where('reservationId', '==', reservationId)
      .limit(1);
    const rsvpSnapshot = transaction ? await transaction.get(rsvpQuery) : await rsvpQuery.get();

    if (!rsvpSnapshot.empty) {
      const doc = rsvpSnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Order;
    }

    return null;
  }

  async createOrder(order: Order, transaction?: Transaction): Promise<void> {
    const coll = order.isRSVP ? 'rsvp_orders' : 'orders';
    const ref = this.db.collection(coll).doc(order.id);
    if (transaction) {
      transaction.set(ref, order);
    } else {
      await ref.set(order);
    }
  }

  async updateOrder(
    id: string,
    updates: Partial<Order>,
    isRSVP?: boolean,
    transaction?: Transaction,
  ): Promise<void> {
    // 🚀 Optimization: Eliminate diagnostic read if isRSVP is provided
    let coll: string;
    if (isRSVP !== undefined) {
      coll = isRSVP ? 'rsvp_orders' : 'orders';
    } else {
      // Fallback: check only if necessary (legacy/unknown calls)
      const order = await this.getOrderById(id);
      if (!order) throw new Error('Order not found');
      coll = order.isRSVP ? 'rsvp_orders' : 'orders';
    }

    const ref = this.db.collection(coll).doc(id);
    if (transaction) {
      transaction.update(ref, updates as any);
    } else {
      await ref.update(updates as any);
    }
  }

  async checkExistingRSVP(
    eventId: string,
    lookup: OrderIdentityLookup,
    transaction?: any,
  ): Promise<boolean> {
    if (!eventId || (!lookup.userId && !lookup.email)) return false;

    const read = (query: any) => (transaction ? transaction.get(query) : query.get());

    if (lookup.userId) {
      const userSnapshot = await read(
        this.db
          .collection('rsvp_orders')
          .where('eventId', '==', eventId)
          .where('userId', '==', lookup.userId)
          .where('status', '==', 'confirmed')
          .limit(1),
      );
      if (!userSnapshot.empty) return true;
    }

    if (lookup.email) {
      const emailSnapshot = await read(
        this.db
          .collection('rsvp_orders')
          .where('eventId', '==', eventId)
          .where('userEmail', '==', lookup.email)
          .where('status', '==', 'confirmed')
          .limit(1),
      );
      if (!emailSnapshot.empty) return true;
    }

    return false;
  }

  async getUserTicketCountForEvent(eventId: string, lookup: OrderIdentityLookup): Promise<number> {
    if (!eventId || (!lookup.userId && !lookup.email)) return 0;

    const baseQuery = this.db
      .collection('orders')
      .where('eventId', '==', eventId)
      .where('status', '==', 'confirmed');

    const userSnapshot = lookup.userId
      ? await baseQuery.where('userId', '==', lookup.userId).get()
      : { docs: [] as any[] };
    const emailSnapshot = lookup.email
      ? await baseQuery.where('userEmail', '==', lookup.email).get()
      : { docs: [] as any[] };

    const seenOrderIds = new Set<string>();
    let totalTickets = 0;

    for (const doc of [...userSnapshot.docs, ...emailSnapshot.docs]) {
      if (seenOrderIds.has(doc.id)) continue;
      seenOrderIds.add(doc.id);
      const order = doc.data() as Order;
      totalTickets += (order.tickets || []).reduce(
        (sum, ticket) => sum + (Number(ticket.quantity) || 0),
        0,
      );
    }

    return totalTickets;
  }

  async checkExistingFreeTicketClaim(
    eventId: string,
    tierId: string,
    userId: string,
    transaction?: Transaction,
  ): Promise<boolean> {
    const claimRef = this.db
      .collection('free_ticket_claims')
      .doc(this.freeTicketClaimDocId(eventId, tierId, userId));
    const claimSnapshot = transaction ? await transaction.get(claimRef) : await claimRef.get();
    if (claimSnapshot.exists && claimSnapshot.data()?.status !== 'cancelled') return true;

    // Legacy fallback: claims created before the uniqueness collection existed
    // are detected from the user's confirmed orders. Querying by userId alone
    // avoids requiring a new composite index in the checkout transaction.
    const legacyQuery = this.db.collection('orders').where('userId', '==', userId).limit(200);
    const legacySnapshot = transaction
      ? await transaction.get(legacyQuery)
      : await legacyQuery.get();
    return legacySnapshot.docs.some((doc) => {
      const order = doc.data() as Order;
      if (order.eventId !== eventId || order.status !== 'confirmed') return false;
      return (order.tickets || []).some(
        (ticket) => ticket.ticketId === tierId && Number(ticket.price || 0) <= 0,
      );
    });
  }

  async createFreeTicketClaim(claim: FreeTicketClaim, transaction?: Transaction): Promise<void> {
    const claimRef = this.db
      .collection('free_ticket_claims')
      .doc(this.freeTicketClaimDocId(claim.eventId, claim.tierId, claim.userId));
    if (transaction) {
      transaction.set(claimRef, claim);
    } else {
      await claimRef.set(claim);
    }
  }

  async getReservationById(id: string, transaction?: Transaction): Promise<Reservation | null> {
    const ref = this.db.collection('cart_reservations').doc(id);
    const doc = transaction ? await transaction.get(ref) : await ref.get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Reservation;
  }

  async createReservation(reservation: Reservation): Promise<void> {
    await this.db.collection('cart_reservations').doc(reservation.id).set(reservation);
  }

  async updateReservation(
    id: string,
    updates: Partial<Reservation>,
    transaction?: Transaction,
  ): Promise<void> {
    const ref = this.db.collection('cart_reservations').doc(id);
    if (transaction) {
      transaction.update(ref, updates as any);
    } else {
      await ref.update(updates as any);
    }
  }

  async createPaymentRecord(payment: PaymentRecord): Promise<void> {
    await this.db
      .collection('payments')
      .doc(this.paymentRecordDocId(payment.orderId, payment.razorpayOrderId))
      .set(payment, { merge: true });
  }

  async updatePaymentRecord(
    orderId: string,
    razorpayOrderId: string,
    updates: Partial<PaymentRecord>,
    transaction?: Transaction,
  ): Promise<void> {
    const docId = this.paymentRecordDocId(orderId, razorpayOrderId);
    const directRef = this.db.collection('payments').doc(docId);
    const directSnapshot = transaction ? await transaction.get(directRef) : await directRef.get();
    const ref = directSnapshot.exists
      ? directRef
      : await this.resolveLegacyPaymentRecordRef(orderId, razorpayOrderId, transaction);

    if (!ref) throw new Error('Payment record not found');

    if (transaction) {
      transaction.update(ref, updates as any);
    } else {
      await ref.update(updates as any);
    }
  }

  async getPaymentRecord(
    orderId: string,
    razorpayOrderId: string,
    transaction?: Transaction,
  ): Promise<PaymentRecord | null> {
    const directRef = this.db
      .collection('payments')
      .doc(this.paymentRecordDocId(orderId, razorpayOrderId));
    const directSnapshot = transaction ? await transaction.get(directRef) : await directRef.get();

    if (directSnapshot.exists) {
      return directSnapshot.data() as PaymentRecord;
    }

    const query = this.db
      .collection('payments')
      .where('orderId', '==', orderId)
      .where('razorpayOrderId', '==', razorpayOrderId)
      .limit(1);
    const snapshot = transaction ? await transaction.get(query) : await query.get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as PaymentRecord;
  }

  async getLatestPendingPaymentRecord(orderId: string): Promise<PaymentRecord | null> {
    const snapshot = await this.db
      .collection('payments')
      .where('orderId', '==', orderId)
      .where('status', '==', 'initiated')
      .get();

    if (snapshot.empty) return null;
    return (
      snapshot.docs
        .map((doc) => doc.data() as PaymentRecord)
        .sort((left, right) => {
          const leftTs = Date.parse(String(left.createdAt || 0));
          const rightTs = Date.parse(String(right.createdAt || 0));
          return rightTs - leftTs;
        })[0] || null
    );
  }

  async getPaymentRecordByPaymentId(
    paymentId: string,
    transaction?: Transaction,
  ): Promise<PaymentRecord | null> {
    const query = this.db
      .collection('payments')
      .where('razorpayPaymentId', '==', paymentId)
      .limit(1);
    const snapshot = transaction ? await transaction.get(query) : await query.get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as PaymentRecord;
  }

  async runInTransaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.runTransaction(action);
  }

  private async resolveLegacyPaymentRecordRef(
    orderId: string,
    razorpayOrderId: string,
    transaction?: Transaction,
  ) {
    const query = this.db
      .collection('payments')
      .where('orderId', '==', orderId)
      .where('razorpayOrderId', '==', razorpayOrderId)
      .limit(1);
    const snapshot = transaction ? await transaction.get(query) : await query.get();

    return snapshot.empty ? null : snapshot.docs[0].ref;
  }
}
