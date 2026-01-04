"use client";

import { useState, useEffect } from "react";
import { CreditCard, Loader2, CheckCircle, AlertCircle, Shield } from "lucide-react";

/**
 * Razorpay Checkout Component
 * Handles payment flow for paid tickets
 */
export default function RazorpayCheckout({
    orderId,
    amount,
    currency = "INR",
    userEmail,
    userName,
    userPhone,
    onSuccess,
    onError,
    onCancel
}) {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState(null);
    const [error, setError] = useState(null);

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);

        // Fetch Razorpay config
        fetch("/api/payments")
            .then(res => res.json())
            .then(data => setConfig(data.config))
            .catch(err => console.error("Failed to load payment config:", err));

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const initiatePayment = async () => {
        setLoading(true);
        setError(null);

        try {
            // Create Razorpay order
            const orderRes = await fetch("/api/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId })
            });

            if (!orderRes.ok) {
                const errData = await orderRes.json();
                throw new Error(errData.error || "Failed to create payment");
            }

            const orderData = await orderRes.json();

            // Open Razorpay checkout
            const options = {
                key: orderData.config.key,
                amount: orderData.amount * 100, // Razorpay expects paise
                currency: orderData.currency,
                name: orderData.config.name,
                description: orderData.config.description,
                image: orderData.config.image,
                order_id: orderData.razorpayOrderId,
                prefill: {
                    name: userName || orderData.config.prefill.name,
                    email: userEmail || orderData.config.prefill.email,
                    contact: userPhone || orderData.config.prefill.contact
                },
                theme: orderData.config.theme,
                handler: async function (response) {
                    // Verify payment
                    try {
                        const verifyRes = await fetch("/api/payments", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                orderId,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });

                        const verifyData = await verifyRes.json();

                        if (verifyRes.ok && verifyData.success) {
                            onSuccess?.(verifyData);
                        } else {
                            throw new Error(verifyData.error || "Payment verification failed");
                        }
                    } catch (verifyErr) {
                        setError(verifyErr.message);
                        onError?.(verifyErr);
                    }
                    setLoading(false);
                },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                        onCancel?.();
                    }
                }
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();
        } catch (err) {
            setError(err.message);
            onError?.(err);
            setLoading(false);
        }
    };

    const formatAmount = (amt) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currency | "INR"
        }).format(amt);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            {/* Payment Summary */}
            <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Payment Summary</h3>
                <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-slate-600">Amount to pay</span>
                    <span className="text-2xl font-bold text-slate-900">{formatAmount(amount)}</span>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Payment Error</p>
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                </div>
            )}

            {/* Pay Button */}
            <button
                onClick={initiatePayment}
                disabled={loading || !config}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-base flex items-center justify-center gap-3 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {loading ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        <CreditCard className="h-5 w-5" />
                        Pay {formatAmount(amount)}
                    </>
                )}
            </button>

            {/* Security Badge */}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Shield className="h-4 w-4" />
                <span>Secured by Razorpay</span>
            </div>

            {/* Payment Methods */}
            <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 text-center mb-3">Accepted payment methods</p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                    <img src="/icons/visa.svg" alt="Visa" className="h-6 opacity-60" onError={(e) => e.target.style.display = 'none'} />
                    <img src="/icons/mastercard.svg" alt="Mastercard" className="h-6 opacity-60" onError={(e) => e.target.style.display = 'none'} />
                    <img src="/icons/upi.svg" alt="UPI" className="h-6 opacity-60" onError={(e) => e.target.style.display = 'none'} />
                    <span className="text-xs text-slate-400">UPI • Cards • Net Banking</span>
                </div>
            </div>
        </div>
    );
}
