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
    Loader2,
    Check
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

    const [paymentMethod, setPaymentMethod] = useState("card");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (user || profile) {
            setAttendeeDetails(prev => ({
                name: prev.name || user?.displayName || profile?.name || "",
                email: prev.email || user?.email || profile?.email || "",
                phone: prev.phone || profile?.phone || ""
            }));
        }
    }, [user, profile]);

    const totalAmount = useMemo(() => {
        return selectedTickets.reduce((sum, t) => sum + (t.price * t.quantity), 0);
    }, [selectedTickets]);

    const canProceedStep1 = selectedTickets.some(t => t.quantity > 0);
    const canProceedStep2 = attendeeDetails.name.trim() !== "" && attendeeDetails.email.trim() !== "";

    const handleTicketChange = (ticketId, delta) => {
        const updated = (event.tickets || []).map(t => {
            const sel = selectedTickets.find(st => st.id === t.id);
            const currentQty = sel ? sel.quantity : 0;
            let newQty = currentQty;
            if (t.id === ticketId) {
                newQty = Math.max(0, currentQty + delta);
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

            const response = await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(orderPayload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Payment failed");

            setIsSuccess(true);
            setTimeout(() => {
                router.push(`/confirmation/${data.id}`);
            }, 2000);
        } catch (err) {
            setError(err.message || "Something went wrong.");
            setIsProcessing(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, scale: 1.02, y: -10, transition: { duration: 0.4 } }
    };

    return (
        <div className="h-[calc(100vh-80px)] min-h-[500px] flex items-center justify-center -mt-8">
            <div className="w-full max-w-[1000px] grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 h-full max-h-[600px]">

                {/* Main Action Area */}
                <div className="relative flex flex-col h-full overflow-hidden">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div key="step1" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 h-full flex flex-col justify-center">
                                <div className="space-y-4">
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Step 01</h2>
                                    <h1 className="text-4xl font-black uppercase tracking-tight text-white leading-[0.9]">Select your <br />Access points</h1>
                                </div>
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 py-1">
                                    {event.tickets?.map((ticket) => {
                                        const sel = selectedTickets.find(st => st.id === ticket.id);
                                        const qty = sel ? sel.quantity : 0;
                                        return (
                                            <div key={ticket.id} className={`p-5 rounded-[28px] border transition-all duration-500 ${qty > 0 ? "border-orange/40 bg-orange/5" : "border-white/5 bg-white/[0.02]"}`}>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-lg font-black uppercase text-white truncate">{ticket.name}</h3>
                                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">₹{ticket.price} • {ticket.description || "Limited Access"}</p>
                                                    </div>
                                                    <div className="flex items-center gap-4 bg-white/5 p-1 rounded-full border border-white/5">
                                                        <button onClick={() => handleTicketChange(ticket.id, -1)} disabled={qty === 0} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-20">-</button>
                                                        <span className="w-4 text-center font-bold text-sm text-white">{qty}</span>
                                                        <button onClick={() => handleTicketChange(ticket.id, 1)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/10">+</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full h-16 flex items-center justify-center rounded-full bg-white text-black font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 group shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
                                    Continue to Identity
                                    <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="step2" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 h-full flex flex-col justify-center">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep(1)} className="text-white/40 hover:text-white transition-colors"><ArrowLeft className="h-5 w-5" /></button>
                                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Step 02</h2>
                                    </div>
                                    <h1 className="text-4xl font-black uppercase tracking-tight text-white leading-[0.9]">Establish your <br />Identity</h1>
                                </div>
                                <div className="space-y-6 flex-1 flex flex-col justify-center">
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange ml-1">Full Legal Alias</label>
                                        <input type="text" value={attendeeDetails.name} onChange={(e) => setAttendeeDetails({ ...attendeeDetails, name: e.target.value })} placeholder="Identity" className="w-full bg-white/5 border-b border-white/10 p-4 text-sm font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-orange transition-all duration-500" />
                                    </div>
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange ml-1">Digital Coordinates</label>
                                        <input type="email" value={attendeeDetails.email} onChange={(e) => setAttendeeDetails({ ...attendeeDetails, email: e.target.value })} placeholder="Email" className="w-full bg-white/5 border-b border-white/10 p-4 text-sm font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-orange transition-all duration-500" />
                                    </div>
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange ml-1">Tele-Communication (Opt)</label>
                                        <input type="tel" value={attendeeDetails.phone} onChange={(e) => setAttendeeDetails({ ...attendeeDetails, phone: e.target.value })} placeholder="+91" className="w-full bg-white/5 border-b border-white/10 p-4 text-sm font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-orange transition-all duration-500" />
                                    </div>
                                </div>
                                <button onClick={() => setStep(3)} disabled={!canProceedStep2} className="w-full h-16 flex items-center justify-center rounded-full bg-white text-black font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 group shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
                                    Review & Authenticate
                                    <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div key="step3" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 h-full flex flex-col justify-center text-white">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep(2)} className="text-white/40 hover:text-white transition-colors"><ArrowLeft className="h-5 w-5" /></button>
                                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Step 03</h2>
                                    </div>
                                    <h1 className="text-4xl font-black uppercase tracking-tight text-white leading-[0.9]">Authorization & <br />Capture</h1>
                                </div>
                                <div className="space-y-8 flex-1 flex flex-col justify-center">
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: "card", label: "CREDIT", icon: CreditCard },
                                            { id: "upi", label: "UPI", icon: Smartphone },
                                            { id: "netbanking", label: "BANKS", icon: Building2 }
                                        ].map(method => (
                                            <button key={method.id} onClick={() => setPaymentMethod(method.id)} className={`flex flex-col items-center justify-center p-5 rounded-3xl border transition-all duration-500 ${paymentMethod === method.id ? "border-orange bg-orange/10 text-white" : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"}`}>
                                                <method.icon className="h-6 w-6 mb-3" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">{method.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <ShieldCheck className="h-4 w-4 text-white/40" />
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Secure Authentication Protocol Active</p>
                                        </div>
                                        <p className="text-[9px] leading-relaxed text-white/30 uppercase tracking-widest">By proceeding, you authorize THE C1RCLE to capture funds and issue entry coordinates. No refunds allowed.</p>
                                    </div>
                                </div>
                                {error && <p className="text-[10px] font-black text-orange uppercase tracking-widest text-center animate-pulse">{error}</p>}
                                <button onClick={handlePayment} disabled={isProcessing} className="w-full h-16 flex items-center justify-center rounded-full bg-orange text-white font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 group shadow-[0_20px_40px_rgba(255,165,0,0.2)]">
                                    {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <>Finalize Access Pass <Lock className="ml-3 h-4 w-4" /></>}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Vertical Summary Container */}
                <div className="hidden md:flex flex-col h-full bg-white/[0.03] rounded-[48px] border border-white/10 backdrop-blur-3xl overflow-hidden shadow-2xl">
                    <div className="relative h-40 shrink-0">
                        <Image src={event.image || "/events/placeholder.jpg"} alt={event.title} fill className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        <div className="absolute bottom-6 left-8 right-8">
                            <div className="px-2 py-0.5 bg-orange/20 border border-orange/40 rounded-full w-fit mb-2">
                                <p className="text-[7px] font-black uppercase tracking-[0.3em] text-orange">Manifest</p>
                            </div>
                            <h3 className="text-lg font-black uppercase text-white leading-tight truncate">{event.title}</h3>
                        </div>
                    </div>

                    <div className="p-8 flex flex-col flex-1">
                        <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
                            {selectedTickets.length > 0 ? (
                                selectedTickets.map(t => (
                                    <div key={t.id} className="flex justify-between items-start group py-1">
                                        <div className="min-w-0 pr-4">
                                            <p className="text-[11px] font-black text-white uppercase tracking-tight truncate">{t.name}</p>
                                            <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] mt-0.5">X{t.quantity}</p>
                                        </div>
                                        <p className="text-[11px] font-black text-white">₹{(t.price * t.quantity).toLocaleString()}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/10 text-center py-10 italic">Empty Order</p>
                            )}
                        </div>

                        <div className="pt-6 border-t border-white/10 mt-auto">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Value</span>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-white tracking-tighter">₹{totalAmount.toLocaleString()}</p>
                                    <p className="text-[7px] font-black text-white/20 uppercase tracking-[0.4em]">Final Capture</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 w-full justify-center">
                                <ShieldCheck className="w-2.5 h-2.5 text-white/20" />
                                <span className="text-[7px] font-black uppercase tracking-[0.3em] text-white/20">End-to-End Encrypted</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Success/Processing Overlay */}
            <AnimatePresence>
                {(isProcessing || isSuccess) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center text-white text-center p-8">
                        <div className="relative w-40 h-40 mb-10">
                            <motion.div className="absolute inset-0 rounded-full border-2 border-white/5" initial={{ scale: 0.8 }} animate={{ scale: 1.1, opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 2 }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                {isSuccess ? (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-20 w-20 bg-orange rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(255,165,0,0.5)]">
                                        <Check className="h-10 w-10 text-white" strokeWidth={4} />
                                    </motion.div>
                                ) : (
                                    <Loader2 className="h-12 w-12 animate-spin text-orange" />
                                )}
                            </div>
                        </div>
                        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-black uppercase tracking-tight">
                            {isSuccess ? "Ritual Complete" : "Authenticating"}
                        </motion.h2>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-[10px] uppercase font-black tracking-[0.4em] text-white/40 mt-6 max-w-[280px]">
                            {isSuccess ? "Welcome to the C1RCLE. Your coordinates are secured." : "Establishing secure link for pass verification..."}
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
