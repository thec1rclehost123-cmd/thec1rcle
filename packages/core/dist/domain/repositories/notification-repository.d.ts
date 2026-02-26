export interface Notification {
    id: string;
    type: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    metadata: Record<string, any>;
    createdAt: string;
    readAt: string | null;
}
export interface INotificationRepository {
    getVenueNotifications(venueId: string): Promise<Notification[]>;
    markAsRead(venueId: string, notificationId: string, type: string): Promise<void>;
    markAllAsRead(venueId: string): Promise<void>;
    performAction(notificationId: string, type: string, action: string): Promise<string>;
    getFollowerTokens(venueId: string): Promise<string[]>;
}
