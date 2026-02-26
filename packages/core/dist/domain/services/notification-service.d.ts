import { INotificationRepository, Notification } from '../repositories/notification-repository.js';
export declare class NotificationService {
    private notificationRepo;
    constructor(notificationRepo: INotificationRepository);
    getVenueDashboard(venueId: string): Promise<{
        notifications: Notification[];
        unreadCount: number;
        total: number;
    }>;
    markAsRead(venueId: string, notificationId: string, type: string, markAllRead?: boolean): Promise<void>;
    performAction(notificationId: string, type: string, action: string): Promise<string>;
    sendPushToFollowers(venueId: string, title: string, message: string, data: any): Promise<{
        sentCount: number;
        userCount: number;
    }>;
}
