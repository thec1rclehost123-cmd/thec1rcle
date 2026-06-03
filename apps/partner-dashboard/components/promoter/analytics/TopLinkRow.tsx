"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const GUEST_PORTAL_URL =
    process.env.NEXT_PUBLIC_GUEST_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

export function TopLinkRow({ link, rank }: { link: any; rank: number }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const slug = link.eventSlug || link.eventId || link.code;
        const ref = link.code || link.shortId || link.token || link.id;
        const url = link.fullUrl || `${GUEST_PORTAL_URL}/e/${slug}?ref=${ref}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isFirst  = rank === 1;
    const isSecond = rank === 2;
    const isThird  = rank === 3;

    const cardStyle = isFirst ? {
        background: "linear-gradient(135deg, rgba(244,74,34,0.88) 0%, rgba(251,146,60,0.72) 100%)",
        border: "1px solid rgba(244,74,34,0.5)",
        boxShadow: "0 -12px 36px rgba(244,74,34,0.28)",
    } : isSecond ? {
        background: "rgba(38,38,42,0.95)",
        border: "1px solid rgba(255,255,255,0.1)",
    } : isThird ? {
        background: "rgba(26,26,28,0.95)",
        border: "1px solid rgba(255,255,255,0.07)",
    } : {
        background: "rgba(20,20,22,0.7)",
        border: "1px solid rgba(255,255,255,0.04)",
        opacity: 0.65,
    };

    const textColor = isFirst ? "#fff" : "rgba(255,255,255,0.88)";
    const subColor  = isFirst ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)";
    const convColor = isFirst ? "#fff" : "#22c55e";

    return (
        <div
            className="group"
            style={{
                ...cardStyle,
                display: "flex", alignItems: "center", gap: 12,
                borderRadius: 18, padding: "10px 14px", marginBottom: 6,
            }}
        >
            {/* Rank badge */}
            <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isFirst ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${isFirst ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)"}`,
                fontSize: 11, fontWeight: 900, color: isFirst ? "#fff" : "rgba(255,255,255,0.45)",
            }}>
                {rank}
            </div>

            {/* Event name + code */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {link.eventName || "Event"}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{
                        fontSize: 10, fontFamily: "monospace", fontWeight: 600,
                        padding: "1px 6px", borderRadius: 4,
                        background: isFirst ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                        color: subColor,
                    }}>
                        /e/{link.code}
                    </span>
                    <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                        {copied ? <Check className="w-3 h-3" style={{ color: isFirst ? "#fff" : "#22c55e" }} /> : <Copy className="w-3 h-3" style={{ color: subColor }} />}
                    </button>
                </div>
            </div>

            {/* Stats: clicks · sales · conv */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                    <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: textColor }}>{(link.clicks || 0).toLocaleString("en-IN")}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: subColor }}>clicks</p>
                </div>
                <div style={{ textAlign: "center" }}>
                    <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: textColor }}>{(link.sales || 0).toLocaleString("en-IN")}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: subColor }}>sales</p>
                </div>
                <div style={{ textAlign: "right" }}>
                    <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: convColor }}>{link.conversion || "0.0%"} ✦</p>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: subColor }}>conv.</p>
                </div>
            </div>
        </div>
    );
}
