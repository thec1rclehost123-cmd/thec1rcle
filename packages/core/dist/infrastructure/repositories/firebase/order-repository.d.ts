import { Firestore, Transaction } from 'firebase-admin/firestore';
import { IOrderRepository, Order, Reservation, PaymentRecord } from '../../../domain/repositories/order-repository.js';
export declare class FirebaseOrderRepository implements IOrderRepository {
    private db;
    constructor(db: Firestore);
    getOrderById(id: string): Promise<Order | null>;
    createOrder(order: Order, transaction?: Transaction): Promise<void>;
    updateOrder(id: string, updates: Partial<Order>, isRSVP?: boolean, transaction?: Transaction): Promise<void>;
    getReservationById(id: string): Promise<Reservation | null>;
    createReservation(reservation: Reservation): Promise<void>;
    updateReservation(id: string, updates: Partial<Reservation>, transaction?: Transaction): Promise<void>;
    createPaymentRecord(payment: PaymentRecord): Promise<void>;
    updatePaymentRecord(orderId: string, razorpayOrderId: string, updates: Partial<PaymentRecord>, transaction?: Transaction): Promise<void>;
    getPaymentRecord(orderId: string, razorpayOrderId: string): Promise<PaymentRecord | null>;
    runInTransaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T>;
}
