// Ticket transfer service (server-authoritative via API Gateway)
import {
  apiFetch,
  initiateFormalTransfer,
  acceptFormalTransfer,
  cancelFormalTransfer,
} from './api';

export interface Transfer {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId?: string;
  toEmail?: string;
  toPhone?: string;
  ticketDetails: {
    tierName: string;
    quantity: number;
  };
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  transferCode: string;
  createdAt: any;
  expiresAt: any;
}

/**
 * Initiate ticket transfer via API Gateway.
 * Replaces the direct Cloud Function call.
 */
export async function initiateTransfer(
  orderId: string,
  fromUserId: string,
  ticketDetails: { tierName: string; quantity: number } | { name: string; quantity: number },
  recipientEmail?: string,
  recipientPhone?: string,
): Promise<{
  success: boolean;
  transferId?: string;
  transferCode?: string;
  error?: string;
  premiumRequired?: boolean;
}> {
  try {
    // We use the Gateway's initiateFormalTransfer wrapper in api.ts
    const result = await initiateFormalTransfer({
      ticketId: orderId, // The Gateway currently expects ticketId which we map to orderId or specific ID
      recipientEmail,
    });

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      ...(error.code === 'PREMIUM_REQUIRED' ? { premiumRequired: true } : {}),
    };
  }
}

/**
 * Accept transfer via API Gateway.
 */
export async function acceptTransfer(
  transferCode: string,
  recipientUserId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await acceptFormalTransfer({ transferCode });
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Cancel transfer via API Gateway (auth required).
 */
export async function cancelTransfer(
  transferId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await cancelFormalTransfer({ transferId });
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch pending transfers via Gateway.
 */
export async function getPendingTransfers(userId: string): Promise<Transfer[]> {
  try {
    const response = await apiFetch<{ transfers: Transfer[] }>('/api/v1/tickets/transfer/pending');
    return response.transfers || [];
  } catch (error) {
    return [];
  }
}
