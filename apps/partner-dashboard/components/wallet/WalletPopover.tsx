"use client";

import { useState, useRef, useEffect } from "react";
import { Wallet, PlusCircle, X } from "lucide-react";

interface WalletPopoverProps {
    balance?: number;
}

export function WalletPopover({ balance = 0 }: WalletPopoverProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [open]);

    const formatted = `₹${balance.toLocaleString("en-IN")}`;

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                style={{
                    background: open ? "var(--v-elevated)" : "var(--v-card)",
                    border: "1px solid var(--v-border)",
                }}
            >
                <Wallet className="w-4 h-4" style={{ color: "#F44A22" }} />
                <span className="text-[13px] font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                    {formatted}
                </span>
            </button>

            {/* Popover */}
            {open && (
                <div
                    className="absolute right-0 top-full mt-2 w-60 rounded-2xl z-50"
                    style={{
                        background: "var(--v-card)",
                        border: "1px solid var(--v-border)",
                        boxShadow: "var(--v-shadow-hover)",
                    }}
                >
                    <div className="flex items-center justify-between px-4 pt-4 pb-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                            Wallet Balance
                        </p>
                        <button
                            onClick={() => setOpen(false)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg"
                            style={{ color: "var(--v-text-tertiary)" }}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="px-4 py-3">
                        <p className="text-[34px] font-black tabular-nums leading-none" style={{ color: "var(--v-text-primary)" }}>
                            {formatted}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--v-text-tertiary)" }}>
                            Available in your wallet
                        </p>
                    </div>

                    <div className="px-4 pb-4">
                        <button
                            disabled
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest opacity-40 cursor-not-allowed"
                            style={{ background: "#F44A22", color: "#fff" }}
                        >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Add Money
                        </button>
                        <p className="text-[10px] text-center mt-1.5" style={{ color: "var(--v-text-tertiary)" }}>
                            Top-up coming soon
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
