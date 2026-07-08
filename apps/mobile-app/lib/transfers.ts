// Ticket transfer service (server-authoritative via API Gateway)
import {
  initiateFormalTransfer,
  acceptFormalTransfer,
  cancelFormalTransfer,
  getPendingFormalTransfers,
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
 * This is the canonical entry point for all transfers.
 */
export async function initiateTransfer(
  ticketId: string,
  fromUserId: string,
  ticketDetails: { tierName: string; quantity: number } | { name: string; quantity: number },
  recipientEmail?: string,
  recipientPhone?: string,
): Promise<{
  success: boolean;
  transferId?: string;
  transferCode?: string;
  expiresAt?: string;
  error?: string;
  premiumRequired?: boolean;
}> {
  try {
    const result = await initiateFormalTransfer({
      ticketId,
      recipientEmail,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Transfer failed' };
    }
    return {
      success: true,
      transferId: result.transfer?.id,
      transferCode: result.transfer?.token,
      expiresAt: result.transfer?.expiresAt,
    };
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
 * Fetch pending transfers via Gateway, filtered to valid (non-expired) entries.
 */
export async function getPendingTransfers(userId: string): Promise<Transfer[]> {
  try {
    const response = await getPendingFormalTransfers();
    const transfers: Transfer[] = response?.transfers || [];
    const now = Date.now();
    return transfers.filter((t: Transfer) => {
      if (!t.expiresAt) return true;
      return new Date(t.expiresAt).getTime() > now;
    });
  } catch (error) {
    return [];
  }
}
