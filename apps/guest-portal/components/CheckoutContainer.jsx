"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import {
    buildNeedToKnowItems,
    normalizeReservationItems,
    hydrateReservationItems,
} from "./checkout/checkoutUtils";

export default function CheckoutContainer({ event, initialTickets = [] }) {
    const router = useRouter();
    const { user, profile, getToken } = useAuth();

    const [step, setStep] = useState(1);
    const [mounted, setMounted] = useState(false);
    const [selectedTickets, setSelectedTickets] = useState(initialTickets);
    const [attendeeDetails, setAttendeeDetails] = useState({
        name: "",
        email: "",
        phone: ""
    });

    const [paymentMethod, setPaymentMethod] = useState("card");
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingState, setProcessingState] = useState(""); // "", "reserving", "initiating", "verifying", "issuing"
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [promoterCode, setPromoterCode] = useState(null);
    const redirectTimeoutRef = useRef(null);

    // Cart reservation and promo code state
    const [cartReservation, setCartReservation] = useState(null);
    const [appliedPromoCode, setAppliedPromoCode] = useState(null);
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoterDiscount, setPromoterDiscount] = useState(0);
    const [pricingResult, setPricingResult] = useState(null);
    const [otherEventReservation, setOtherEventReservation] = useState(null);
    const [feesBreakdownOpen, setFeesBreakdownOpen] = useState(false);
    const paymentInFlightRef = useRef(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get("ref");
            if (ref) {
                setPromoterCode(ref);
                console.log("[Checkout] Promoter code detected:", ref);
            }

            // Recover any active reservation from a previous session
            try {
                const saved = localStorage.getItem("c1rcle_reservation");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const normalizedItems = normalizeReservationItems(parsed.items);
                    // If it's for THIS event, we can auto-restore or show banner
                    if (parsed.eventId === event?.id && new Date(parsed.expiresAt) > new Date()) {
                        setCartReservation({ ...parsed, items: normalizedItems });
                        // If current selection is empty, restore the tickets from reservation
                        if (selectedTickets.length === 0 && normalizedItems.length > 0) {
                            setSelectedTickets(hydrateReservationItems(normalizedItems, event.tickets ?? []));
                        }
                    } else if (new Date(parsed.expiresAt) > new Date()) {
                        // It's for a DIFFERENT event - keep it in state for the cross-event banner
                        setOtherEventReservation({ ...parsed, items: normalizedItems });
                    } else {
                        localStorage.removeItem("c1rcle_reservation");
                    }
                }
            } catch (_) {
                localStorage.removeItem("c1rcle_reservation");
            }
        }
    }, []);

    // Scarcity Engine: poll the Gateway-backed event detail bridge for live tier availability.
    const [liveTiers, setLiveTiers] = useState(null);
    useEffect(() => {
        if (!event?.id || typeof event.id !== "string") {
            return;
        }
        let cancelled = false;

        const syncLiveInventory = async () => {
            try {
                const response = await fetch(`/api/events/${encodeURIComponent(event.id)}`, { cache: "no-store" });
                if (!response.ok) return;

                const payload = await response.json();
                const latestEvent = payload?.event || payload;
                const rawTiers = latestEvent?.ticketCatalog?.tiers ?? latestEvent?.tickets ?? [];
                const tiers = Array.isArray(rawTiers) ? rawTiers : [];

                if (!cancelled) {
                    setLiveTiers(tiers.map((tier) => ({
                        ...tier,
                        _liveAvailable: Math.max(
                            0,
                            Number(tier.remaining ?? tier.quantity ?? 0) - Number(tier.lockedQuantity || 0)
                        ),
                    })));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("[Checkout] Failed to refresh live inventory:", err);
                }
            }
        };

        syncLiveInventory();
        const intervalId = setInterval(syncLiveInventory, 15000);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [event?.id]);

    // Clamp selected quantities when live inventory drops below current selection
    useEffect(() => {
        if (!liveTiers) return;
        setSelectedTickets(prev => {
            const next = prev.map(sel => {
                const live = liveTiers.find(t => t.id === sel.id);
                if (!live) return sel;
                if (sel.quantity > live._liveAvailable) {
                    return live._liveAvailable > 0 ? { ...sel, quantity: live._liveAvailable } : null;
                }
                return sel;
            }).filter(Boolean);
            return next.length !== prev.length || next.some((t, i) => t?.quantity !== prev[i]?.quantity)
                ? next
                : prev;
        });
    }, [liveTiers]);

    useEffect(() => {
        if (user || profile) {
            setAttendeeDetails(prev => ({
                name: prev.name || user?.displayName || profile?.name || "",
                email: prev.email || user?.email || profile?.email || "",
                phone: prev.phone || profile?.phone || ""
            }));
        }
    }, [user, profile]);

    // Fetch authoritative server-side pricing when user reaches payment step
    const selectedTicketSignature = useMemo(
        () => JSON.stringify(normalizeReservationItems(selectedTickets)),
        [selectedTickets]
    );

    useEffect(() => {
        if (step !== 3 || selectedTickets.length === 0) return;
        let cancelled = false;

        const fetchPricing = async () => {
            try {
                const token = user ? await getToken() : null;
                const res = await fetch('/api/checkout/calculate', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        eventId: event.id,
                        items: selectedTickets.map(t => ({ tierId: t.id, quantity: t.quantity })),
                        promoCode: appliedPromoCode,
                        promoterCode
                    })
                });
                const data = await res.json();
                if (!cancelled && data.success) setPricingResult(data.pricing);
            } catch (err) {
                console.error("[Pricing] Failed to calculate authoritative pricing:", err);
            }
        };

        fetchPricing();
        return () => { cancelled = true; };
    }, [step, appliedPromoCode, promoterCode, event?.id, selectedTicketSignature, user, getToken]);

    // Proactively prefetch tickets page for instant navigation on success
    useEffect(() => {
        if (isSuccess) {
            router.prefetch('/tickets');
        }
    }, [isSuccess, router]);

    // Calculate totals with discounts
    const subtotal = useMemo(() => {
        return selectedTickets.reduce((sum, t) => sum + (t.price * t.quantity), 0);
    }, [selectedTickets]);

    const totalDiscount = promoDiscount + promoterDiscount;
    const totalAmount = Math.max(0, subtotal - totalDiscount);
    const displayTotal = pricingResult?.grandTotal ?? totalAmount;
    const displayFees = pricingResult?.fees?.total ?? 0;
    const isFreeOrder = pricingResult ? pricingResult.isFree : totalAmount === 0;
    const feeBreakdown = useMemo(() => {
        const fees = pricingResult?.fees;
        if (!fees) return [];

        return [
            { label: "Platform fee", value: Number(fees.platform) || 0 },
            { label: "Payment fee", value: Number(fees.payment) || 0 },
            { label: "GST on fees", value: Number(fees.gst) || 0 }
        ].filter((item) => item.value > 0);
    }, [pricingResult]);

    // Handle promo code application
    const handleApplyPromoCode = async (code) => {
        try {
            const token = user ? await getToken() : null;
            const res = await fetch(`/api/checkout/promo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    eventId: event.id,
                    code,
                    items: selectedTickets.map(t => ({
                        tierId: t.id,
                        quantity: t.quantity,
                        price: t.price,
                        subtotal: t.price * t.quantity
                    }))
                })
            });
            const data = await res.json();

            if (res.ok && data.valid) {
                setAppliedPromoCode(code);
                setPromoDiscount(data.discountAmount || 0);
                return {
                    valid: true,
                    discountAmount: data.discountAmount,
                    message: data.message || `Discount of ₹${data.discountAmount} applied!`
                };
            } else {
                return {
                    valid: false,
                    error: data.error || "Invalid promo code"
                };
            }
        } catch (err) {
            return {
                valid: false,
                error: "Failed to validate promo code"
            };
        }
    };

    const handleRemovePromoCode = () => {
        setAppliedPromoCode(null);
        setPromoDiscount(0);
    };

    // Handle cart expiration
    const handleCartExpired = () => {
        setCartReservation(null);
        setSelectedTickets([]);
        setError("Your cart reservation has expired. Please select tickets again.");
        setStep(1);
    };

    const totalSelectedQuantity = useMemo(() => {
        return selectedTickets.reduce((sum, t) => sum + Number(t.quantity), 0);
    }, [selectedTickets]);

    const minTickets = event.isRSVP ? 1 : (event.minTicketsPerOrder || 1);
    const maxTickets = event.isRSVP ? 1 : (event.maxTicketsPerOrder || 10);

    const isBelowMin = totalSelectedQuantity > 0 && totalSelectedQuantity < minTickets;
    const isAboveMax = totalSelectedQuantity > maxTickets;

    const canProceedStep1 = totalSelectedQuantity >= minTickets && totalSelectedQuantity <= maxTickets;
    const canProceedStep2 = attendeeDetails.name.trim() !== "" && attendeeDetails.email.trim() !== "";

    const displayTiers = liveTiers ?? event.tickets ?? [];
    const needToKnowItems = useMemo(() => buildNeedToKnowItems(event, selectedTickets), [event, selectedTickets]);

    useEffect(() => {
        if (displayFees <= 0) {
            setFeesBreakdownOpen(false);
        }
    }, [displayFees]);

    const handleTicketChange = (ticketId, delta) => {
        const totalFreeQuantity = selectedTickets.reduce((sum, st) => sum + (Number(st.price || 0) === 0 ? st.quantity : 0), 0);
        const updated = displayTiers.map(t => {
            const sel = selectedTickets.find(st => st.id === t.id);
            const currentQty = sel ? sel.quantity : 0;
            let newQty = currentQty;
            if (t.id === ticketId) {
                if (delta > 0 && totalSelectedQuantity >= maxTickets) {
                    return { ...t, quantity: currentQty };
                }
                newQty = Math.max(0, currentQty + delta);
                const isFree = Number(t.price || 0) === 0;
                const rawAvailable = t._liveAvailable ?? Number(t.remaining ?? t.quantity ?? 10);
                
                let limit = isFree ? 1 : (event.maxTicketsPerOrder || 10);
                if (isFree) {
                    limit = Math.max(0, Math.min(1, currentQty + (1 - totalFreeQuantity)));
                }

                const available = Math.min(rawAvailable, limit);
                if (newQty > available) newQty = available;
            }
            return { ...t, id: t.id, quantity: newQty, price: Number(t.price || 0), name: t.name };
        });
        setSelectedTickets(updated.filter(t => t.quantity > 0));
    };

    const handlePayment = async () => {
        if (paymentInFlightRef.current) return;
        paymentInFlightRef.current = true;
        setIsProcessing(true);
        setError("");
        setProcessingState("initiating");

        try {
            // 1. Ensure user is authenticated
            let token = "";
            if (user) {
                token = await getToken();
            } else {
                const currentPath = window.location.pathname + window.location.search;
                router.push(`/login?next=${encodeURIComponent(currentPath)}`);
                return;
            }

            // 2. Step 1: Reserve Inventory (if not already done or if selection changed)
            let reserveData = cartReservation;
            const currentSelection = normalizeReservationItems(selectedTickets);

            // Check if we need to (re)reserve: No reserve Data OR event mismatch OR expired OR selection changed
            const selectionChanged = !reserveData
                || JSON.stringify(normalizeReservationItems(reserveData.items)) !== JSON.stringify(currentSelection);

            if (!reserveData || reserveData.eventId !== event.id || new Date(reserveData.expiresAt) <= new Date() || selectionChanged) {
                setProcessingState("reserving");
                const reserveRes = await fetch(`/api/checkout/reserve`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        eventId: event.id,
                        items: currentSelection,
                        deviceId: "browser-" + (user?.uid || "anon")
                    })
                });

                reserveData = await reserveRes.json();
                if (!reserveRes.ok) throw new Error(reserveData.error || "Failed to reserve tickets");

                setCartReservation({ ...reserveData, eventId: event.id, items: currentSelection });
                try {
                    localStorage.setItem("c1rcle_reservation", JSON.stringify({
                        reservationId: reserveData.reservationId,
                        eventId: event.id,
                        eventTitle: event.title,
                        expiresAt: reserveData.expiresAt,
                        items: currentSelection
                    }));
                } catch (_) { }
            }

            // 3. Step 2 & 3: Initiate Checkout (Pricing + Draft Order)
            setProcessingState("initiating");
            const initiateRes = await fetch(`/api/checkout/initiate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    reservationId: reserveData.reservationId,
                    userName: attendeeDetails.name,
                    userEmail: attendeeDetails.email,
                    userPhone: attendeeDetails.phone,
                    promoCode: appliedPromoCode,
                    promoterCode
                })
            });

            const initiateData = await initiateRes.json();
            if (!initiateRes.ok) throw new Error(initiateData.error || "Failed to initiate checkout");

            // 4. Step 4: Branching Flow
            if (initiateData.requiresPayment) {
                // Branch A: Paid (>0)
                await handlePayBranch(initiateData, token);
            } else {
                // Branch B & C: Free-Paid or RSVP
                try { localStorage.removeItem("c1rcle_reservation"); } catch (_) { }
                setProcessingState("issuing");
                setIsSuccess(true);
                router.prefetch('/tickets');
                redirectTimeoutRef.current = setTimeout(() => {
                    router.push(`/confirmation/${initiateData.order.id}`);
                }, 4000);
                return;
            }

        } catch (err) {
            console.error("[Checkout] Error:", err);
            setError(err.message || "Something went wrong.");
            setIsProcessing(false);
            setProcessingState("");
        } finally {
            paymentInFlightRef.current = false;
        }
    };

    /**
     * Handle Branch A: Paid Checkout with Razorpay
     */
    const handlePayBranch = async (initiateData, authToken) => {
        return new Promise((resolve, reject) => {
            // Load Razorpay script if not present
            if (!window.Razorpay) {
                const script = document.createElement("script");
                script.src = "https://checkout.razorpay.com/v1/checkout.js";
                script.async = true;
                script.onload = () => launchRazorpay(initiateData, authToken, resolve, reject);
                script.onerror = () => reject(new Error("Failed to load payment gateway"));
                document.body.appendChild(script);
            } else {
                launchRazorpay(initiateData, authToken, resolve, reject);
            }
        });
    };

    const launchRazorpay = (initiateData, authToken, resolve, reject) => {
        // ── DEV MODE: Handle Mock Orders ───────────────────────────────────
        // If the server returned a mock order (because Razorpay keys are missing in .env.local),
        // we bypass the Razorpay SDK and call the verify endpoint directly with mock IDs.
        if (initiateData.razorpay.orderId?.startsWith('order_mock_')) {
            console.log("[Checkout] Mock order detected, confirming via verify endpoint...");
            setProcessingState("verifying");

            (async () => {
                const verifyRes = await fetch(`/api/payments`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        orderId: initiateData.order.id,
                        razorpay_order_id: initiateData.razorpay.orderId,
                        razorpay_payment_id: `pay_mock_${Date.now()}`,
                        razorpay_signature: `sig_mock_${Date.now()}`
                    })
                });

                const verifyData = await verifyRes.json();
                if (!verifyRes.ok) throw new Error(verifyData.error || "Mock payment confirmation failed");

                try { localStorage.removeItem("c1rcle_reservation"); } catch (_) { }
                setProcessingState("issuing");
                setIsSuccess(true);
                router.prefetch('/tickets');
                redirectTimeoutRef.current = setTimeout(() => {
                    router.push(`/confirmation/${initiateData.order.id}`);
                    resolve();
                }, 3000);
            })().catch(err => {
                setError(err.message);
                setIsProcessing(false);
                reject(err);
            });
            return;
        }

        // ── PRODUCTION: Launch real Razorpay ───────────────────────────────
        const options = {
            key: initiateData.razorpay.key || "rzp_test_DEVELOPMENT",
            amount: initiateData.razorpay.amount,
            currency: initiateData.razorpay.currency,
            name: "THE C1RCLE",
            description: "Passes for " + event.title,
            order_id: initiateData.razorpay.orderId,
            handler: async function (response) {
                try {
                    setProcessingState("verifying");
                    const verifyRes = await fetch(`/api/payments`, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            orderId: initiateData.order.id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    const verifyData = await verifyRes.json();
                    if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed");

                    try { localStorage.removeItem("c1rcle_reservation"); } catch (_) { }
                    setProcessingState("issuing");
                    setIsSuccess(true);
                    router.prefetch('/tickets');

                    // Auto-redirect to confirmation if they don't click anything
                    redirectTimeoutRef.current = setTimeout(() => {
                        router.push(`/confirmation/${initiateData.order.id}`);
                        resolve();
                    }, 4000); 
                } catch (err) {
                    setError(err.message);
                    setIsProcessing(false);
                    reject(err);
                }
            },
            modal: {
                ondismiss: function () {
                    setIsProcessing(false);
                    setProcessingState("");
                    setError("Payment cancelled");
                    reject(new Error("Payment cancelled"));
                }
            },
            prefill: {
                name: attendeeDetails.name,
                email: attendeeDetails.email,
                contact: attendeeDetails.phone
            },
            theme: { color: "#1d1d1f" }
        };

        try {
            const rzp = new window.Razorpay(options);
            
            // Safety Timeout: If Razorpay doesn't open or respond in 10s, reset UI
            const timeoutId = setTimeout(() => {
                if (isProcessing && !isSuccess) {
                    setIsProcessing(false);
                    setProcessingState("");
                    setError("Payment gateway timed out. Please try again or check your internet.");
                    reject(new Error("Timeout"));
                }
            }, 10000);

            rzp.on('payment.failed', function (response) {
                clearTimeout(timeoutId);
                setError(response.error.description);
                setIsProcessing(false);
                reject(new Error(response.error.description));
            });

            rzp.open();
        } catch (err) {
            console.error("[Checkout] Razorpay Launch Error:", err);
            setIsProcessing(false);
            setProcessingState("");
            setError("Could not launch payment window. Please disable ad-blockers.");
            reject(err);
        }
    };

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
                                        const totalFreeQuantity = selectedTickets.reduce((sum, st) => sum + (Number(st.price || 0) === 0 ? st.quantity : 0), 0);
                                        const isFree = Number(ticket.price || 0) === 0;
                                        const rawAvailable = ticket._liveAvailable ?? Number(ticket.remaining ?? ticket.quantity ?? 0);
                                        
                                        let ticketLimit = isFree ? 1 : (event.maxTicketsPerOrder || 10);
                                        if (isFree) {
                                            ticketLimit = Math.max(0, Math.min(1, qty + (1 - totalFreeQuantity)));
                                        }
                                        
                                        const available = Math.min(rawAvailable, ticketLimit);
                                        const isSoldOut = rawAvailable <= 0;
                                        const isLow = !isSoldOut && rawAvailable <= 5;
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
                                                            <button onClick={() => handleTicketChange(ticket.id, -1)} disabled={qty === 0} className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-20">-</button>
                                                            <span className="w-5 text-center font-bold text-[14px] text-white">{qty}</span>
                                                            <button onClick={() => handleTicketChange(ticket.id, 1)} disabled={qty >= available} className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-20">+</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="space-y-2">
                                    {isBelowMin && (
                                        <p className="text-[10px] text-orange font-bold uppercase tracking-widest text-center">Minimum {minTickets} tickets required</p>
                                    )}
                                    {isAboveMax && (
                                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center">Maximum {maxTickets} tickets allowed per account</p>
                                    )}
                                    <button 
                                        onClick={() => setStep(2)} 
                                        disabled={!canProceedStep1} 
                                        className="w-full h-[64px] flex items-center justify-center rounded-full bg-[#CA3E22] text-white font-black uppercase tracking-[0.3em] transition-all hover:bg-[#D44426] hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:bg-[#CA3E22] shadow-[0_4px_30px_rgba(202,62,34,0.3)] text-[12px]"
                                    >
                                        CONTINUE • ₹{subtotal.toLocaleString('en-IN')}
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
                                {!isFreeOrder && (
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
                                                <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Secure Payment Protocol Active</p>
                                            </div>
                                            <p className="text-[9px] leading-relaxed text-white/30 uppercase tracking-widest">By proceeding, you authorize THE C1RCLE to process payment and issue tickets. No refunds allowed.</p>
                                        </div>
                                    </div>
                                )}

                                {isFreeOrder && (
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
                                <button onClick={handlePayment} disabled={isProcessing} className="w-full h-16 flex items-center justify-center rounded-full bg-orange text-white font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 group shadow-[0_20px_40px_rgba(255,165,0,0.2)]">
                                    {isProcessing ? (
                                        <div className="flex items-center gap-3">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <span className="text-[10px] uppercase font-black tracking-widest">{processingState}...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {event.isRSVP ? "Confirm Registration" : isFreeOrder ? "Finalize Free Pass" : "Confirm Order"}
                                            <Lock className="ml-3 h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="mt-6 md:hidden">
                        <NeedToKnowCard items={needToKnowItems} />
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
                                            <p className="shrink-0 text-[18px] font-black tracking-tight text-white">₹{(t.price * t.quantity).toLocaleString('en-IN')}</p>
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
                                <span className="text-[13px] font-semibold text-white/68">₹{subtotal.toLocaleString('en-IN')}</span>
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
                                    <p className="text-[44px] font-black leading-none tracking-[-0.05em] text-white">₹{displayTotal.toLocaleString('en-IN')}</p>
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
                                                    processingState === "issuing" ? "Generating identity keys..." :
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
                                    if (redirectTimeoutRef.current) {
                                        clearTimeout(redirectTimeoutRef.current);
                                    }
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
