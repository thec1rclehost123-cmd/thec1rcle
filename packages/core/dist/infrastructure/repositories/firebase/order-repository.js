export class FirebaseOrderRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getOrderById(id) {
        const doc = await this.db.collection('orders').doc(id).get();
        if (doc.exists)
            return { id: doc.id, ...doc.data() };
        const rsvpDoc = await this.db.collection('rsvp_orders').doc(id).get();
        if (rsvpDoc.exists)
            return { id: rsvpDoc.id, ...rsvpDoc.data() };
        return null;
    }
    async createOrder(order, transaction) {
        const coll = order.isRSVP ? 'rsvp_orders' : 'orders';
        const ref = this.db.collection(coll).doc(order.id);
        if (transaction) {
            transaction.set(ref, order);
        }
        else {
            await ref.set(order);
        }
    }
    async updateOrder(id, updates, transaction) {
        // We need to know if it's RSVP or not to update the correct collection
        // Or we just check both. For simplicity in this implementation:
        const order = await this.getOrderById(id);
        if (!order)
            throw new Error('Order not found');
        const coll = order.isRSVP ? 'rsvp_orders' : 'orders';
        const ref = this.db.collection(coll).doc(id);
        if (transaction) {
            transaction.update(ref, updates);
        }
        else {
            await ref.update(updates);
        }
    }
    async getReservationById(id) {
        const doc = await this.db.collection('cart_reservations').doc(id).get();
        if (!doc.exists)
            return null;
        return { id: doc.id, ...doc.data() };
    }
    async createReservation(reservation) {
        await this.db.collection('cart_reservations').doc(reservation.id).set(reservation);
    }
    async updateReservation(id, updates, transaction) {
        const ref = this.db.collection('cart_reservations').doc(id);
        if (transaction) {
            transaction.update(ref, updates);
        }
        else {
            await ref.update(updates);
        }
    }
    async createPaymentRecord(payment) {
        await this.db.collection('payments').add(payment);
    }
    async updatePaymentRecord(orderId, razorpayOrderId, updates, transaction) {
        const snapshot = await this.db.collection('payments')
            .where('orderId', '==', orderId)
            .where('razorpayOrderId', '==', razorpayOrderId)
            .limit(1)
            .get();
        if (snapshot.empty)
            throw new Error('Payment record not found');
        const ref = snapshot.docs[0].ref;
        if (transaction) {
            transaction.update(ref, updates);
        }
        else {
            await ref.update(updates);
        }
    }
    async getPaymentRecord(orderId, razorpayOrderId) {
        const snapshot = await this.db.collection('payments')
            .where('orderId', '==', orderId)
            .where('razorpayOrderId', '==', razorpayOrderId)
            .limit(1)
            .get();
        if (snapshot.empty)
            return null;
        return snapshot.docs[0].data();
    }
    async runInTransaction(action) {
        return this.db.runTransaction(action);
    }
}
