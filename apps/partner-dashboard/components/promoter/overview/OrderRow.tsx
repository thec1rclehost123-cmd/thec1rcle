"use client";

import { GuestsResponse } from "./types";
import { getOrderStatusTone, getInitials, formatDateTime, formatINR } from "./utils";

export function OrderRow({ order }: { order: NonNullable<GuestsResponse["guests"]>[number] }) {
    const tone = getOrderStatusTone(order.status);

    return (
        <div
            className="rounded-[22px] px-4 py-3 flex items-center gap-3"
            style={{ background: "#18191d", border: "1px solid rgba(255,255,255,0.05)" }}
        >
            <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-black shrink-0"
                style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                {getInitials(order.guestName)}
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white truncate">{order.guestName || "Guest"}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                        className="px-2 py-0.5 rounded-[10px] text-[10px] font-black uppercase tracking-[0.12em]"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.42)" }}
                    >
                        {order.eventTitle || "Event"}
                    </span>
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {formatDateTime(order.createdAt)}
                    </span>
                </div>
            </div>

            <div className="text-right shrink-0">
                <span
                    className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{
                        color: tone.color,
                        background: tone.background,
                        border: `1px solid ${tone.border}`,
                    }}
                >
                    {tone.label}
                </span>
                <p className="text-[24px] leading-none font-semibold text-white mt-3">
                    {formatINR(order.amount)}
                </p>
            </div>
        </div>
    );
}
