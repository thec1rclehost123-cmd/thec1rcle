import { IOrderRepository } from '../repositories/order-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';
export declare class CheckoutService {
    private orderRepo;
    private eventRepo;
    constructor(orderRepo: IOrderRepository, eventRepo: IEventRepository);
    validatePricing(params: any, workspaceId: string): Promise<any>;
    reserveItems(eventId: string, userId: string, deviceId: string | null, items: any[], workspaceId: string): Promise<any>;
    initiateCheckout(params: {
        reservationId: string;
        userId: string;
        userName: string;
        userEmail: string;
        userPhone: string;
        promoCode?: string;
        promoterCode?: string;
    }, workspaceId: string): Promise<any>;
    preparePayment(orderId: string, userId: string, razorpayConfig: any): Promise<any>;
    verifyPayment(params: {
        orderId: string;
        razorpayOrderId: string;
        razorpayPaymentId: string;
        userId: string;
    }): Promise<void>;
    cancelCheckout(reservationId: string, orderId?: string): Promise<any>;
}
