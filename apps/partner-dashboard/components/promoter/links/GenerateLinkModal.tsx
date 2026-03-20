"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Link2,
    Copy,
    CheckCircle2,
    ChevronDown,
    Loader2
} from "lucide-react";
import { mapEventForClient } from "@c1rcle/core/events";

function sanitizeLabel(val: string) {
    return val.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

interface GenerateLinkModalProps {
    promoterId: string;
    promoterName?: string;
    token?: string;
    onClose: () => void;
    onCreated: (link: any) => void;
}

export default function GenerateLinkModal({
    promoterId,
    promoterName,
    token,
    onClose,
    onCreated
}: GenerateLinkModalProps) {
    const [events, setEvents] = useState<any[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [campaignLabel, setCampaignLabel] = useState("");
    const [generating, setGenerating] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<any>(null);
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [copied, setCopied] = useState(false);
    const [eventDropdownOpen, setEventDropdownOpen] = useState(false);

    useEffect(() => {
        async function loadEvents() {
            try {
                const res = await fetch(`/api/promoter/events?promoterId=${promoterId}&limit=50`);
                if (res.ok) {
                    const data = await res.json();
                    const mapped = (data.events || []).map((e: any) => mapEventForClient(e, e.id));
                    setEvents(mapped.filter((e: any) => e.isPublic !== false));
                }
            } catch (e) {
                console.error("[GenerateLinkModal] Failed to load events:", e);
            } finally {
                setEventsLoading(false);
            }
        }
        loadEvents();
    }, [promoterId]);

    const handleGenerate = useCallback(async () => {
        if (!selectedEventId || !campaignLabel.trim()) return;
        setGenerating(true);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch("/api/promoter/links", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    promoterId,
                    promoterName: promoterName || "Promoter",
                    eventId: selectedEventId,
                    campaignLabel: sanitizeLabel(campaignLabel)
                })
            });

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
    }, [selectedEventId, campaignLabel, promoterId, promoterName, token, onCreated]);

    const buildDisplayUrl = (link: any) => {
        const event = events.find(e => e.id === link.eventId);
        const slug = event?.slug || link.eventId;
        const ref = link.code || link.shortId || link.token || link.id;
        return `https://c1rcle.app/e/${slug}?ref=${ref}&s=${link.channel || "organic"}`;
    };

    const handleCopy = () => {
        if (!generatedLink) return;
        navigator.clipboard.writeText(buildDisplayUrl(generatedLink));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleReset = () => {
        setGeneratedLink(null);
        setIsDuplicate(false);
        setCopied(false);
        setCampaignLabel("");
    };

    const selectedEvent = events.find(e => e.id === selectedEventId);
    const canGenerate = selectedEventId && campaignLabel.trim().length > 0 && !generating;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-md"
                style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "2rem",
                    overflow: "hidden"
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: "rgba(124,58,237,0.15)" }}>
                            <Link2 size={16} style={{ color: "#a78bfa" }} />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
                                New Link
                            </h2>
                            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                Create a tracking link to share
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={{ color: "var(--text-tertiary)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-fill)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                        <X size={16} />
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
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block"
                                    style={{ color: "var(--text-tertiary)" }}>
                                    Event
                                </label>
                                <div className="relative">
                                    <button
                                        onClick={() => setEventDropdownOpen(v => !v)}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                                        style={{
                                            background: "var(--bg-fill)",
                                            border: "1px solid var(--border-subtle)",
                                            color: selectedEvent
                                                ? "var(--text-primary)"
                                                : "var(--text-tertiary)",
                                            fontSize: 13
                                        }}
                                    >
                                        <span className="truncate">
                                            {eventsLoading
                                                ? "Loading events..."
                                                : selectedEvent
                                                    ? (selectedEvent.name || selectedEvent.title)
                                                    : "Select an event"}
                                        </span>
                                        <ChevronDown size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                    </button>

                                    {eventDropdownOpen && !eventsLoading && (
                                        <div
                                            className="absolute top-full left-0 right-0 mt-1 z-10 rounded-xl overflow-hidden"
                                            style={{
                                                background: "var(--bg-elevated)",
                                                border: "1px solid var(--border-subtle)",
                                                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                                                maxHeight: 200,
                                                overflowY: "auto"
                                            }}
                                        >
                                            {events.length === 0 ? (
                                                <div className="px-4 py-3 text-[13px]"
                                                    style={{ color: "var(--text-tertiary)" }}>
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
                                                        className="w-full text-left px-4 py-2.5 text-[13px] transition-all"
                                                        style={{
                                                            color: "var(--text-primary)",
                                                            background: selectedEventId === event.id
                                                                ? "var(--bg-fill)"
                                                                : "transparent"
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-fill)")}
                                                        onMouseLeave={e => (e.currentTarget.style.background = selectedEventId === event.id ? "var(--bg-fill)" : "transparent")}
                                                    >
                                                        {event.name || event.title}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Campaign label */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block"
                                    style={{ color: "var(--text-tertiary)" }}>
                                    Label
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. story_mar17"
                                    value={campaignLabel}
                                    onChange={e => setCampaignLabel(e.target.value)}
                                    maxLength={42}
                                    className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all"
                                    style={{
                                        background: "var(--bg-fill)",
                                        border: "1px solid var(--border-subtle)",
                                        color: "var(--text-primary)"
                                    }}
                                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
                                    onBlur={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                                />
                                {campaignLabel && (
                                    <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                                        Saved as: <span style={{ color: "#a78bfa" }}>{sanitizeLabel(campaignLabel)}</span>
                                    </p>
                                )}
                            </div>

                            {/* Generate button */}
                            <button
                                onClick={handleGenerate}
                                disabled={!canGenerate}
                                className="w-full py-3.5 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: canGenerate ? "var(--c1rcle-orange, #F44A22)" : "var(--bg-fill)",
                                    color: canGenerate ? "#fff" : "var(--text-tertiary)",
                                    cursor: canGenerate ? "pointer" : "not-allowed"
                                }}
                            >
                                {generating ? (
                                    <><Loader2 size={15} className="animate-spin" /> Generating...</>
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
                                style={{ background: "var(--bg-fill)", border: "1px solid var(--border-subtle)" }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider"
                                    style={{ color: "var(--text-tertiary)" }}>
                                    Your tracking link
                                </p>
                                <p className="text-[12px] font-mono break-all leading-relaxed"
                                    style={{ color: "var(--text-primary)" }}>
                                    {buildDisplayUrl(generatedLink)}
                                </p>
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
                                onClick={handleReset}
                                className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                                style={{
                                    color: "var(--text-tertiary)",
                                    background: "transparent"
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}
                            >
                                + Create another
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
