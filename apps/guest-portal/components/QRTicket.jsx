"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2, Copy, Check, Ticket } from "lucide-react";
import { formatEventDate } from "@c1rcle/core/time";

/**
 * QR Ticket Component
 * Displays a ticket with QR code for event entry
 */
export default function QRTicket({
    qrData,
    ticketName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    quantity = 1,
    entryType = "general",
    orderId,
    showActions = true
}) {
    const canvasRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [qrLoaded, setQrLoaded] = useState(false);

    useEffect(() => {
        // Load QR code library dynamically
        const loadQRCode = async () => {
            try {
                // Use a simple QR code generator
                if (typeof window !== "undefined" && canvasRef.current) {
                    const QRCode = (await import("qrcode")).default;
                    await QRCode.toCanvas(canvasRef.current, qrData, {
                        width: 200,
                        margin: 2,
                        color: {
                            dark: "#1d1d1f",
                            light: "#ffffff"
                        }
                    });
                    setQrLoaded(true);
                }
            } catch (err) {
                console.error("Failed to generate QR code:", err);
                // Fallback: Show data as text
                setQrLoaded(false);
            }
        };

        if (qrData) {
            loadQRCode();
        }
    }, [qrData]);

    const handleCopy = () => {
        navigator.clipboard.writeText(qrData);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        if (canvasRef.current) {
            const link = document.createElement("a");
            link.download = `ticket-${orderId}.png`;
            link.href = canvasRef.current.toDataURL();
            link.click();
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Ticket for ${eventTitle}`,
                    text: `${ticketName} - ${eventDate} at ${eventLocation}`,
                    url: window.location.href
                });
            } catch (err) {
                console.log("Share cancelled");
            }
        }
    };

    // local formatDate removed, using formatEventDate from core

    const entryTypeLabels = {
        general: "General Entry",
        stag: "Stag Entry",
        couple: "Couple Entry",
        group: "Group Entry",
        vip: "VIP Entry",
        table: "Table Reservation"
    };

    return (
        <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-200 max-w-sm mx-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                        <Ticket className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-white/70">THE C1RCLE</p>
                        <p className="font-bold">{ticketName}</p>
                    </div>
                </div>
            </div>

            {/* Event Info */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-2">{eventTitle}</h2>
                <div className="space-y-1 text-sm text-slate-600">
                    <p>{formatEventDate(eventDate)} • {eventTime}</p>
                    <p className="text-slate-500">{eventLocation}</p>
                </div>
            </div>

            {/* QR Code */}
            <div className="p-6 flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-slate-200 mb-4">
                    <canvas ref={canvasRef} />

                    {/* Fallback if QR library not loaded */}
                    {!qrLoaded && (
                        <div className="w-[200px] h-[200px] flex items-center justify-center bg-slate-100 rounded-xl">
                            <p className="text-xs text-slate-500 text-center px-4">
                                QR code will appear here
                            </p>
                        </div>
                    )}
                </div>

                <p className="text-xs text-slate-500 mb-4">Show this QR code at the venue entrance</p>

                {/* Entry Details */}
                <div className="w-full bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Entry Type</span>
                        <span className="font-bold text-slate-900">{entryTypeLabels[entryType] || entryType}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Quantity</span>
                        <span className="font-bold text-slate-900">{quantity} {quantity > 1 ? "tickets" : "ticket"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Order ID</span>
                        <span className="font-mono text-xs text-slate-600">{orderId?.slice(0, 12)}...</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            {showActions && (
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={handleDownload}
                        className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Download
                    </button>

                    {navigator.share && (
                        <button
                            onClick={handleShare}
                            className="py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            <Share2 className="h-4 w-4 text-slate-600" />
                        </button>
                    )}

                    <button
                        onClick={handleCopy}
                        className="py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        {copied ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                            <Copy className="h-4 w-4 text-slate-600" />
                        )}
                    </button>
                </div>
            )}

            {/* Decorative tear line */}
            <div className="relative h-4">
                <div className="absolute inset-x-0 top-0 h-4 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-slate-200" />
                </div>
                <div className="absolute -left-2 top-0 h-4 w-4 bg-slate-100 rounded-full" />
                <div className="absolute -right-2 top-0 h-4 w-4 bg-slate-100 rounded-full" />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Keep this ticket safe • Valid for one-time entry only
                </p>
            </div>
        </div>
    );
}
