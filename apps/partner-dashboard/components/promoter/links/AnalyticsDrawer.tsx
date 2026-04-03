"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCircle2, AlertTriangle, Loader2, TrendingUp } from "lucide-react";

const GUEST_PORTAL_URL =
    process.env.NEXT_PUBLIC_GUEST_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

interface AnalyticsDrawerProps {
    linkId: string | null;
    token?: string;
    onClose: () => void;
    onDeactivated: (linkId: string) => void;
    onReactivated: (linkId: string) => void;
}

function formatINR(paise: number) {
    if (!paise) return "₹0";
    const rupees = paise / 100;
    if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
    if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
    return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}

function getQRCodeUrl(data: string, size = 200) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=FFFFFF&color=000000&margin=10`;
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const width = max > 0 ? `${(value / max) * 100}%` : "0%";
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>{label}</span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--v-text-primary, #fafafa)" }}>
                    {value.toLocaleString()} {max > 0 && value !== max && <span style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>({pct}%)</span>}
                </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--v-elevated, #222226)" }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                />
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-3 rounded-xl" style={{ background: "var(--v-elevated, #222226)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                {label}
            </p>
            <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--v-text-primary, #fafafa)" }}>
                {value}
            </p>
        </div>
    );
}

export default function AnalyticsDrawer({ linkId, token, onClose, onDeactivated, onReactivated }: AnalyticsDrawerProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [confirmDeactivate, setConfirmDeactivate] = useState(false);
    const [confirmReactivate, setConfirmReactivate] = useState(false);
    const [deactivating, setDeactivating] = useState(false);

    useEffect(() => {
        if (!linkId) return;
        setData(null);
        setLoading(true);
        setConfirmDeactivate(false);
        setConfirmReactivate(false);

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        fetch(`/api/promoter/links/${linkId}/analytics`, { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => setData(d))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [linkId, token]);

    const handleCopy = () => {
        if (!data?.link) return;
        const link = data.link;
        const slug = link.eventSlug || link.eventId || "";
        const ref = link.code || link.shortId || link.token || link.id;
        const url = link.fullUrl || `${GUEST_PORTAL_URL}/e/${slug}?ref=${ref}&s=${link.channel || ""}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleDeactivate = async () => {
        if (!linkId) return;
        setDeactivating(true);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`/api/promoter/links/${linkId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ action: "deactivate" })
            });
            if (res.ok) {
                onDeactivated(linkId);
                onClose();
            }
        } catch (e) {
            console.error("[AnalyticsDrawer] Deactivate failed:", e);
        } finally {
            setDeactivating(false);
            setConfirmDeactivate(false);
        }
    };

    const handleReactivate = async () => {
        if (!linkId) return;
        setDeactivating(true);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`/api/promoter/links/${linkId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ action: "reactivate" })
            });
            if (res.ok) {
                onReactivated(linkId);
                onClose();
            }
        } catch (e) {
            console.error("[AnalyticsDrawer] Reactivate failed:", e);
        } finally {
            setDeactivating(false);
            setConfirmReactivate(false);
        }
    };

    const link = data?.link;
    const funnel = data?.funnel || { clicks: 0, conversions: 0, revenue: 0 };
    const status = link?.status || "active";
    const isActive = status === "active";
    const linkUrl = link
        ? (link.fullUrl || `${GUEST_PORTAL_URL}/e/${link.eventSlug || link.eventId || ""}?ref=${link.code || link.shortId || link.token || link.id}${link.channel ? `&s=${link.channel}` : ""}`)
        : "";

    const statusColor = isActive ? "#34d399" : "#71717a";
    const statusBg = isActive ? "rgba(52,211,153,0.1)" : "rgba(113,113,122,0.1)";
    const statusLabel = status === "deactivated" ? "Deactivated" : status === "expired" ? "Expired" : "Active";

    return (
        <AnimatePresence>
            {linkId && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40"
                        style={{ background: "rgba(0,0,0,0.4)" }}
                    />

                    {/* Drawer */}
                    <motion.div
                        key="drawer"
                        initial={{ x: 400 }}
                        animate={{ x: 0 }}
                        exit={{ x: 400 }}
                        transition={{ type: "spring", damping: 28, stiffness: 280 }}
                        className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-y-auto"
                        style={{
                            width: 400,
                            background: "var(--v-card, #1a1a1d)",
                            borderLeft: "1px solid var(--v-border, rgba(255,255,255,0.08))"
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between p-6 pb-4">
                            <div className="flex-1 min-w-0 pr-4">
                                {loading || !link ? (
                                    <div className="space-y-2">
                                        <div className="h-4 w-40 rounded animate-pulse" style={{ background: "var(--v-elevated, #222226)" }} />
                                        <div className="h-3 w-28 rounded animate-pulse" style={{ background: "var(--v-elevated, #222226)" }} />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-[15px] font-bold truncate" style={{ color: "var(--v-text-primary, #fafafa)" }}>
                                                {link.campaignLabel || link.label || link.code || "Link"}
                                            </h3>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0"
                                                style={{ background: statusBg, color: statusColor }}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                        <p className="text-[12px] truncate" style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                                            {link.eventTitle || link.eventId}
                                        </p>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "var(--v-elevated, #222226)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="px-6 pb-6 space-y-5 flex-1">
                            {loading ? (
                                <div className="space-y-3 pt-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--v-elevated, #222226)" }} />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {/* 4 stats */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <StatCard label="Clicks" value={(funnel.clicks || 0).toLocaleString()} />
                                        <StatCard label="Sales" value={(funnel.conversions || 0).toLocaleString()} />
                                        <StatCard label="Revenue" value={formatINR(funnel.revenue || 0)} />
                                        <StatCard label="Earnings" value={
                                            link?.commission != null
                                                ? formatINR(link.commission)
                                                : link?.clearedCommission != null
                                                    ? formatINR(link.clearedCommission)
                                                    : "—"
                                        } />
                                    </div>

                                    {/* Conversion funnel */}
                                    <div className="p-4 rounded-xl space-y-3"
                                        style={{ background: "var(--v-elevated, #222226)", border: "1px solid var(--v-border, rgba(255,255,255,0.08))" }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <TrendingUp size={13} style={{ color: "#a78bfa" }} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider"
                                                style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                                                Conversion Funnel
                                            </span>
                                        </div>
                                        <FunnelBar label="Clicks" value={funnel.clicks || 0} max={funnel.clicks || 0} color="#818cf8" />
                                        <FunnelBar label="Sales" value={funnel.conversions || 0} max={funnel.clicks || 0} color="#34d399" />
                                        <FunnelBar label="Cleared" value={funnel.cleared || 0} max={funnel.clicks || 0} color="#f59e0b" />
                                    </div>

                                    {/* Actions */}
                                    {linkUrl && (
                                        <div className="rounded-xl p-4 flex flex-col items-center gap-3"
                                            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--v-border, rgba(255,255,255,0.08))" }}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider"
                                                style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                                                QR Code
                                            </p>
                                            <img
                                                src={getQRCodeUrl(linkUrl, 220)}
                                                alt="Promoter link QR code"
                                                className="h-40 w-40 rounded-2xl bg-white p-3"
                                            />
                                            <a
                                                href={getQRCodeUrl(linkUrl, 512)}
                                                download={`promoter-link-${link.code || link.id}.png`}
                                                className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-center transition-all"
                                                style={{
                                                    background: "var(--v-elevated, #222226)",
                                                    color: "var(--v-text-primary, #fafafa)",
                                                    border: "1px solid var(--v-border, rgba(255,255,255,0.08))"
                                                }}
                                            >
                                                Download QR
                                            </a>
                                        </div>
                                    )}

                                    <div className="space-y-2 pt-1">
                                        <button
                                            onClick={handleCopy}
                                            className="w-full py-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all"
                                            style={{
                                                background: copied ? "rgba(52,211,153,0.15)" : "var(--c1rcle-orange, #F44A22)",
                                                color: copied ? "#34d399" : "#fff",
                                                border: copied ? "1px solid rgba(52,211,153,0.3)" : "none"
                                            }}
                                        >
                                            {copied ? <><CheckCircle2 size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
                                        </button>

                                        {isActive && !confirmDeactivate && (
                                            <button
                                                onClick={() => setConfirmDeactivate(true)}
                                                className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all"
                                                style={{
                                                    background: "transparent",
                                                    color: "var(--v-text-tertiary, #a1a1aa)",
                                                    border: "1px solid var(--v-border, rgba(255,255,255,0.08))"
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.color = "#f87171";
                                                    e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)";
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.color = "var(--v-text-tertiary, #a1a1aa)";
                                                    e.currentTarget.style.borderColor = "var(--v-border, rgba(255,255,255,0.08))";
                                                }}
                                            >
                                                Deactivate Link
                                            </button>
                                        )}

                                        {!isActive && !confirmReactivate && status !== "expired" && (
                                            <button
                                                onClick={() => setConfirmReactivate(true)}
                                                className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all"
                                                style={{
                                                    background: "transparent",
                                                    color: "#34d399",
                                                    border: "1px solid rgba(52,211,153,0.22)"
                                                }}
                                            >
                                                Reactivate Link
                                            </button>
                                        )}

                                        {isActive && confirmDeactivate && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="rounded-xl p-4 space-y-3"
                                                style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
                                                    <p className="text-[12px]" style={{ color: "#f87171" }}>
                                                        Disable this link? Clicks will no longer be tracked.
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleDeactivate}
                                                        disabled={deactivating}
                                                        className="flex-1 py-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all"
                                                        style={{ background: "#f87171", color: "#fff" }}
                                                    >
                                                        {deactivating ? <Loader2 size={12} className="animate-spin" /> : null}
                                                        {deactivating ? "Disabling..." : "Confirm"}
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeactivate(false)}
                                                        className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all"
                                                        style={{
                                                            background: "var(--v-elevated, #222226)",
                                                            color: "var(--v-text-secondary, #d1d1d6)"
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}

                                        {!isActive && confirmReactivate && status !== "expired" && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="rounded-xl p-4 space-y-3"
                                                style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)" }}
                                            >
                                                <p className="text-[12px]" style={{ color: "#34d399" }}>
                                                    Reactivate this link? Tracking and attribution will resume.
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleReactivate}
                                                        disabled={deactivating}
                                                        className="flex-1 py-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all"
                                                        style={{ background: "#34d399", color: "#111" }}
                                                    >
                                                        {deactivating ? <Loader2 size={12} className="animate-spin" /> : null}
                                                        {deactivating ? "Restoring..." : "Confirm"}
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmReactivate(false)}
                                                        className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all"
                                                        style={{
                                                            background: "var(--v-elevated, #222226)",
                                                            color: "var(--v-text-secondary, #d1d1d6)"
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
