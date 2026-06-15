import { INotificationRepository, Notification } from '../repositories/notification-repository.js';

async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 500) {
        if (i === maxRetries - 1) return response;
        // Exponential backoff
        await new Promise((res) => setTimeout(res, Math.pow(2, i) * 1000));
        continue;
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((res) => setTimeout(res, Math.pow(2, i) * 1000));
    }
  }
  throw new Error('Max retries reached');
}

export class NotificationService {
  constructor(private notificationRepo: INotificationRepository) {}

  async getVenueDashboard(
    venueId: string,
  ): Promise<{ notifications: Notification[]; unreadCount: number; total: number }> {
    const notifications = await this.notificationRepo.getVenueNotifications(venueId);

    // Sort by priority then date
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    notifications.sort((a, b) => {
      if (a.priority !== b.priority)
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    const unreadCount = notifications.filter((n) => !n.readAt).length;
    return { notifications, unreadCount, total: notifications.length };
  }

  async markAsRead(
    venueId: string,
    notificationId: string,
    type: string,
    markAllRead?: boolean,
  ): Promise<void> {
    if (markAllRead) {
      await this.notificationRepo.markAllAsRead(venueId);
    } else {
      await this.notificationRepo.markAsRead(venueId, notificationId, type);
    }
  }

  async performAction(notificationId: string, type: string, action: string): Promise<string> {
    return this.notificationRepo.performAction(notificationId, type, action);
  }

  async sendPushToFollowers(
    venueId: string,
    title: string,
    message: string,
    data: any,
  ): Promise<{ sentCount: number; userCount: number }> {
    const tokens = await this.notificationRepo.getFollowerTokens(venueId);
    if (tokens.length === 0) return { sentCount: 0, userCount: 0 };

    // Send to Expo Push (100 per chunk)
    const notifications = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body: message,
      data: { ...data, venueId },
    }));
    let sentCount = 0;

    for (let i = 0; i < notifications.length; i += 100) {
      const chunk = notifications.slice(i, i + 100);
      try {
        await fetchWithRetry('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });
        sentCount += chunk.length;
      } catch (error) {
        console.error('Failed to send push chunk:', error);
      }
    }

    return { sentCount: tokens.length, userCount: notifications.length }; // Approximation for userCount
  }
}
