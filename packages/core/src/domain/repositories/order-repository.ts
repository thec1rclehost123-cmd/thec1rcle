export interface Order {
    id: string;
    eventId: string;
    eventName: string;
    venueId?: string | null;
    workspaceId?: string | null;
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
    status: 'payment_pending' | 'confirmed' | 'cancelled';
    reservationId?: string;
    promoterCode?: string | null;
    createdAt: string;
    updatedAt?: string;
    confirmedAt?: string;
    isRSVP: boolean;
    paymentId?: string;
    paymentOrderId?: string;
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
    amount: number;
    status: 'initiated' | 'verified' | 'failed';
    userId: string;
    createdAt: string;
    razorpayPaymentId?: string;
    verifiedAt?: string;
}

export interface IOrderRepository {
    getOrderById(id: string): Promise<Order | null>;
    createOrder(order: Order, transaction?: any): Promise<void>;
    updateOrder(id: string, updates: Partial<Order>, isRSVP?: boolean, transaction?: any): Promise<void>;

    getReservationById(id: string): Promise<Reservation | null>;
    createReservation(reservation: Reservation): Promise<void>;
    updateReservation(id: string, updates: Partial<Reservation>, transaction?: any): Promise<void>;

    createPaymentRecord(payment: PaymentRecord): Promise<void>;
    updatePaymentRecord(orderId: string, razorpayOrderId: string, updates: Partial<PaymentRecord>, transaction?: any): Promise<void>;
    getPaymentRecord(orderId: string, razorpayOrderId: string): Promise<PaymentRecord | null>;
    getPaymentRecordByPaymentId(paymentId: string): Promise<PaymentRecord | null>;

    runInTransaction<T>(action: (transaction: any) => Promise<T>): Promise<T>;
}
