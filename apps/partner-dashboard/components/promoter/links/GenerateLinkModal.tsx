"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Link2,
    Copy,
    CheckCircle2,
    PencilLine,
    ChevronDown,
    Loader2,
    Share,
    Download
} from "lucide-react";
import { mapEventForClient } from "@c1rcle/core/events";
import EditLinkModal from "./EditLinkModal";

const getGuestPortalUrl = () => {
    if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GUEST_PORTAL_URL) {
        return process.env.NEXT_PUBLIC_GUEST_PORTAL_URL;
    }
    if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL) {
        return process.env.NEXT_PUBLIC_SITE_URL;
    }
    if (typeof window !== "undefined") {
        return window.location.origin;
    }
    return "https://thec1rcle.com";
};
const GUEST_PORTAL_URL = getGuestPortalUrl();

function sanitizeLabel(val: string) {
    return val.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

function getQRCodeUrl(data: string, size = 200) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=FFFFFF&color=000000&margin=10`;
}

interface GenerateLinkModalProps {
    promoterId: string;
    promoterName?: string;
    token?: string;
    onClose: () => void;
    onCreated: (link: any) => void;
    initialEventId?: string;
    lockEvent?: boolean;
    preloadedEvent?: any;
}

export default function GenerateLinkModal({
    promoterId,
    promoterName,
    token,
    onClose,
    onCreated,
    initialEventId,
    lockEvent = false,
    preloadedEvent,
}: GenerateLinkModalProps) {
    const [events, setEvents] = useState<any[]>(preloadedEvent ? [preloadedEvent] : []);
    const [eventsLoading, setEventsLoading] = useState(!preloadedEvent);
    const [selectedEventId, setSelectedEventId] = useState(initialEventId || "");
    const [selectedTicketTierIds, setSelectedTicketTierIds] = useState<string[]>([]);
    const [customTrackingCode, setCustomTrackingCode] = useState("");
    const [customTrackingCodeError, setCustomTrackingCodeError] = useState("");
    const [generating, setGenerating] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<any>(null);
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [copied, setCopied] = useState(false);
    const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
    const [editingGeneratedLink, setEditingGeneratedLink] = useState(false);

    useEffect(() => {
        if (preloadedEvent && lockEvent) {
            setEventsLoading(false);
            return;
        }
        async function loadEvents() {
            try {
                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;
                const res = await fetch("/api/partners/promoters/events?limit=50", { headers });
                if (res.ok) {
                    const data = await res.json();
                    const mapped = (data.events || []).map((e: any) => mapEventForClient(e, e.id));
                    setEvents(mapped.filter((e: any) => e.isPublic !== false));
                } else {
                    console.error("[GenerateLinkModal] Failed to load events:", await res.text());
                }
            } catch (e) {
                console.error("[GenerateLinkModal] Failed to load events:", e);
            } finally {
                setEventsLoading(false);
            }
        }
        loadEvents();
    }, [promoterId, token, preloadedEvent, lockEvent]);

    useEffect(() => {
        if (initialEventId) {
            setSelectedEventId(initialEventId);
        }
    }, [initialEventId]);

    useEffect(() => {
        setSelectedTicketTierIds([]);
    }, [selectedEventId]);

    const handleGenerate = useCallback(async () => {
        if (!selectedEventId) return;
        setGenerating(true);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch("/api/partners/promoters/links", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    promoterName: promoterName || "Promoter",
                    eventId: selectedEventId,
                    ticketTierIds: selectedTicketTierIds,
                    customTrackingCode: customTrackingCode || undefined,
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                const errMsg = errData?.error?.message || errData?.error || "";
                if (errMsg.includes("taken") || res.status === 409) {
                    setCustomTrackingCodeError("This code is already taken. Please choose another.");
                }
                console.error("[GenerateLinkModal] Generate failed with status:", res.status, errData);
                return;
            }

            const data = await res.json();
            if (data.link) {
                setGeneratedLink(data.link);
                setIsDuplicate(!!data.duplicate);
                onCreated(data.link);
            }
        } catch (e) {
            console.error("[GenerateLinkModal] Generate failed:", e);
        } finally {
            setGenerating(false);
        }
    }, [selectedEventId, selectedTicketTierIds, promoterId, promoterName, token, onCreated]);

    const buildDisplayUrl = (link: any) => {
        if (link.fullUrl) return link.fullUrl;
        
        if (link.vanityAlias || link.vanitySlug) {
            const alias = link.vanityAlias || link.vanitySlug;
            const prefix = link.vanityPrefix || `${GUEST_PORTAL_URL}/event/`;
            return `${prefix}${alias}`;
        }
        
        const event = events.find(e => e.id === link.eventId);
        const slug = event?.slug || link.eventId;
        const ref = link.code || link.shortId || link.token || link.id;
        const channel = link.channel ? `&s=${encodeURIComponent(link.channel)}` : "";
        return `${GUEST_PORTAL_URL}/event/${slug}?ref=${encodeURIComponent(ref)}${channel}`;
    };

    const handleCopy = () => {
        if (!generatedLink) return;
        navigator.clipboard.writeText(buildDisplayUrl(generatedLink));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleNativeShare = async () => {
        if (!generatedLink) return;
        const url = buildDisplayUrl(generatedLink);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: generatedLink.eventTitle || 'Event',
                    text: 'Get your tickets here!',
                    url: url
                });
            } catch (e) {
                console.error(e);
            }
        } else {
            handleCopy();
        }
    };

    const handleWhatsAppShare = () => {
        if (!generatedLink) return;
        const url = buildDisplayUrl(generatedLink);
        const text = encodeURIComponent(`Get your tickets here! ${url}`);
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };

    const handleIGShare = () => {
        if (!generatedLink) return;
        handleCopy();
        setTimeout(() => {
            window.location.href = "instagram://app";
        }, 300);
    };

    const handleReset = () => {
        setGeneratedLink(null);
        setIsDuplicate(false);
        setCopied(false);
        setEditingGeneratedLink(false);
        setSelectedTicketTierIds([]);
        setCustomTrackingCode("");
        setCustomTrackingCodeError("");
        if (!lockEvent) {
            setSelectedEventId(initialEventId || "");
        }
    };

    const selectedEvent = events.find(e => e.id === selectedEventId);
    const promoterEnabledTiers = (selectedEvent?.tickets || []).filter((tier: any) => tier.promoterEnabled !== false);
    const canGenerate = selectedEventId && !generating;

    const toggleTicketTier = (tierId: string) => {
        setSelectedTicketTierIds((current) =>
            current.includes(tierId)
                ? current.filter((id) => id !== tierId)
                : [...current, tierId]
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="w-full max-w-md bg-[#0A0A0C] border border-white/10 rounded-[24px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.8)] relative"
            >
                {/* Subtle top glow */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                            <Link2 size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight">
                                New Link
                            </h2>
                            <p className="text-xs font-medium text-text-tertiary">
                                Create a tracking link to share
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {!generatedLink ? (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="px-6 pb-6 space-y-4"
                        >
                            {/* Event selector */}
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2 block">
                                    Event
                                </label>
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            if (!lockEvent) setEventDropdownOpen(v => !v);
                                        }}
                                        disabled={lockEvent}
                                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all ${lockEvent ? "bg-white/[0.02] border border-transparent cursor-default" : "bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 cursor-pointer"}`}
                                    >
                                        <span className="truncate font-semibold text-white/90 text-[14px]">
                                            {eventsLoading
                                                ? "Loading events..."
                                                : selectedEvent
                                                    ? (selectedEvent.name || selectedEvent.title)
                                                    : "Select an event"}
                                        </span>
                                        {!lockEvent ? (
                                            <ChevronDown size={16} className="text-text-tertiary flex-shrink-0" />
                                        ) : null}
                                    </button>

                                    {eventDropdownOpen && !eventsLoading && !lockEvent && (
                                        <div className="absolute top-full left-0 right-0 mt-2 z-10 rounded-xl overflow-hidden bg-[#151518] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-h-48 overflow-y-auto">
                                            {events.length === 0 ? (
                                                <div className="px-4 py-3 text-[13px] text-text-tertiary">
                                                    No events available
                                                </div>
                                            ) : (
                                                events.map(event => (
                                                    <button
                                                        key={event.id}
                                                        onClick={() => {
                                                            setSelectedEventId(event.id);
                                                            setEventDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-3 text-[13px] font-medium transition-colors ${selectedEventId === event.id ? "bg-emerald-500/10 text-emerald-400" : "text-white/80 hover:bg-white/5 hover:text-white"}`}
                                                    >
                                                        {event.name || event.title}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Ticket Tiers */}
                            {promoterEnabledTiers.length > 0 && (
                                <div className="mt-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2 block">
                                        Commissionable Ticket Tiers
                                    </label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {promoterEnabledTiers.map((tier: any) => (
                                            <label key={tier.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition-colors">
                                                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${selectedTicketTierIds.includes(tier.id) ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 bg-black/50'}`}>
                                                    {selectedTicketTierIds.includes(tier.id) && (
                                                        <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-black" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    )}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={selectedTicketTierIds.includes(tier.id)}
                                                    onChange={() => toggleTicketTier(tier.id)}
                                                />
                                                <div className="flex-1 flex justify-between items-center">
                                                    <span className="text-[13px] font-medium text-white/90 truncate mr-2">{tier.name || 'Unnamed Tier'}</span>
                                                    <span className="text-[12px] text-text-tertiary font-medium whitespace-nowrap">{tier.price ? `$${tier.price}` : 'Free'}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-text-tertiary mt-2 ml-1">
                                        Select the tickets this link applies to. Leave blank to apply to all enabled tickets.
                                    </p>
                                </div>
                            )}

                            {/* Custom Tracking Code Input */}
                            <div className="mt-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2 block">
                                    Global Tracking Code (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. aayush333"
                                    value={customTrackingCode}
                                    onChange={(e) => {
                                        setCustomTrackingCode(e.target.value);
                                        setCustomTrackingCodeError("");
                                    }}
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                />
                                {customTrackingCodeError ? (
                                    <p className="text-[11px] text-red-400 mt-2 ml-1">{customTrackingCodeError}</p>
                                ) : (
                                    <p className="text-[11px] text-text-tertiary mt-2 ml-1">
                                        If you don't have a code yet, enter your desired permanent code. Leave blank to auto-generate.
                                    </p>
                                )}
                            </div>

                            {/* Generate button */}
                            <button
                                onClick={handleGenerate}
                                disabled={!canGenerate}
                                className="w-full py-3.5 rounded-xl text-[15px] font-bold transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.2)] bg-gradient-to-r from-emerald-400 to-teal-400 text-black hover:opacity-90"
                            >
                                {generating ? (
                                    <><Loader2 size={16} className="animate-spin" /> Generating...</>
                                ) : (
                                    "Generate Link"
                                )}
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="px-6 pb-6 space-y-4"
                        >
                            {isDuplicate && (
                                <div className="px-4 py-2.5 rounded-xl text-[12px] font-medium"
                                    style={{ background: "rgba(124,58,237,0.1)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.2)" }}>
                                    Link already exists — here it is
                                </div>
                            )}

                            <div className="rounded-xl p-4 space-y-3"
                                style={{ background: "var(--v-elevated, #222226)", border: "1px solid var(--v-border, rgba(255,255,255,0.08))" }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider"
                                    style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                                    Your tracking link
                                </p>
                                <p className="text-[12px] font-mono break-all leading-relaxed"
                                    style={{ color: "var(--v-text-primary, #fafafa)" }}>
                                    {buildDisplayUrl(generatedLink)}
                                </p>
                            </div>

                            <div className="rounded-xl p-4 flex flex-col items-center gap-3"
                                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--v-border, rgba(255,255,255,0.08))" }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider"
                                    style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                                    QR Code
                                </p>
                                <img
                                    src={getQRCodeUrl(buildDisplayUrl(generatedLink), 220)}
                                    alt="Promoter link QR code"
                                    className="h-44 w-44 rounded-2xl bg-white p-3"
                                />
                                    <div className="flex gap-2 w-full mt-2">
                                        <button
                                            onClick={handleNativeShare}
                                            className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-center transition-all flex items-center justify-center gap-1.5"
                                            style={{
                                                background: "var(--v-elevated, #222226)",
                                                color: "var(--v-text-primary, #fafafa)",
                                                border: "1px solid var(--v-border, rgba(255,255,255,0.08))"
                                            }}
                                        >
                                            <Share size={14} /> Share
                                        </button>
                                        <button
                                            onClick={handleWhatsAppShare}
                                            className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-center transition-all flex items-center justify-center gap-1.5"
                                            style={{
                                                background: "rgba(37,211,102,0.1)",
                                                color: "#25D366",
                                                border: "1px solid rgba(37,211,102,0.2)"
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                                            </svg> WhatsApp
                                        </button>
                                        <button
                                            onClick={handleIGShare}
                                            className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-center transition-all flex items-center justify-center gap-1.5"
                                            style={{
                                                background: "rgba(225,48,108,0.1)",
                                                color: "#E1306C",
                                                border: "1px solid rgba(225,48,108,0.2)"
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.036 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
                                            </svg> IG
                                        </button>
                                        <a
                                            href={getQRCodeUrl(buildDisplayUrl(generatedLink), 512)}
                                            download={`promoter-link-${generatedLink.code || generatedLink.id}.png`}
                                            className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-center transition-all flex items-center justify-center gap-1.5"
                                            style={{
                                                background: "var(--v-elevated, #222226)",
                                                color: "var(--v-text-primary, #fafafa)",
                                                border: "1px solid var(--v-border, rgba(255,255,255,0.08))"
                                            }}
                                        >
                                            <Download size={14} /> QR
                                        </a>
                                    </div>
                                </div>

                                <button
                                onClick={handleCopy}
                                className="w-full py-3.5 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: copied ? "rgba(52,211,153,0.15)" : "var(--c1rcle-orange, #F44A22)",
                                    color: copied ? "#34d399" : "#fff",
                                    border: copied ? "1px solid rgba(52,211,153,0.3)" : "none"
                                }}
                            >
                                {copied ? (
                                    <><CheckCircle2 size={15} /> Copied!</>
                                ) : (
                                    <><Copy size={15} /> Copy Link</>
                                )}
                            </button>

                            <button
                                onClick={() => setEditingGeneratedLink(true)}
                                className="w-full py-3 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: "var(--v-elevated, #222226)",
                                    color: "var(--v-text-primary, #fafafa)",
                                    border: "1px solid var(--v-border, rgba(255,255,255,0.08))"
                                }}
                            >
                                <PencilLine size={15} />
                                Edit Link
                            </button>

                            <button
                                onClick={handleReset}
                                className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                                style={{
                                    color: "var(--v-text-tertiary, #a1a1aa)",
                                    background: "transparent"
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = "var(--v-text-primary, #fafafa)")}
                                onMouseLeave={e => (e.currentTarget.style.color = "var(--v-text-tertiary, #a1a1aa)")}
                            >
                                + Create another
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <AnimatePresence>
                {editingGeneratedLink && generatedLink ? (
                    <EditLinkModal
                        link={generatedLink}
                        token={token}
                        onClose={() => setEditingGeneratedLink(false)}
                        onSaved={(updatedLink) => {
                            setGeneratedLink(updatedLink);
                            onCreated(updatedLink);
                        }}
                    />
                ) : null}
            </AnimatePresence>
        </div>
    );
}
