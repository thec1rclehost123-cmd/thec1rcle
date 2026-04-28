"use client";

import { useMemo } from "react";
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
    Loader2,
    Check,
    Tag,
    ChevronDown
} from "lucide-react";
import { useAuth } from "./providers/AuthProvider";
import { CartTimer } from "./checkout/CartTimer";
import { PromoCodeInput } from "./checkout/PromoCodeInput";
import NeedToKnowCard from "./checkout/NeedToKnowCard";
import { useCheckoutSession } from "../features/checkout/hooks/useCheckoutSession";

export default function CheckoutContainer({ event, initialTickets = [] }) {
    const router = useRouter();
    const { user, profile } = useAuth();
    const {
        appliedPromoCode,
        attendeeDetails,
        canProceedStep1,
        canProceedStep2,
        canSubmitCheckout,
        cartReservation,
        clearPersistedReservation,
        displayFees,
        displaySubtotal,
        displayTiers,
        displayTotal,
        error,
        feeBreakdown,
        feesBreakdownOpen,
        handleApplyPromoCode,
        handleCartExpired,
        handlePayment,
        handleRemovePromoCode,
        handleTicketChange,
        isAboveMax,
        isBelowMin,
        isFreeOrder,
        isProcessing,
        isQuoteSyncing,
        isSuccess,
        maxTickets,
        minTickets,
        needToKnowItems,
        otherEventReservation,
        paymentMethod,
        processingState,
        quoteReady,
        quoteTierConstraints,
        selectedTickets,
        setAttendeeDetails,
        setError,
        setFeesBreakdownOpen,
        setPaymentMethod,
        setStep,
        step,
        totalDiscount,
    } = useCheckoutSession({
        event,
        initialTickets,
        profile,
        router,
        user,
    });


    const containerVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, scale: 1.02, y: -10, transition: { duration: 0.4 } }
    };

    return (
        <div className="flex-1 flex items-center justify-center w-full pb-6 md:pb-10">
            <div className="w-full max-w-[1200px] grid grid-cols-1 md:grid-cols-[1fr_380px] gap-8 lg:gap-16 items-center px-3 sm:px-6">

                {/* Main Action Area */}
                <div className="relative flex flex-col h-full overflow-hidden">
                    {otherEventReservation && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-orange/10 border border-orange/20 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4"
                        >
                            <div className="min-w-0">
                                <p className="text-[8px] font-black uppercase tracking-widest text-orange mb-1">Resume Other Payment</p>
                                <p className="text-[10px] font-black uppercase text-white truncate">{otherEventReservation.eventTitle}</p>
                            </div>
                            <button
                                onClick={() => router.push(`/checkout/${otherEventReservation.eventId}`)}
                                className="px-4 py-2 bg-orange text-white text-[9px] font-black uppercase rounded-full shrink-0"
                            >
                                Resume →
                            </button>
                        </motion.div>
                    )}
                    {cartReservation?.expiresAt && !isSuccess && (
                        <div className="mb-4">
                            <CartTimer
                                expiresAt={cartReservation.expiresAt}
                                onExpired={handleCartExpired}
                            />
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div key="step1" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8 flex flex-col">
                                <div className="space-y-4">
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Step 01</h2>
                                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-[0.9]">Select your <br />Tickets</h1>
                                </div>
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 py-1">
                                    {displayTiers.map((ticket) => {
                                        const sel = selectedTickets.find(st => st.id === ticket.id);
                                        const qty = sel ? sel.quantity : 0;
                                        const quoteTier = quoteTierConstraints.get(ticket.id);
                                        const rawAvailable = quoteReady ? Number(quoteTier?.available ?? 0) : 0;
                                        const ticketLimit = quoteReady ? Number(quoteTier?.maxPerOrder ?? 0) : 0;
                                        const available = Math.min(rawAvailable, ticketLimit);
                                        const isSoldOut = quoteReady && rawAvailable <= 0;
                                        const isLow = quoteReady && !isSoldOut && rawAvailable <= 5;
                                        return (
                                            <div key={ticket.id} className={`p-5 rounded-[28px] border transition-all duration-500 ${isSoldOut ? "border-red-500/30 bg-red-500/[0.03] opacity-60" : qty > 0 ? "border-orange/20 bg-orange/5" : "border-white/5 bg-white/[0.02]"}`}>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-[16px] font-black uppercase text-white truncate">{ticket.name}</h3>
                                                            {isSoldOut && (
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full shrink-0">Gone</span>
                                                            )}
                                                            {isLow && (
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-orange border border-orange/40 px-2 py-0.5 rounded-full shrink-0">{rawAvailable} left</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">₹{(ticket.price || 0).toLocaleString('en-IN')} • {ticket.description || "Limited Access"}</p>
                                                    </div>
                                                    {isSoldOut ? (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-400/60">Sold Out</span>
                                                    ) : (
                                                        <div className="flex items-center gap-3 bg-white/[0.03] p-1 rounded-full border border-white/[0.04]">
                                                            <button onClick={() => handleTicketChange(ticket.id, -1)} disabled={!quoteReady || isQuoteSyncing || qty === 0} className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-20">-</button>
                                                            <span className="w-5 text-center font-bold text-[14px] text-white">{qty}</span>
                                                            <button onClick={() => handleTicketChange(ticket.id, 1)} disabled={!quoteReady || isQuoteSyncing || qty >= available} className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-20">+</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="space-y-2">
                                    {!quoteReady || isQuoteSyncing ? (
                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest text-center">Syncing live availability...</p>
                                    ) : null}
                                    {isBelowMin && (
                                        <p className="text-[10px] text-orange font-bold uppercase tracking-widest text-center">Minimum {minTickets} tickets required</p>
                                    )}
                                    {isAboveMax && (
                                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center">Maximum {maxTickets} tickets allowed per account</p>
                                    )}
                                    )}
                                <button 
                                        onClick={() => {
                                            setError("");
                                            setStep(2);
                                        }} 
                                        disabled={!canProceedStep1} 
                                        className="w-full h-[64px] flex items-center justify-center rounded-full bg-[#CA3E22] text-white font-black uppercase tracking-[0.3em] transition-all hover:bg-[#D44426] hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:bg-[#CA3E22] shadow-[0_4px_30px_rgba(202,62,34,0.3)] text-[12px]"
                                    >
                                        CONTINUE • ₹{displaySubtotal.toLocaleString('en-IN')}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="step2" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8 flex flex-col justify-center">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep(1)} className="text-white/40 hover:text-white transition-colors"><ArrowLeft className="h-5 w-5" /></button>
                                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Step 02</h2>
                                    </div>
                                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-[0.9]">Enter your <br />Details</h1>
                                </div>
                                <div className="space-y-6 flex-1 flex flex-col justify-center">
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange ml-1">Full Name</label>
                                        <input type="text" value={attendeeDetails.name} onChange={(e) => setAttendeeDetails({ ...attendeeDetails, name: e.target.value })} placeholder="Full Name" className="w-full bg-white/5 border-b border-white/10 p-4 text-[16px] font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-orange transition-all duration-500" />
                                    </div>
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange ml-1">Email Address</label>
                                        <input type="email" value={attendeeDetails.email} onChange={(e) => setAttendeeDetails({ ...attendeeDetails, email: e.target.value })} placeholder="Email" className="w-full bg-white/5 border-b border-white/10 p-4 text-[16px] font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-orange transition-all duration-500" />
                                    </div>
                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange ml-1">Phone Number (Opt)</label>
                                        <input type="tel" value={attendeeDetails.phone} onChange={(e) => setAttendeeDetails({ ...attendeeDetails, phone: e.target.value })} placeholder="+91" className="w-full bg-white/5 border-b border-white/10 p-4 text-[16px] font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-orange transition-all duration-500" />
                                    </div>
                                </div>
                                <button onClick={() => setStep(3)} disabled={!canProceedStep2} className="w-full h-16 flex items-center justify-center rounded-full bg-white text-black font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 group shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
                                    Review & Payment
                                    <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div key="step3" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8 flex flex-col text-white justify-center">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep(2)} className="text-white/40 hover:text-white transition-colors"><ArrowLeft className="h-5 w-5" /></button>
                                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Step 03</h2>
                                    </div>
                                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-[0.9]">Payment & <br />Checkout</h1>
                                </div>
                                {!pricingResult?.isFree && (
                                    <div className="space-y-8 flex-1 flex flex-col justify-center">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                                <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Secure Payment Active</p>
                                            </div>
                                            <p className="text-[9px] leading-relaxed text-white/30 uppercase tracking-widest">By proceeding, you authorize the payment and issue tickets. No refunds allowed.</p>
                                        </div>
                                    </div>
                                )}

                                {pricingResult?.isFree && (
                                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                                        <div className="h-20 w-20 rounded-full bg-orange/10 flex items-center justify-center border border-orange/20">
                                            <CheckCircle2 className="h-10 w-10 text-orange" />
                                        </div>
                                        <div className="text-center space-y-2">
                                            <h3 className="text-xl font-black uppercase text-white">Free Confirmation</h3>
                                            <p className="text-[10px] text-white/40 uppercase tracking-widest max-w-[240px] leading-relaxed mx-auto">
                                                This is a zero-total order. Click the button below to secure your spot instantly.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {error && <p className="text-[10px] font-black text-orange uppercase tracking-widest text-center animate-pulse">{error}</p>}
                                <button onClick={handlePayment} disabled={!canSubmitCheckout} className="w-full h-16 flex items-center justify-center rounded-full bg-orange text-white font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 group shadow-[0_20px_40px_rgba(255,165,0,0.2)]">
                                    {isProcessing ? (
                                        <div className="flex items-center gap-3">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <span className="text-[10px] uppercase font-black tracking-widest">{processingState}...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {event.isRSVP ? "Confirm Registration" : pricingResult?.isFree ? "Finalize Free Pass" : "Confirm Order"}
                                            <Lock className="ml-3 h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="mt-6 md:hidden">
                        <NeedToKnowCard items={pricingResult?.needToKnow || []} />
                    </div>
                </div>

                {/* Vertical Summary Container */}
                <div className="hidden md:flex flex-col h-fit overflow-hidden rounded-[42px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
                    <div className="relative h-44 shrink-0">
                        <Image src={event.image || "/events/placeholder.jpg"} alt={event.title} fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/45 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-6 left-7 right-7">
                            <div className="mb-3 inline-flex items-center rounded-full border border-orange/18 bg-orange/15 px-3 py-1">
                                <p className="text-[7px] font-black uppercase tracking-[0.3em] text-orange">Booking Summary</p>
                            </div>
                            <h3 className="text-[26px] font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)]">
                                {event.title}
                            </h3>
                        </div>
                    </div>

                    <div className="flex flex-col flex-1 px-7 pb-7 pt-6">
                        <div className="rounded-[28px] border border-white/5 bg-black/20 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="space-y-3 overflow-y-auto custom-scrollbar">
                            {selectedTickets.length > 0 ? (
                                selectedTickets.map(t => (
                                        <div key={t.id} className="flex items-start justify-between gap-4 border-b border-white/4 pb-3 last:border-b-0 last:pb-0">
                                            <div className="min-w-0 pr-4">
                                                <p className="truncate text-[13px] font-black uppercase tracking-[0.08em] text-white">{t.name}</p>
                                                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/28">{t.quantity} ticket{t.quantity > 1 ? "s" : ""}</p>
                                            </div>
                                            <p className="shrink-0 text-[18px] font-black tracking-tight text-white">{t.displayLineTotal || `₹${(t.price).toLocaleString('en-IN')}`}</p>
                                        </div>
                                ))
                            ) : (
                                <p className="py-10 text-center text-[10px] font-black uppercase tracking-[0.34em] text-white/16">Empty Order</p>
                            )}
                            </div>
                        </div>

                        {/* Promo Code Section */}
                        <div className="mt-5">
                            <PromoCodeInput
                                eventId={event.id}
                                onApply={handleApplyPromoCode}
                                appliedCode={appliedPromoCode}
                                onRemove={handleRemovePromoCode}
                                className="[&_input]:h-14 [&_input]:rounded-[22px] [&_input]:border-white/5 [&_input]:bg-white/[0.04] [&_input]:text-white [&_input]:placeholder:text-white/22"
                            />
                        </div>

                        <NeedToKnowCard items={needToKnowItems} className="mt-5" />

                        <div className="mt-6 rounded-[30px] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="space-y-3">
                            {/* Subtotal */}
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Subtotal</span>
                                <span className="text-[13px] font-semibold text-white/68">₹{displaySubtotal.toLocaleString('en-IN')}</span>
                            </div>

                            {/* Discounts */}
                            {totalDiscount > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-green-400/80">
                                        {appliedPromoCode ? `Promo (${appliedPromoCode})` : "Discount"}
                                    </span>
                                    <span className="text-[13px] font-semibold text-green-400">-₹{totalDiscount.toLocaleString('en-IN')}</span>
                                </div>
                            )}

                            {/* Platform Fees (shown once backend pricing is loaded) */}
                            {displayFees > 0 && (
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setFeesBreakdownOpen((open) => !open)}
                                        className="flex w-full items-center justify-between rounded-[20px] border border-white/5 bg-white/[0.025] px-3.5 py-3 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                                    >
                                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                                            Fees & GST
                                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${feesBreakdownOpen ? "rotate-180" : ""}`} />
                                        </span>
                                        <span className="text-[13px] font-semibold text-white/72">+₹{displayFees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                    </button>

                                    <AnimatePresence initial={false}>
                                        {feesBreakdownOpen && feeBreakdown.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, y: -4 }}
                                                animate={{ opacity: 1, height: "auto", y: 0 }}
                                                exit={{ opacity: 0, height: 0, y: -4 }}
                                                className="overflow-hidden rounded-[20px] border border-white/5 bg-white/[0.03]"
                                            >
                                                <div className="space-y-2 p-3">
                                                    {feeBreakdown.map((item) => (
                                                        <div key={item.label} className="flex items-center justify-between gap-4">
                                                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">{item.label}</span>
                                                            <span className="text-[12px] font-semibold text-white/70">₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Total */}
                            <div className="mt-4 flex items-end justify-between border-t border-white/6 pt-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/34">Total</p>
                                    <p className="mt-1 text-[11px] text-white/32">Inclusive of all confirmed charges.</p>
                                </div>
                                <div className="text-right">
                                    {displayTotal !== null
                                        ? <p className="text-[44px] font-black leading-none tracking-[-0.05em] text-white">₹{displayTotal.toLocaleString('en-IN')}</p>
                                        : <p className="text-[44px] font-black leading-none tracking-[-0.05em] text-white/30">—</p>
                                    }
                                    <p className="mt-1 text-[8px] font-black uppercase tracking-[0.36em] text-white/22">Grand Total</p>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-center gap-2 rounded-full border border-white/4 bg-white/[0.03] px-3 py-2">
                                <ShieldCheck className="h-3 w-3 text-white/26" />
                                <span className="text-[8px] font-black uppercase tracking-[0.28em] text-white/24">End-to-End Encrypted</span>
                            </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Success/Processing Overlay */}
            <AnimatePresence>
                {(isProcessing || isSuccess) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white text-center p-8 overflow-hidden"
                    >
                        {/* Premium Success Background */}
                        <div className="absolute inset-0 -z-10 bg-black">
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 90, 0],
                                    opacity: [0.1, 0.2, 0.1]
                                }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="absolute -top-1/4 -right-1/4 w-[80vw] h-[80vw] bg-orange/20 rounded-full blur-[120px]"
                            />
                            <motion.div
                                animate={{
                                    scale: [1.2, 1, 1.2],
                                    rotate: [0, -90, 0],
                                    opacity: [0.1, 0.15, 0.1]
                                }}
                                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                className="absolute -bottom-1/4 -left-1/4 w-[70vw] h-[70vw] bg-iris/20 rounded-full blur-[100px]"
                            />
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
                        </div>

                        <div className="relative w-40 h-40 mb-10">
                            <motion.div
                                className="absolute inset-0 rounded-full border-2 border-white/5"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1.4, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                {isSuccess ? (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: "spring", damping: 12 }}
                                        className="h-24 w-24 bg-gradient-to-br from-orange to-[#FF7A5C] rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(244,74,34,0.4)] relative"
                                    >
                                        <Check className="h-12 w-12 text-white" strokeWidth={4} />
                                        <motion.div
                                            animate={{ opacity: [0, 1, 0], scale: [1, 1.5, 2] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="absolute inset-0 rounded-full bg-orange opacity-20"
                                        />
                                    </motion.div>
                                ) : (
                                    <div className="relative h-20 w-20">
                                        <Loader2 className="h-20 w-20 animate-spin text-orange opacity-20" strokeWidth={1} />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="h-2 w-2 bg-orange rounded-full animate-ping" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={isSuccess ? "success" : "processing"}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-6"
                            >
                                <h2 className="text-5xl font-black uppercase tracking-tight leading-none">
                                    {isSuccess ? <span>YOU'RE<br />IN.</span> : "Processing"}
                                </h2>

                                <p className="text-[10px] uppercase font-black tracking-[0.4em] text-white/40 max-w-[280px] mx-auto leading-loose">
                                    {isSuccess ?
                                        "Your pass has been secured. Get ready for an unforgettable night." :
                                        processingState === "reserving" ? "Reserving your tickets..." :
                                            processingState === "initiating" ? "Securing your spot..." :
                                                processingState === "verifying" ? "Authenticating payment..." :
                                                    processingState === "issuing" ? "Generating tickets..." :
                                                        "Hold tight, we're finishing up..."}
                                </p>
                            </motion.div>
                        </AnimatePresence>

                        {isSuccess && (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={() => {
                                    router.prefetch('/tickets'); // Double check prefetch
                                    router.push('/tickets');
                                }}
                                className="mt-16 group relative"
                            >
                                <div className="absolute -inset-1 bg-gradient-to-r from-orange to-iris rounded-full blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative h-16 px-14 rounded-full bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] hover:scale-105 active:scale-95 transition-all flex items-center gap-4">
                                    View My Tickets
                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
