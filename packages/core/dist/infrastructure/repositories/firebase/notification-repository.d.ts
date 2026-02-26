import { Firestore } from 'firebase-admin/firestore';
import { INotificationRepository, Notification } from '../../../domain/repositories/notification-repository.js';
export declare class FirebaseNotificationRepository implements INotificationRepository {
    private db;
    constructor(db: Firestore);
    getVenueNotifications(venueId: string): Promise<Notification[]>;
    markAsRead(venueId: string, notificationId: string, type: string): Promise<void>;
    markAllAsRead(venueId: string): Promise<void>;
    performAction(notificationId: string, type: string, action: string): Promise<string>;
    getFollowerTokens(venueId: string): Promise<string[]>;
}
