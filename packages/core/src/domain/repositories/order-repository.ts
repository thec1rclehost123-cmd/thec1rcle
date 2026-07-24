export interface Order {
  id: string;
  eventId: string;
  eventName: string;
  venueId?: string | null;
  hostId?: string | null;
  promoterLinkId?: string | null;
  sourceChannel?: string;
  workspaceId?: string | null;
  queueId?: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  tickets: {
    ticketId: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  discounts: any[];
  discountTotal: number;
  fees: any[];
  totalAmount: number;
  currency?: string;
  subtotalPaise?: number;
  discountPaise?: number;
  taxPaise?: number;
  platformFeePaise?: number;
  venueSharePaise?: number;
  promoterCommissionPaise?: number;
  hostPayoutPaise?: number;
  totalPaise?: number;
  financialSchemaVersion?: number;
  splitRuleSnapshot?: Record<string, unknown>;
  status: 'payment_pending' | 'confirmed' | 'cancelled';
  reservationId?: string;
  promoterCode?: string | null;
  promoterId?: string | null;
  source?: 'link' | 'promo_code' | 'manual' | null;
  createdAt: string;
  updatedAt?: string;
  confirmedAt?: string;
  isRSVP: boolean;
  paymentId?: string;
  paymentOrderId?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledByType?: string;
  refundPercentage?: number;
  refundStatus?: string;
  razorpayRefundId?: string | null;
}

export interface Reservation {
  id: string;
  eventId: string;
  workspaceId?: string | null;
  customerId: string;
  deviceId?: string | null;
  queueId?: string | null;
  items: any[];
  status: 'active' | 'expired' | 'converted' | 'released';
  createdAt: string;
  expiresAt: string;
  orderId?: string;
  convertedAt?: string;
  releasedAt?: string;
}

export interface PaymentRecord {
  orderId: string;
  razorpayOrderId: string;
  workspaceId?: string | null;
  /** @deprecated Read-only compatibility for payment records created before schema v2. */
  amount: number;
  amountPaise?: number;
  currency?: string;
  status: 'initiated' | 'verified' | 'failed' | 'captured_finalization_pending';
  userId: string;
  createdAt: string;
  razorpayPaymentId?: string;
  verifiedAt?: string;
  failedAt?: string;
}

export interface OrderIdentityLookup {
  userId?: string | null;
  email?: string | null;
}

export interface IOrderRepository {
  getOrderById(id: string, transaction?: any): Promise<Order | null>;
  getOrderByReservationId(reservationId: string, transaction?: any): Promise<Order | null>;
  createOrder(order: Order, transaction?: any): Promise<void>;
  updateOrder(
    id: string,
    updates: Partial<Order>,
    isRSVP?: boolean,
    transaction?: any,
  ): Promise<void>;
  checkExistingRSVP(
    eventId: string,
    lookup: OrderIdentityLookup,
    transaction?: any,
  ): Promise<boolean>;
  getUserTicketCountForEvent(eventId: string, lookup: OrderIdentityLookup): Promise<number>;

  getReservationById(id: string, transaction?: any): Promise<Reservation | null>;
  createReservation(reservation: Reservation): Promise<void>;
  updateReservation(id: string, updates: Partial<Reservation>, transaction?: any): Promise<void>;

  createPaymentRecord(payment: PaymentRecord): Promise<void>;
  updatePaymentRecord(
    orderId: string,
    razorpayOrderId: string,
    updates: Partial<PaymentRecord>,
    transaction?: any,
  ): Promise<void>;
  getPaymentRecord(
    orderId: string,
    razorpayOrderId: string,
    transaction?: any,
  ): Promise<PaymentRecord | null>;
  getLatestPendingPaymentRecord(orderId: string): Promise<PaymentRecord | null>;
  getPaymentRecordByPaymentId(paymentId: string, transaction?: any): Promise<PaymentRecord | null>;

  runInTransaction<T>(action: (transaction: any) => Promise<T>): Promise<T>;
}
