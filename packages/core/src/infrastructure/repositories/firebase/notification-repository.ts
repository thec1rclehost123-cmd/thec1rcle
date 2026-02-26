import { Firestore } from 'firebase-admin/firestore';
import { INotificationRepository, Notification } from '../../../domain/repositories/notification-repository.js';

export class FirebaseNotificationRepository implements INotificationRepository {
    constructor(private db: Firestore) { }

    async getVenueNotifications(venueId: string): Promise<Notification[]> {
        const [
            connectionsSnap,
            slotRequestsSnap,
            eventsSnap,
            ordersSnap,
            payoutsSnap,
            reservationsSnap
        ] = await Promise.all([
            this.db.collection('promoter_connections').where('venueId', '==', venueId).where('status', '==', 'pending').get(),
            this.db.collection('slot_requests').where('venueId', '==', venueId).where('status', '==', 'pending').get(),
            this.db.collection('events').where('venueId', '==', venueId).where('lifecycle', '==', 'submitted').get(),
            this.db.collection('orders').where('venueId', '==', venueId).orderBy('createdAt', 'desc').limit(20).get(),
            this.db.collection('payouts').where('venueId', '==', venueId).where('status', 'in', ['pending', 'processing']).get(),
            this.db.collection('table_reservations').where('venueId', '==', venueId).where('status', '==', 'pending').get()
        ]);

        const notifications: Notification[] = [];

        connectionsSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            notifications.push({
                id: doc.id, type: 'connection_request', priority: 'high',
                title: 'New Promoter Connection Request',
                message: `${d.promoterName || 'A promoter'} wants to connect`,
                metadata: { connectionId: doc.id, promoterId: d.promoterId },
                createdAt: d.requestedAt || d.createdAt, readAt: d.venueReadAt || null
            });
        });

        slotRequestsSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            notifications.push({
                id: doc.id, type: 'slot_request', priority: 'high',
                title: 'New Slot Request',
                message: `${d.promoterName || 'Promoter'} requested ${d.date || 'a slot'}`,
                metadata: { slotRequestId: doc.id, promoterId: d.promoterId, date: d.date },
                createdAt: d.requestedAt || d.createdAt, readAt: d.venueReadAt || null
            });
        });

        eventsSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            notifications.push({
                id: doc.id, type: 'event_review', priority: 'medium',
                title: 'Event Pending Review',
                message: `"${d.title}" requires your approval`,
                metadata: { eventId: doc.id, hostId: d.hostId },
                createdAt: d.submittedAt || d.createdAt, readAt: d.venueReadAt || null
            });
        });

        ordersSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            if (d.status === 'confirmed' || d.status === 'paid') {
                notifications.push({
                    id: doc.id, type: 'new_order', priority: 'low',
                    title: 'New Ticket Order',
                    message: `${d.userName || 'Guest'} purchased ${d.tickets?.[0]?.name || 'a ticket'}`,
                    metadata: { orderId: doc.id, eventId: d.eventId, amount: d.total },
                    createdAt: d.confirmedAt || d.createdAt, readAt: d.venueReadAt || null
                });
            }
        });

        payoutsSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            notifications.push({
                id: doc.id, type: 'payout', priority: 'medium',
                title: 'Payout Processing',
                message: `₹${d.amount || 0} payout is ${d.status}`,
                metadata: { payoutId: doc.id, amount: d.amount, status: d.status },
                createdAt: d.createdAt, readAt: d.venueReadAt || null
            });
        });

        reservationsSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            notifications.push({
                id: doc.id, type: 'table_reservation', priority: 'high',
                title: 'New Table Reservation',
                message: `${d.guestName || 'Guest'} - ${d.partySize || 1} guests, Table ${d.tableNumber || '?'}`,
                metadata: { reservationId: doc.id, guestName: d.guestName, partySize: d.partySize },
                createdAt: d.requestedAt || d.createdAt, readAt: d.venueReadAt || null
            });
        });

        return notifications;
    }

    async markAsRead(venueId: string, notificationId: string, type: string): Promise<void> {
        const typeToCollection: Record<string, string> = {
            connection_request: 'promoter_connections',
            slot_request: 'slot_requests',
            event_review: 'events',
            new_order: 'orders',
            payout: 'payouts',
            table_reservation: 'table_reservations'
        };
        const coll = typeToCollection[type];
        if (!coll) throw new Error('Unknown notification type');
        await this.db.collection(coll).doc(notificationId).update({
            venueReadAt: new Date().toISOString()
        });
    }

    async markAllAsRead(venueId: string): Promise<void> {
        const now = new Date().toISOString();
        const collectionMap: Record<string, string[]> = {
            promoter_connections: ['venueId', 'pending'],
            slot_requests: ['venueId', 'pending'],
            events: ['venueId', 'pending_review'],
        };
        await Promise.all(
            Object.keys(collectionMap).map(async (coll) => {
                const snap = await this.db.collection(coll).where('venueId', '==', venueId).get();
                const batch = this.db.batch();
                snap.docs.forEach((d: any) => { if (!d.data().venueReadAt) batch.update(d.ref, { venueReadAt: now }); });
                await batch.commit();
            })
        );
    }

    async performAction(notificationId: string, type: string, action: string): Promise<string> {
        const now = new Date().toISOString();
        if (type === 'connection_request') {
            const newStatus = action === 'approve' ? 'active' : 'rejected';
            await this.db.collection('promoter_connections').doc(notificationId).update({ status: newStatus, resolvedAt: now, venueReadAt: now });
            return newStatus;
        }
        if (type === 'slot_request') {
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            await this.db.collection('slot_requests').doc(notificationId).update({ status: newStatus, resolvedAt: now, venueReadAt: now });
            return newStatus;
        }
        if (type === 'table_reservation') {
            const newStatus = action === 'approve' ? 'confirmed' : 'rejected';
            await this.db.collection('table_reservations').doc(notificationId).update({ status: newStatus, resolvedAt: now, venueReadAt: now });
            return newStatus;
        }
        throw new Error('Unsupported notification type for action');
    }

    async getFollowerTokens(venueId: string): Promise<string[]> {
        const followsSnap = await this.db.collection('venue_follows').where('venueId', '==', venueId).get();
        const userIds = followsSnap.docs.map((d: any) => d.data().userId);
        if (userIds.length === 0) return [];

        const tokens: string[] = [];
        for (let i = 0; i < userIds.length; i += 30) {
            const batch = userIds.slice(i, i + 30);
            const usersSnap = await this.db.collection('users').where('__name__', 'in', batch).get();
            usersSnap.docs.forEach((doc: any) => {
                const ud = doc.data();
                if (Array.isArray(ud.pushTokens)) tokens.push(...ud.pushTokens);
            });
        }
        return tokens;
    }
}
