"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
    CreditCard,
    Smartphone,
    Building2,
    ArrowLeft,
    Lock,
    CheckCircle2,
    User,
    Mail,
    Phone,
    ArrowRight,
    ShieldCheck,
    AlertCircle,
    Loader2
} from "lucide-react";
import { useAuth } from "./providers/AuthProvider";

export default function CheckoutContainer({ event, initialTickets = [] }) {
    const router = useRouter();
    const { user, profile } = useAuth();

    const [step, setStep] = useState(1);
    const [selectedTickets, setSelectedTickets] = useState(initialTickets);
    const [attendeeDetails, setAttendeeDetails] = useState({
        name: user?.displayName || profile?.name || "",
        email: user?.email || profile?.email || "",
        phone: profile?.phone || ""
    });

    // Auto-fill when user/profile data becomes available
    useEffect(() => {
        if (user || profile) {
            setAttendeeDetails(prev => ({
                name: prev.name || user?.displayName || profile?.name || "",
                email: prev.email || user?.email || profile?.email || "",
                phone: prev.phone || profile?.phone || ""
            }));
        }
    }, [user, profile]);

    const [paymentMethod, setPaymentMethod] = useState("card");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");

    const totalAmount = useMemo(() => {
        return selectedTickets.reduce((sum, t) => sum + (t.price * t.quantity), 0);
    }, [selectedTickets]);

    const canProceedStep1 = selectedTickets.some(t => t.quantity > 0);
    const canProceedStep2 = attendeeDetails.name.trim() !== "" && attendeeDetails.email.trim() !== "";

    const handleTicketChange = (ticketId, delta) => {
        setSelectedTickets(prev => {
            const existing = prev.find(t => t.id === ticketId);
            if (existing) {
                return prev.map(t => t.id === ticketId ? { ...t, quantity: Math.max(0, (t.remaining ?? t.quantity_limit ?? 10), t.quantity + delta) } : t);
            } else {
                const ticketDef = event.tickets.find(t => t.id === ticketId);
                if (!ticketDef) return prev;
                return [...prev, { ...ticketDef, quantity: Math.max(0, delta) }];
            }
        });

        // Actually, we should map from event.tickets to ensure we have all data
        const updated = (event.tickets || []).map(t => {
            const sel = selectedTickets.find(st => st.id === t.id);
            const currentQty = sel ? sel.quantity : 0;
            let newQty = currentQty;
            if (t.id === ticketId) {
                newQty = Math.max(0, currentQty + delta);
                // Limit by remaining if available
                const available = Number(t.remaining ?? t.quantity ?? 10);
                if (newQty > available) newQty = available;
            }
            return { ...t, quantity: newQty };
        });
        setSelectedTickets(updated.filter(t => t.quantity > 0));
    };

    const handlePayment = async () => {
        setIsProcessing(true);
        setError("");

        try {
            let token = "";
            if (user) {
                token = await user.getIdToken();
            } else {
                const currentPath = window.location.pathname + window.location.search;
                router.push(`/auth?returnUrl=${encodeURIComponent(currentPath)}`);
                return;
            }

            const orderPayload = {
                eventId: event.id,
                userId: user?.uid || null,
                userEmail: attendeeDetails.email,
                userName: attendeeDetails.name,
                paymentMethod,
                tickets: selectedTickets.map(ticket => ({
                    ticketId: ticket.id,
                    quantity: ticket.quantity
                }))
            };

            const headers = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const response = await fetch("/api/orders", {
                method: "POST",
                headers,
                body: JSON.stringify(orderPayload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Payment failed");
            }

            router.push(`/confirmation/${data.id}`);
        } catch (err) {
            console.error("Checkout error:", err);
            setError(err.message || "Something went wrong. Please try again.");
            setIsProcessing(false);
        }
    };

    // Step 1: Select Tickets
    const renderStep1 = () => (
        <div className="space-y-8">
            <div className="grid gap-4">
                {event.tickets?.map((ticket) => {
                    const sel = selectedTickets.find(st => st.id === ticket.id);
                    const qty = sel ? sel.quantity : 0;
                    const isSoldOut = (ticket.remaining !== undefined && ticket.remaining <= 0);

                    return (
                        <div
                            key={ticket.id}
                            className={`group relative overflow-hidden rounded-[32px] border transition-all duration-300 ${qty > 0
                                ? "border-orange/40 bg-orange/5 shadow-glow-sm"
                                : "border-black/[0.05] dark:border-white/10 bg-white/50 dark:bg-white/[0.02]"
                                }`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-6">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black uppercase tracking-tight text-black dark:text-white">
                                        {ticket.name}
                                    </h3>
                                    <p className="text-sm text-black/50 dark:text-white/40 font-medium">
                                        {ticket.description || "Access to the main event."}
                                    </p>
                                    {ticket.remaining !== undefined && (
                                        <p className={`text-[10px] uppercase font-bold tracking-widest ${ticket.remaining < 20 ? "text-orange" : "text-black/30 dark:text-white/30"}`}>
                                            {ticket.remaining} spots left
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-8">
                                    <div className="text-right">
                                        <p className="text-2xl font-display text-black dark:text-white">₹{ticket.price}</p>
                                    </div>

                                    <div className="flex items-center gap-4 bg-black/5 dark:bg-white/5 p-1 rounded-full border border-black/5 dark:border-white/10">
                                        <button
                                            onClick={() => handleTicketChange(ticket.id, -1)}
                                            disabled={qty === 0}
                                            className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
                                        >
                                            -
                                        </button>
                                        <span className="w-4 text-center font-bold text-sm">{qty}</span>
                                        <button
                                            onClick={() => handleTicketChange(ticket.id, 1)}
                                            disabled={isSoldOut}
                                            className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/10 dark:hover:bg-white/10 disabled:opacity-30"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="group relative w-full h-16 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-xl"
            >
                Continue to Details
                <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                <div className="absolute inset-x-0 bottom-0 h-1 bg-orange/40 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
        </div>
    );

    // Step 2: Attendee Details
    const renderStep2 = () => (
        <div className="space-y-8">
            <div className="glass-panel p-8 rounded-[40px] border border-black/[0.05] dark:border-white/10 bg-white/50 dark:bg-white/[0.02]">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 dark:text-white/40 mb-8">Attendee Information</h3>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-black/60 dark:text-white/60 ml-4 font-bold">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 dark:text-white/20" />
                            <input
                                type="text"
                                value={attendeeDetails.name}
                                onChange={(e) => setAttendeeDetails({ ...attendeeDetails, name: e.target.value })}
                                placeholder="Full Name"
                                className="w-full h-14 pl-14 pr-6 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-orange/50 focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-black/60 dark:text-white/60 ml-4 font-bold">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 dark:text-white/20" />
                            <input
                                type="email"
                                value={attendeeDetails.email}
                                onChange={(e) => setAttendeeDetails({ ...attendeeDetails, email: e.target.value })}
                                placeholder="email@example.com"
                                className="w-full h-14 pl-14 pr-6 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-orange/50 focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-black/60 dark:text-white/60 ml-4 font-bold">Phone Number (Optional)</label>
                        <div className="relative">
                            <Phone className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 dark:text-white/20" />
                            <input
                                type="tel"
                                value={attendeeDetails.phone}
                                onChange={(e) => setAttendeeDetails({ ...attendeeDetails, phone: e.target.value })}
                                placeholder="+91 00000 00000"
                                className="w-full h-14 pl-14 pr-6 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-orange/50 focus:outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={() => setStep(1)}
                    className="h-16 px-8 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 text-xs font-black uppercase tracking-widest transition-all hover:bg-black/[0.05] dark:hover:bg-white/10"
                >
                    Back
                </button>
                <button
                    onClick={() => {
                        if (!user && !profile) {
                            // Redirect to login if user not authenticated and it's required
                            // For now, let's just proceed to step 3
                            setStep(3);
                        } else {
                            setStep(3);
                        }
                    }}
                    disabled={!canProceedStep2}
                    className="flex-1 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-xl flex items-center justify-center gap-3"
                >
                    Review & Pay
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );

    // Step 3: Review & Pay
    const renderStep3 = () => (
        <div className="space-y-8">
            <div className="glass-panel p-8 rounded-[40px] border border-black/[0.05] dark:border-white/10 bg-white/50 dark:bg-white/[0.02] space-y-8">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 dark:text-white/40 mb-4">Payment Method</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { id: "card", label: "Card", icon: CreditCard },
                            { id: "upi", label: "UPI", icon: Smartphone },
                            { id: "netbanking", label: "Banks", icon: Building2 }
                        ].map(method => (
                            <button
                                key={method.id}
                                onClick={() => setPaymentMethod(method.id)}
                                className={`flex flex-col items-center justify-center p-4 rounded-3xl border transition-all duration-300 ${paymentMethod === method.id
                                    ? "border-orange/50 bg-orange/5 text-black dark:text-white"
                                    : "border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] text-black/60 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/10"
                                    }`}
                            >
                                <method.icon className="h-6 w-6 mb-2" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{method.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-black/[0.05] dark:bg-white/10" />

                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-orange/10 flex items-center justify-center shrink-0">
                            <ShieldCheck className="h-5 w-5 text-orange" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest leading-none">Safe & Secure</p>
                            <p className="text-[10px] text-black/40 dark:text-white/40 mt-1">Your reservation is held securely. Tickets will be sent to your email instantly.</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                        <p className="text-[10px] text-black/50 dark:text-white/50 leading-relaxed font-medium">
                            By tapping &apos;Pay Now&apos;, you agree to THE C1RCLE&apos;s Terms of Service and Guest Policies. All sales are final.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
                </div>
            )}

            <div className="flex gap-4">
                <button
                    onClick={() => setStep(2)}
                    className="h-16 px-8 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 text-xs font-black uppercase tracking-widest transition-all hover:bg-black/[0.05] dark:hover:bg-white/10"
                >
                    Back
                </button>
                <button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="flex-1 h-16 rounded-full bg-orange text-white font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-xl shadow-orange/20 flex items-center justify-center gap-3 relative overflow-hidden"
                >
                    {isProcessing ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        <>
                            <Lock className="h-4 w-4" />
                            Pay ₹{totalAmount.toLocaleString()}
                        </>
                    )}

                    <motion.div
                        className="absolute inset-0 bg-white/20 translate-x-[-100%]"
                        animate={isProcessing ? { x: "100%" } : { x: "-100%" }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    />
                </button>
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 items-start">
            {/* Left Column: Flow */}
            <div className="space-y-12">
                {/* Progress Stepper */}
                <div className="flex items-center justify-between px-4">
                    {[
                        { s: 1, l: "Tickets" },
                        { s: 2, l: "Details" },
                        { s: 3, l: "Payment" }
                    ].map((item, idx) => (
                        <div key={item.s} className="flex items-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className={`h-10 w-10 flex items-center justify-center rounded-full border transition-all duration-500 ${step >= item.s
                                    ? "bg-orange border-orange text-white shadow-[0_0_20px_rgba(244,74,34,0.3)]"
                                    : "border-black/10 dark:border-white/10 text-black/20 dark:text-white/20"
                                    }`}>
                                    {step > item.s ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-xs font-black">{item.s}</span>}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${step >= item.s ? "text-black dark:text-white" : "text-black/20 dark:text-white/20"}`}>
                                    {item.l}
                                </span>
                            </div>
                            {idx < 2 && (
                                <div className={`mx-4 h-[1px] w-8 sm:w-16 transition-colors duration-500 ${step > item.s ? "bg-orange" : "bg-black/10 dark:bg-white/10"}`} />
                            )}
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Right Column: Sticky Summary */}
            <aside className="sticky top-24 space-y-6">
                <div className="overflow-hidden rounded-[48px] border border-black/[0.05] dark:border-white/10 bg-white/40 dark:bg-black/60 shadow-xl backdrop-blur-3xl">
                    <div className="relative h-48 w-full">
                        <Image
                            src={event.image || "/events/placeholder.jpg"}
                            alt={event.title}
                            fill
                            className="object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-6 inset-x-8">
                            <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/20 w-fit mb-2">
                                <p className="text-[8px] font-black uppercase tracking-widest text-white">Event Pass</p>
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-tight text-white leading-tight">{event.title}</h2>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-white/60 mt-1">{event.date} • {event.time}</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="space-y-4">
                            {selectedTickets.length > 0 ? (
                                selectedTickets.map(ticket => (
                                    <div key={ticket.id} className="flex justify-between items-center group">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-black text-black dark:text-white uppercase tracking-tight">{ticket.name}</p>
                                            <p className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">Qty: {ticket.quantity} × ₹{ticket.price}</p>
                                        </div>
                                        <p className="text-sm font-black text-black dark:text-white">₹{(ticket.price * ticket.quantity).toLocaleString()}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/20 dark:text-white/20 text-center py-4">No tickets selected</p>
                            )}
                        </div>

                        <div className="h-px bg-black/[0.05] dark:bg-white/10" />

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Subtotal</p>
                                <p className="text-sm font-bold">₹{totalAmount.toLocaleString()}</p>
                            </div>
                            <div className="flex justify-between items-center text-emerald-500">
                                <p className="text-[10px] font-bold uppercase tracking-widest">Platform Fee</p>
                                <p className="text-sm font-bold">Free</p>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-black/5 dark:border-white/5 flex justify-between items-center">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Total Amount</p>
                            <div className="text-right">
                                <p className="text-3xl font-display text-black dark:text-white tracking-tighter">₹{totalAmount.toLocaleString()}</p>
                                <p className="text-[8px] font-bold text-black/20 dark:text-white/20 uppercase tracking-widest">Incl. of all taxes</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Support Card */}
                <div className="p-6 rounded-[32px] border border-black/[0.05] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Need Help?</p>
                    <p className="text-[11px] font-black uppercase tracking-widest text-black dark:text-white mt-2 cursor-pointer hover:text-orange transition-colors underline underline-offset-4 decoration-orange/30">Contact THE C1RCLE Assist</p>
                </div>
            </aside>

            {/* Overlay for processing */}
            <AnimatePresence>
                {isProcessing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center"
                    >
                        <div className="relative h-24 w-24 mb-8">
                            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                            <motion.div
                                className="absolute inset-0 rounded-full border-4 border-t-orange border-r-transparent border-b-transparent border-l-transparent"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            />
                            <div className="absolute inset-4 rounded-full bg-white/5 flex items-center justify-center">
                                <Lock className="h-6 w-6 text-white/40" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Securing your spot</h2>
                        <p className="text-sm text-white/50 mt-4 max-w-xs font-medium">Entering THE C1RCLE... Please don&apos;t refresh or go back. Redirecting to your confirmed pass shortly.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
