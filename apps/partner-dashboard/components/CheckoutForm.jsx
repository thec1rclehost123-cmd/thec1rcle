"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { CreditCard, Smartphone, Building2, ArrowLeft, Lock, CheckCircle2 } from "lucide-react";

import { useAuth } from "./providers/AuthProvider";

export default function CheckoutForm({ event, selectedTickets, totalAmount }) {
    const router = useRouter();
    const { user, updateEventList } = useAuth();
    const [paymentMethod, setPaymentMethod] = useState("card");
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState("");

    const handlePayment = async () => {
        setIsProcessing(true);
        setPaymentError("");

        try {
            // Get token if user is logged in
            let token = "";
            if (user) {
                token = await user.getIdToken();
            }

            // Prepare order data
            const orderPayload = {
                eventId: event.id,
                userId: user?.uid || null,
                userEmail: user?.email || "",
                userName: user?.displayName || "",
                paymentMethod,
                tickets: selectedTickets.map(ticket => ({
                    ticketId: ticket.id,
                    quantity: ticket.quantity
                }))
            };

            // Create order via API
            const headers = {
                "Content-Type": "application/json"
            };

            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch("/api/orders", {
                method: "POST",
                headers,
                body: JSON.stringify(orderPayload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Payment failed");
            }

            // Update local profile to show ticket
            if (user) {
                try {
                    // Assuming we have access to updateEventList from useAuth
                    // We need to destructure it from useAuth() first
                    await updateEventList("attendedEvents", event.id, true);
                } catch (err) {
                    console.error("Failed to update local profile:", err);
                }
            }

            // Redirect to confirmation with real order ID
            router.push(`/confirmation/${data.id}?eventId=${event.id}`);
        } catch (error) {
            console.error("Payment error:", error);
            setPaymentError(error.message || "Payment failed. Please try again.");
            setIsProcessing(false);
        }
    };

    if (selectedTickets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <p className="text-xl text-white/60">No tickets selected.</p>
                <button onClick={() => router.back()} className="text-white hover:underline">Go back</button>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column: Payment Details */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
            >
                <div>
                    <button onClick={() => router.back()} className="flex items-center text-sm text-white/60 hover:text-white transition-colors mb-6">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Event
                    </button>
                    <h1 className="text-3xl md:text-4xl font-display uppercase tracking-wider">Checkout</h1>
                    <p className="text-white/60 mt-2">Complete your purchase securely.</p>
                </div>

                {/* Payment Methods */}
                <div className="space-y-4">
                    <h3 className="text-sm uppercase tracking-widest text-white/40">Payment Method</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <PaymentMethodOption
                            id="card"
                            label="Card"
                            icon={CreditCard}
                            selected={paymentMethod === "card"}
                            onClick={() => setPaymentMethod("card")}
                        />
                        <PaymentMethodOption
                            id="upi"
                            label="UPI"
                            icon={Smartphone}
                            selected={paymentMethod === "upi"}
                            onClick={() => setPaymentMethod("upi")}
                        />
                        <PaymentMethodOption
                            id="netbanking"
                            label="Net Banking"
                            icon={Building2}
                            selected={paymentMethod === "netbanking"}
                            onClick={() => setPaymentMethod("netbanking")}
                        />
                    </div>
                </div>

                {/* Payment Form */}
                <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-white/5">
                    {paymentMethod === "card" && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-white/60">Card Number</label>
                                <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wider text-white/60">Expiry</label>
                                    <input type="text" placeholder="MM/YY" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wider text-white/60">CVC</label>
                                    <input type="text" placeholder="123" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-white/60">Cardholder Name</label>
                                <input type="text" placeholder="John Doe" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors" />
                            </div>
                        </div>
                    )}
                    {paymentMethod === "upi" && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-white/60">UPI ID</label>
                                <input type="text" placeholder="username@upi" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors" />
                            </div>
                            <p className="text-xs text-white/40">A payment request will be sent to your UPI app.</p>
                        </div>
                    )}
                    {paymentMethod === "netbanking" && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-white/60">Select Bank</label>
                                <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors appearance-none">
                                    <option>HDFC Bank</option>
                                    <option>ICICI Bank</option>
                                    <option>SBI</option>
                                    <option>Axis Bank</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="w-full bg-white text-black font-bold uppercase tracking-widest py-4 rounded-full hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>Processing...</>
                    ) : (
                        <>
                            <Lock className="w-4 h-4" />
                            Pay ₹{totalAmount.toLocaleString()}
                        </>
                    )}
                </button>

                {paymentError && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                        <p className="text-red-400 text-sm font-medium">{paymentError}</p>
                    </div>
                )}

                <p className="text-center text-xs text-white/40 flex items-center justify-center gap-2">
                    <Lock className="w-3 h-3" />
                    Payments are secure and encrypted
                </p>

            </motion.div>

            {/* Right Column: Order Summary */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:pl-12"
            >
                <div className="glass-panel rounded-[32px] border border-white/10 bg-black/60 overflow-hidden sticky top-32">
                    <div className="relative h-48 w-full">
                        <Image src={event.image} alt={event.title} fill className="object-cover opacity-60" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <div className="absolute bottom-4 left-6 right-6">
                            <h2 className="text-2xl font-display uppercase tracking-wider text-white">{event.title}</h2>
                            <p className="text-white/70 text-sm mt-1">{event.date} • {event.time}</p>
                            <p className="text-white/50 text-xs mt-1">{event.location}</p>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <h3 className="text-xs uppercase tracking-[0.2em] text-white/40">Order Summary</h3>

                        <div className="space-y-4">
                            {selectedTickets.map((ticket) => (
                                <div key={ticket.id} className="flex justify-between items-start">
                                    <div>
                                        <p className="text-white font-medium">{ticket.name}</p>
                                        <p className="text-xs text-white/50">Qty: {ticket.quantity}</p>
                                    </div>
                                    <p className="text-white">₹{(ticket.price * ticket.quantity).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>

                        <div className="h-px bg-white/10" />

                        <div className="flex justify-between items-center">
                            <p className="text-white/60">Subtotal</p>
                            <p className="text-white">₹{totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-white/60">Fees</p>
                            <p className="text-white">₹0</p>
                        </div>

                        <div className="h-px bg-white/10" />

                        <div className="flex justify-between items-center text-xl font-bold">
                            <p className="text-white">Total</p>
                            <p className="text-white">₹{totalAmount.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function PaymentMethodOption({ id, label, icon: Icon, selected, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 ${selected
                ? "bg-white text-black border-white"
                : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
        >
            <Icon className="w-6 h-6 mb-2" />
            <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </button>
    )
}
