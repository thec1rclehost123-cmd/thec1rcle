import { Firestore, Transaction } from 'firebase-admin/firestore';
import { IOrderRepository, Order, Reservation, PaymentRecord, OrderIdentityLookup } from '../../../domain/repositories/order-repository.js';

export class FirebaseOrderRepository implements IOrderRepository {
    constructor(private db: Firestore) { }

    private paymentRecordDocId(orderId: string, razorpayOrderId: string): string {
        return `${orderId}__${razorpayOrderId}`;
    }

    async getOrderById(id: string): Promise<Order | null> {
        const doc = await this.db.collection('orders').doc(id).get();
        if (doc.exists) return { id: doc.id, ...doc.data() } as Order;

        const rsvpDoc = await this.db.collection('rsvp_orders').doc(id).get();
        if (rsvpDoc.exists) return { id: rsvpDoc.id, ...rsvpDoc.data() } as Order;

        return null;
    }

    async getOrderByReservationId(reservationId: string): Promise<Order | null> {
        const ordersSnapshot = await this.db.collection('orders')
            .where('reservationId', '==', reservationId)
            .limit(1)
            .get();

        if (!ordersSnapshot.empty) {
            const doc = ordersSnapshot.docs[0];
            return { id: doc.id, ...doc.data() } as Order;
        }

        const rsvpSnapshot = await this.db.collection('rsvp_orders')
            .where('reservationId', '==', reservationId)
            .limit(1)
            .get();

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

    async updateOrder(id: string, updates: Partial<Order>, isRSVP?: boolean, transaction?: Transaction): Promise<void> {
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

    async checkExistingRSVP(eventId: string, lookup: OrderIdentityLookup, transaction?: any): Promise<boolean> {
        if (!eventId || (!lookup.userId && !lookup.email)) return false;

        const read = (query: any) => transaction ? transaction.get(query) : query.get();

        if (lookup.userId) {
            const userSnapshot = await read(
                this.db.collection('rsvp_orders')
                    .where('eventId', '==', eventId)
                    .where('userId', '==', lookup.userId)
                    .where('status', '==', 'confirmed')
                    .limit(1)
            );
            if (!userSnapshot.empty) return true;
        }

        if (lookup.email) {
            const emailSnapshot = await read(
                this.db.collection('rsvp_orders')
                    .where('eventId', '==', eventId)
                    .where('userEmail', '==', lookup.email)
                    .where('status', '==', 'confirmed')
                    .limit(1)
            );
            if (!emailSnapshot.empty) return true;
        }

        return false;
    }

    async getUserTicketCountForEvent(eventId: string, lookup: OrderIdentityLookup): Promise<number> {
        if (!eventId || (!lookup.userId && !lookup.email)) return 0;

        const baseQuery = this.db.collection('orders')
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
            totalTickets += (order.tickets || []).reduce((sum, ticket) => sum + (Number(ticket.quantity) || 0), 0);
        }

        return totalTickets;
    }

    async getReservationById(id: string): Promise<Reservation | null> {
        const doc = await this.db.collection('cart_reservations').doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as Reservation;
    }

    async createReservation(reservation: Reservation): Promise<void> {
        await this.db.collection('cart_reservations').doc(reservation.id).set(reservation);
    }

    async updateReservation(id: string, updates: Partial<Reservation>, transaction?: Transaction): Promise<void> {
        const ref = this.db.collection('cart_reservations').doc(id);
        if (transaction) {
            transaction.update(ref, updates as any);
        } else {
            await ref.update(updates as any);
        }
    }

    async createPaymentRecord(payment: PaymentRecord): Promise<void> {
        await this.db.collection('payments')
            .doc(this.paymentRecordDocId(payment.orderId, payment.razorpayOrderId))
            .set(payment, { merge: true });
    }

    async updatePaymentRecord(orderId: string, razorpayOrderId: string, updates: Partial<PaymentRecord>, transaction?: Transaction): Promise<void> {
        const snapshot = await this.db.collection('payments')
            .where('orderId', '==', orderId)
            .where('razorpayOrderId', '==', razorpayOrderId)
            .limit(1)
            .get();

        if (snapshot.empty) throw new Error('Payment record not found');
        const ref = snapshot.docs[0].ref;

        if (transaction) {
            transaction.update(ref, updates as any);
        } else {
            await ref.update(updates as any);
        }
    }

    async getPaymentRecord(orderId: string, razorpayOrderId: string): Promise<PaymentRecord | null> {
        const snapshot = await this.db.collection('payments')
            .where('orderId', '==', orderId)
            .where('razorpayOrderId', '==', razorpayOrderId)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        return snapshot.docs[0].data() as PaymentRecord;
    }

    async getPaymentRecordByPaymentId(paymentId: string): Promise<PaymentRecord | null> {
        const snapshot = await this.db.collection('payments')
            .where('razorpayPaymentId', '==', paymentId)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        return snapshot.docs[0].data() as PaymentRecord;
    }

    async runInTransaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T> {
        return this.db.runTransaction(action);
    }
}
