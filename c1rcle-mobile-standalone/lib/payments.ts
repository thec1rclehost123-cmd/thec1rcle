// Razorpay payment integration for mobile app
import { Linking, Alert, Platform } from "react-native";
import { verifyPayment } from "./api/ticketing";

// Razorpay configuration
const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_UaS7oqTKOwuALQ";

export interface PaymentOptions {
    razorpayOrderId: string;
    amount: number; // in paise (₹100 = 10000)
    currency?: string;
    name?: string;
    description?: string;
    prefill?: {
        email?: string;
        contact?: string;
        name?: string;
    };
}

export interface PaymentResult {
    success: boolean;
    paymentId?: string;
    orderId?: string;
    signature?: string;
    error?: string;
}

/**
 * Open Razorpay checkout
 * In production this would use react-native-razorpay native module.
 * For now we use the web fallback or simulation.
 */
export async function openRazorpayCheckout(options: PaymentOptions, orderId: string): Promise<PaymentResult> {
    try {
        const { razorpayOrderId, amount, currency = "INR", name = "THE C1RCLE", description = "Event Tickets", prefill } = options;

        // For demo purposes, simulate successful payment if in development
        // or if explicitly asked for simulation.
        // In a real build, we would use the native SDK.

        return new Promise((resolve) => {
            Alert.alert(
                "Payment",
                `Pay ₹${(amount / 100).toFixed(2)} for your tickets?`,
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                        onPress: () => resolve({ success: false, error: "Payment cancelled" }),
                    },
                    {
                        text: "Simulate Success",
                        onPress: async () => {
                            const paymentData = {
                                orderId: orderId, // Our internal order ID
                                razorpay_order_id: razorpayOrderId,
                                razorpay_payment_id: `pay_${Date.now()}`,
                                razorpay_signature: `sig_${Date.now()}`,
                            };

                            // Call verification API
                            const verification = await verifyPayment(paymentData);

                            if (verification.success) {
                                resolve({
                                    success: true,
                                    paymentId: paymentData.razorpay_payment_id,
                                    orderId,
                                    signature: paymentData.razorpay_signature,
                                });
                            } else {
                                resolve({ success: false, error: verification.error });
                            }
                        },
                    },
                ]
            );
        });
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Full payment flow integration for components
 */
export async function processPaymentFlow(
    orderId: string, // Internal Order ID
    razorpayInfo: { orderId: string; amount: number; currency: string },
    userDetails: { email?: string; contact?: string; name?: string }
): Promise<PaymentResult> {

    // Open checkout
    const paymentResult = await openRazorpayCheckout({
        razorpayOrderId: razorpayInfo.orderId,
        amount: razorpayInfo.amount,
        currency: razorpayInfo.currency,
        prefill: userDetails,
    }, orderId);

    return paymentResult;
}
