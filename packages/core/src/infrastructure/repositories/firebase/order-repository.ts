import { Firestore, Transaction } from 'firebase-admin/firestore';
import { IOrderRepository, Order, Reservation, PaymentRecord } from '../../../domain/repositories/order-repository.js';

export class FirebaseOrderRepository implements IOrderRepository {
    constructor(private db: Firestore) { }

    async getOrderById(id: string): Promise<Order | null> {
        const doc = await this.db.collection('orders').doc(id).get();
        if (doc.exists) return { id: doc.id, ...doc.data() } as Order;

        const rsvpDoc = await this.db.collection('rsvp_orders').doc(id).get();
        if (rsvpDoc.exists) return { id: rsvpDoc.id, ...rsvpDoc.data() } as Order;

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

    async updateOrder(id: string, updates: Partial<Order>, transaction?: Transaction): Promise<void> {
        // We need to know if it's RSVP or not to update the correct collection
        // Or we just check both. For simplicity in this implementation:
        const order = await this.getOrderById(id);
        if (!order) throw new Error('Order not found');

        const coll = order.isRSVP ? 'rsvp_orders' : 'orders';
        const ref = this.db.collection(coll).doc(id);
        if (transaction) {
            transaction.update(ref, updates as any);
        } else {
            await ref.update(updates as any);
        }
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
        await this.db.collection('payments').add(payment);
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

    async runInTransaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T> {
        return this.db.runTransaction(action);
    }
}
