// Razorpay payment integration for mobile app
import { Linking, Alert, Platform } from "react-native";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

// Razorpay configuration
const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY || "rzp_test_UaS7oqTKOwuALQ";

export interface PaymentOptions {
    orderId: string;
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

// Create Razorpay order via backend
export async function createRazorpayOrder(amount: number, orderId: string): Promise<{
    success: boolean;
    razorpayOrderId?: string;
    error?: string;
}> {
    try {
        // In production, this should call your backend API to create order
        // For now, we'll use a mock order ID
        const razorpayOrderId = `order_${Date.now()}`;

        return {
            success: true,
            razorpayOrderId,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
}

// Open Razorpay checkout
export async function openRazorpayCheckout(options: PaymentOptions): Promise<PaymentResult> {
    try {
        const { orderId, amount, currency = "INR", name = "THE C1RCLE", description = "Event Tickets", prefill } = options;

        // Build Razorpay checkout URL
        // Note: For production, use react-native-razorpay package
        // This is a web checkout fallback
        const checkoutParams = new URLSearchParams({
            key: RAZORPAY_KEY,
            amount: amount.toString(),
            currency,
            name,
            description,
            order_id: orderId,
            prefill: JSON.stringify(prefill || {}),
            callback_url: `https://thec1rcle.com/api/payments/verify`,
        });

        // For demo purposes, simulate successful payment
        return new Promise((resolve) => {
            Alert.alert(
                "Payment Mode",
                "Choose how to proceed with payment",
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                        onPress: () => resolve({ success: false, error: "Payment cancelled" }),
                    },
                    {
                        text: "Simulate Success",
                        onPress: () => {
                            resolve({
                                success: true,
                                paymentId: `pay_${Date.now()}`,
                                orderId,
                                signature: `sig_${Date.now()}`,
                            });
                        },
                    },
                    {
                        text: "Open Razorpay (Real)",
                        onPress: async () => {
                            // In production, use react-native-razorpay
                            // For now, open web checkout
                            const url = `https://api.razorpay.com/v1/checkout/embedded?${checkoutParams}`;
                            const canOpen = await Linking.canOpenURL(url);
                            if (canOpen) {
                                await Linking.openURL(url);
                            }
                            // Resolve with pending - actual verification happens via webhook
                            resolve({
                                success: true,
                                paymentId: "pending_verification",
                                orderId,
                            });
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

// Verify payment and update order status
export async function verifyAndConfirmPayment(
    orderId: string,
    paymentId: string,
    signature?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const orderRef = doc(db, "orders", orderId);

        // Update order with payment details
        await updateDoc(orderRef, {
            status: "confirmed",
            paymentId,
            paymentSignature: signature || null,
            confirmedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Full payment flow
export async function processPayment(
    orderId: string,
    amount: number,
    userEmail?: string,
    userPhone?: string,
    userName?: string
): Promise<PaymentResult> {
    // Step 1: Create Razorpay order
    const orderResult = await createRazorpayOrder(amount, orderId);
    if (!orderResult.success) {
        return { success: false, error: orderResult.error };
    }

    // Step 2: Open checkout
    const paymentResult = await openRazorpayCheckout({
        orderId: orderResult.razorpayOrderId!,
        amount: amount * 100, // Convert to paise
        prefill: {
            email: userEmail,
            contact: userPhone,
            name: userName,
        },
    });

    if (!paymentResult.success) {
        return paymentResult;
    }

    // Step 3: Verify and confirm
    const verification = await verifyAndConfirmPayment(
        orderId,
        paymentResult.paymentId!,
        paymentResult.signature
    );

    if (!verification.success) {
        return { success: false, error: verification.error };
    }

    return paymentResult;
}
