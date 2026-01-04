"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "../../components/providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import {
    getUserTickets,
    createShareBundle,
    claimTicket,
    createPartnerClaimLink,
    assignPartnerByEmail,
    transferCoupleTicket,
    findUserByEmail,
    initiateTransfer,
    acceptTransfer,
    cancelTransfer
} from "./actions";
import Link from "next/link";
import Image from "next/image";
import ShimmerImage from "../../components/ShimmerImage";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import clsx from "clsx";

// --- Hooks ---

const useDominantColor = (imageUrl) => {
    const [color, setColor] = useState('rgba(255, 255, 255, 0.1)');
    const [rgb, setRgb] = useState('128, 128, 128');

    useEffect(() => {
        if (!imageUrl) return;
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 1;
                canvas.height = 1;
                ctx.drawImage(img, 0, 0, 1, 1);
                const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                setColor(`rgb(${r}, ${g}, ${b})`);
                setRgb(`${r}, ${g}, ${b} `);
            } catch (e) {
                console.error("Color extraction failed", e);
            }
        };
    }, [imageUrl]);

    return { color, rgb };
};

// --- Components ---

const AuroraBackground = () => (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-color)]">
        <div className="absolute -top-[30%] left-0 h-[80vh] w-full bg-gradient-to-b from-orange/10 dark:from-iris/10 via-transparent to-transparent blur-[120px] opacity-60 transition-colors duration-500" />
        <div className="absolute top-[20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-orange/5 dark:bg-gold/5 blur-[100px] opacity-40 mix-blend-multiply dark:mix-blend-screen animate-pulse" />
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
);

const TicketSkeleton = () => (
    <div className="animate-pulse rounded-[24px] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 flex gap-4">
        <div className="h-24 w-20 rounded-xl bg-black/[0.05] dark:bg-white/5" />
        <div className="flex-1 space-y-3 py-2">
            <div className="h-4 w-3/4 rounded bg-black/[0.05] dark:bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-black/[0.03] dark:bg-white/5" />
            <div className="h-3 w-1/3 rounded bg-black/[0.03] dark:bg-white/5" />
        </div>
    </div>
);

const ShareModal = ({ orderId, eventId, eventTitle, tierId, totalTickets, alreadyShared, onClose, onSuccess }) => {
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [shareUrl, setShareUrl] = useState(null);
    const [copied, setCopied] = useState(false);

    const available = totalTickets - alreadyShared;

    const handleCreate = async () => {
        setLoading(true);
        setError(null);
        try {
            const bundle = await createShareBundle(orderId, eventId, quantity, tierId);
            const url = `${window.location.origin}/tickets/claim/${bundle.token}`;
            setShareUrl(url);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl p-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none" />

                <div className="relative z-10">
                    <h2 className="text-3xl font-heading font-black uppercase text-black dark:text-white mb-2 tracking-tighter">Share Tickets</h2>
                    <p className="text-[10px] text-black/40 dark:text-white/40 mb-10 uppercase tracking-[0.3em] font-bold">{eventTitle}</p>

                    {shareUrl ? (
                        <div className="space-y-8">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-orange to-gold rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative p-6 rounded-2xl bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 backdrop-blur-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-[10px] font-black text-orange dark:text-gold uppercase tracking-[0.2em]">Live Share Link</p>
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-black dark:text-white break-all mb-6 selection:bg-orange/30 font-mono leading-relaxed opacity-90">{shareUrl}</p>
                                    <button
                                        onClick={handleCopy}
                                        className={clsx(
                                            "w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all active:scale-[0.98]",
                                            copied
                                                ? "bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                                                : "bg-black dark:bg-white text-white dark:text-black hover:shadow-xl dark:hover:shadow-white/5 shadow-black/10"
                                        )}
                                    >
                                        {copied ? "Link Copied!" : "Copy To Clipboard"}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-4 px-4">
                                <div className="h-px w-12 bg-black/10 dark:white/10" />
                                <p className="text-center text-[10px] text-black/50 dark:text-white/40 uppercase tracking-[0.2em] font-medium leading-loose">
                                    Send this link to your friends.<br />
                                    <span className="text-black/30 dark:text-white/20">They must log in to claim their spot.</span>
                                </p>
                            </div>

                            <button
                                onClick={onSuccess}
                                className="w-full py-4 rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white font-black uppercase text-[11px] tracking-[0.3em] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <p className="text-lg font-bold text-black dark:text-white">Quantity</p>
                                    <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-widest">Remaining: {available}</p>
                                </div>
                                <div className="flex items-center gap-4 bg-black/5 dark:bg-white/5 rounded-2xl p-1">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-10 h-10 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xl font-bold"
                                    >-</button>
                                    <span className="w-8 text-center font-bold text-lg">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(Math.min(available, quantity + 1))}
                                        className="w-10 h-10 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xl font-bold"
                                    >+</button>
                                </div>
                            </div>

                            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                            <button
                                disabled={loading}
                                onClick={handleCreate}
                                className="w-full py-4 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold uppercase text-xs tracking-[0.2em] shadow-lg disabled:opacity-50"
                            >
                                {loading ? "Generating..." : "Generate Share Link"}
                            </button>

                            <button
                                onClick={onClose}
                                className="w-full py-3 text-black/40 dark:text-white/40 uppercase text-[10px] font-bold tracking-widest"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

const TransferModal = ({ ticket, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [email, setEmail] = useState("");

    const handleTransfer = async () => {
        if (!confirm("Are you sure? This ticket will be locked until the recipient accepts or you cancel the transfer. You will not be able to use the QR while it's pending.")) return;
        setLoading(true);
        setError(null);
        try {
            await initiateTransfer(ticket.ticketId, email);
            onSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl p-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="relative z-10">
                    <h2 className="text-3xl font-heading font-black uppercase text-black dark:text-white mb-2 tracking-tighter">Transfer Pass</h2>
                    <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-[0.2em] leading-relaxed mb-8 font-bold">
                        Send this pass safely to a friend.
                    </p>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-[0.2em] ml-1">Recipient Email</p>
                            <input
                                type="email"
                                placeholder="Enter friend's email"
                                className="w-full px-5 py-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 focus:border-orange/30 dark:focus:border-white/20 outline-none transition-all text-sm font-bold text-black dark:text-white placeholder:text-black/20 dark:placeholder:text-white/10"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                                <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest text-center">{error}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleTransfer}
                                disabled={!email || loading}
                                className="w-full py-5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs tracking-[0.3em] shadow-xl disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? "Processing..." : "Confirm Transfer"}
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full py-3 text-black/40 dark:text-white/40 uppercase text-[10px] font-bold tracking-[0.4em] hover:text-black dark:hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

const ActionCard = ({ action, onAction }) => {
    const [loading, setLoading] = useState(false);
    const date = action.eventStartAt ? new Date(action.eventStartAt) : null;
    const dateString = date ? date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '';

    const handleAccept = async () => {
        setLoading(true);
        try {
            await acceptTransfer(action.id);
            onAction();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            whileHover={{ y: -4 }}
            className="group relative overflow-hidden flex items-center gap-6 p-6 rounded-[32px] border border-orange/10 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-xl"
        >
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-zinc-900 shadow-lg">
                <ShimmerImage src={action.posterUrl} alt={action.eventTitle} fill className="object-cover" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-orange/20 text-[8px] font-black uppercase tracking-widest text-orange border border-orange/20">
                        {action.reason}
                    </span>
                    {dateString && <span className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase">{dateString}</span>}
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight text-black dark:text-white truncate">
                    {action.eventTitle}
                </h4>
                <p className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mt-1">
                    {action.type === 'order' ? `Amount: ₹${action.amount}` : `From: ${action.transfer?.senderId.slice(0, 8)}...`}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                {action.type === 'transfer' ? (
                    <button
                        disabled={loading}
                        onClick={handleAccept}
                        className="px-6 py-3 rounded-xl bg-orange text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-orange/20 disabled:opacity-50"
                    >
                        {loading ? '...' : 'Accept'}
                    </button>
                ) : (
                    <Link
                        href={`/checkout?orderId=${action.id}`}
                        className="px-6 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                    >
                        Pay Now
                    </Link>
                )}
            </div>
        </motion.div>
    );
};

const PartnerModal = ({ ticket, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [claimUrl, setClaimUrl] = useState(null);
    const [copied, setCopied] = useState(false);
    const [email, setEmail] = useState("");

    const handleCreateLink = async () => {
        setLoading(true);
        setError(null);
        try {
            const { token } = await createPartnerClaimLink(ticket.ticketId, ticket.eventId);
            const url = `${window.location.origin}/tickets/pair/${token}`;
            setClaimUrl(url);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignDirectly = async () => {
        setLoading(true);
        setError(null);
        try {
            await assignPartnerByEmail(ticket.ticketId, email, {
                eventId: ticket.eventId,
                ticketType: ticket.ticketType
            });
            onSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!confirm("Are you sure? This will transfer full ownership of this couple ticket (including both slots) to the new owner. You will lose access immediately.")) return;
        setLoading(true);
        setError(null);
        try {
            const newUser = await findUserByEmail(email);
            if (!newUser) throw new Error("User not found");
            await transferCoupleTicket(ticket.ticketId, newUser.uid);
            onSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(claimUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl p-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none" />

                <div className="relative z-10">
                    <h2 className="text-3xl font-heading font-black uppercase text-black dark:text-white mb-2 tracking-tighter">Assign Partner</h2>
                    <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-[0.2em] leading-relaxed mb-8 font-bold">
                        Couple entries require a pair assignment to reveal the QR.
                    </p>

                    {claimUrl ? (
                        <div className="space-y-8">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-orange to-gold rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative p-6 rounded-2xl bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 backdrop-blur-xl">
                                    <p className="text-[10px] font-black text-orange dark:text-gold uppercase tracking-[0.2em] mb-4">Partner Claim Link</p>
                                    <p className="text-sm font-bold text-black dark:text-white break-all mb-6 selection:bg-orange/30 font-mono leading-relaxed opacity-90">{claimUrl}</p>
                                    <button
                                        onClick={handleCopy}
                                        className={clsx(
                                            "w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all active:scale-[0.98]",
                                            copied
                                                ? "bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                                                : "bg-black dark:bg-white text-white dark:text-black hover:shadow-xl dark:hover:shadow-white/5 shadow-black/10"
                                        )}
                                    >
                                        {copied ? "Link Copied!" : "Copy Link"}
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] text-center text-black/40 dark:text-white/40 uppercase tracking-[0.2em] font-medium leading-loose">
                                Send this link to your partner.<br />
                                <span className="text-black/30 dark:text-white/20 text-[9px]">They must log in to complete the pairing.</span>
                            </p>
                            <button
                                onClick={onSuccess}
                                className="w-full py-4 rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white font-black uppercase text-[11px] tracking-[0.3em] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <button
                                    onClick={handleCreateLink}
                                    disabled={loading}
                                    className="w-full group relative overflow-hidden py-5 rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs tracking-[0.3em] shadow-2xl disabled:opacity-50 transition-transform active:scale-95"
                                >
                                    <span className="relative z-10">{loading ? "Generating..." : "Generate Link"}</span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange/20 to-gold/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>

                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/[0.08] dark:border-white/10" /></div>
                                    <div className="relative flex justify-center text-[10px]"><span className="px-4 bg-white dark:bg-zinc-900 text-black/20 dark:text-white/20 font-black tracking-[0.5em]">OR</span></div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-[0.2em] ml-1">Direct Assignment</p>
                                        <div className="relative">
                                            <input
                                                type="email"
                                                placeholder="Enter partner's email"
                                                className="w-full px-5 py-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 focus:border-orange/30 dark:focus:border-white/20 outline-none transition-all text-sm font-bold text-black dark:text-white placeholder:text-black/20 dark:placeholder:text-white/10"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 pt-2">
                                        <button
                                            onClick={handleAssignDirectly}
                                            disabled={!email || loading}
                                            className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.3em] shadow-xl disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            {loading ? "Processing..." : "Confirm Assignment"}
                                        </button>

                                        <button
                                            onClick={handleTransfer}
                                            disabled={!email || loading}
                                            className="group/transfer relative flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-red-500/5 hover:border-red-500/20 transition-all"
                                        >
                                            <span className="text-red-500/30 group-hover/transfer:text-red-500 font-bold uppercase text-[9px] tracking-[0.4em] transition-all">
                                                Transfer Full Ownership
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                                    <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest text-center">{error}</p>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="w-full py-3 text-black/40 dark:text-white/40 uppercase text-[10px] font-bold tracking-[0.4em] hover:text-black dark:hover:text-white transition-colors"
                            >
                                ← Back
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

const TicketCard = ({ ticket, onShare, onClick, onPartner, onTransfer }) => {
    const isPast = ticket.status === "used" || ticket.status === "cancelled";
    const date = new Date(ticket.eventStartAt);
    const dateString = date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeString = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const { color, rgb } = useDominantColor(ticket.posterUrl);

    return (
        <div className="relative group">
            {/* Ambient Dynamic Glow */}
            {!isPast && (
                <div
                    className="absolute inset-0 z-0 scale-90 opacity-0 blur-[80px] transition-all duration-700 group-hover:scale-110 group-hover:opacity-50 dark:group-hover:opacity-30 mix-blend-multiply dark:mix-blend-normal"
                    style={{ backgroundColor: color }}
                />
            )}

            <motion.div
                whileHover={{ y: -8, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                onClick={() => onClick(ticket)}
                className={`relative z-10 flex flex-col cursor-pointer overflow-hidden rounded-[28px] border transition-all duration-500 ${isPast
                    ? "border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] opacity-60"
                    : "border-black/[0.12] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 backdrop-blur-md shadow-[0_4px_20px_rgb(0,0,0,0.02)] dark:shadow-none hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:hover:shadow-none"
                    }`}
            >
                <div className="flex w-full p-5 gap-6 relative">
                    {/* Poster container */}
                    <div className="relative aspect-[3/4] h-36 flex-shrink-0 overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 shadow-lg bg-zinc-900">
                        <ShimmerImage
                            src={ticket.posterUrl}
                            alt={ticket.eventTitle}
                            fill
                            wrapperClassName="w-full h-full"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        {isPast && <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-grayscale" />}
                    </div>

                    {/* Details */}
                    <div className="flex flex-1 flex-col justify-center py-1">
                        <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-heading text-xl font-black uppercase tracking-tight text-black dark:text-white line-clamp-1 leading-tight mb-2">
                                    {ticket.eventTitle}
                                </h3>
                                {/* Status Chips Row */}
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {ticket.isCouple && (
                                        <span className="rounded-full bg-orange/10 border border-orange/30 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest text-orange">Couple</span>
                                    )}
                                    {ticket.genderMismatch && (
                                        <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest text-red-500">Restricted</span>
                                    )}
                                    <span className={`rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-widest border ${ticket.orderType === 'RSVP' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 border-black/5 dark:border-white/5'
                                        }`}>
                                        {ticket.orderType === '₹0 Checkout' ? 'Free Pass' : (ticket.orderType === 'RSVP' ? 'RSVP' : 'Paid')}
                                    </span>
                                    {ticket.isSharedQr && (
                                        <span className="rounded-full bg-iris/10 border border-iris/30 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest text-iris">Shared Group</span>
                                    )}
                                </div>
                            </div>

                            {/* Actions Container - Integrated Flow */}
                            {ticket.status === "active" && ticket.ticketType !== "RSVP" && !ticket.isTransferPending && !ticket.isShared && (
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTransfer(ticket);
                                        }}
                                        className="h-9 w-9 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-white hover:border-orange/20 shadow-sm group/btn"
                                    >
                                        <svg className="h-4 w-4 text-black/40 dark:text-white/40 group-hover/btn:text-orange transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                    </button>

                                    {(ticket.isBundle || ticket.isCouple) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (ticket.isCouple) {
                                                    onPartner(ticket);
                                                } else {
                                                    onShare(ticket);
                                                }
                                            }}
                                            className="group/btn h-9 w-9 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-white hover:border-orange/20 shadow-sm"
                                        >
                                            <svg className="h-4 w-4 text-black/40 dark:text-white/40 group-hover/btn:text-orange transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                {ticket.isCouple ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                )}
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            )}

                            {ticket.isTransferPending && (
                                <div className="flex-shrink-0">
                                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest shadow-sm">Pending</span>
                                </div>
                            )}
                        </div>

                        {/* Status indicators integrated into details */}
                        <div className="flex items-center gap-3 mb-3">
                            {ticket.isCouple && (
                                <p className="text-[9px] font-bold uppercase tracking-widest text-orange/80 flex items-center gap-1.5">
                                    <span className={`w-1 h-1 rounded-full ${ticket.coupleAssignment?.status === 'fully_assigned' ? 'bg-orange animate-pulse' : 'bg-orange/40'}`} />
                                    {ticket.coupleAssignment?.status === 'fully_assigned' ? "P2 Assigned" : "P2 Unassigned"}
                                </p>
                            )}
                            {ticket.isClaimed && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-orange shadow-[0_0_8px_rgba(255,165,0,0.5)] animate-pulse" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-orange/60">Claimed</p>
                                </div>
                            )}
                            {ticket.isBundle && (
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-1 h-1 rounded-full ${ticket.remainingToShare > 0 ? 'bg-iris animate-pulse' : 'bg-zinc-500'}`} />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-iris">
                                        Bundle: {ticket.remainingToShare} Slots Left
                                    </p>
                                </div>
                            )}
                            {ticket.claimedSlots > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/60">
                                        {ticket.claimedSlots} Claimed
                                    </p>
                                </div>
                            )}
                            {ticket.genderMismatch && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-red-500" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-red-500/60 uppercase">{ticket.requiredGender} Only</p>
                                </div>
                            )}
                            {ticket.isSharedQr && (
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-1 h-1 rounded-full ${ticket.scansRemaining > 0 ? 'bg-iris animate-pulse' : 'bg-zinc-500'}`} />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-iris">
                                        Multi-Use: {ticket.scansRemaining} Scans Left
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="mt-3 space-y-1.5">
                            <p className="text-xs font-bold uppercase tracking-widest text-black/50 dark:text-white/50 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange" />
                                {dateString} • {timeString}
                            </p>
                            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-black/40 dark:text-white/40 truncate">
                                {ticket.venueName}, {ticket.city}
                            </p>
                        </div>

                        <div className="mt-5 flex items-center gap-2">
                            <span
                                className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-md transition-colors duration-500"
                                style={{
                                    backgroundColor: `rgba(${rgb}, ${color === 'rgba(255, 255, 255, 0.1)' ? '0.05' : '0.12'})`,
                                    borderColor: `rgba(${rgb}, 0.25)`,
                                    color: color === 'rgba(255, 255, 255, 0.1)' ? (isPast ? 'gray' : 'orange') : color,
                                }}
                            >
                                {ticket.ticketType}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border transition-all duration-300 ${ticket.status === "active"
                                ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
                                : "text-black/40 border-black/5 bg-black/5 dark:text-white/40 dark:border-white/5 dark:bg-white/5"
                                }`}>
                                {ticket.status}
                            </span>
                        </div>
                    </div>

                    {/* Aesthetic inner ticket part separator */}
                    <div className="absolute left-[142px] top-6 bottom-6 w-[1px] border-l border-dashed border-black/10 dark:border-white/10 hidden sm:block" />

                </div>

                {/* Aesthetic stub notches - centered on vertical perforatons */}
                <div className="absolute left-[124px] top-[-12px] h-6 w-6 rounded-full bg-[var(--bg-color)] border border-black/5 dark:border-white/5 z-20" />
                <div className="absolute left-[124px] bottom-[-12px] h-6 w-6 rounded-full bg-[var(--bg-color)] border border-black/5 dark:border-white/5 z-20" />
            </motion.div>
        </div>
    );
};

const QRModal = ({ ticket, onClose, onPartner }) => {
    if (!ticket) return null;

    const isUsed = ticket.status === "used";
    const isCancelled = ticket.status === "cancelled";
    const { color, rgb } = useDominantColor(ticket.posterUrl);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-8"
            onClick={onClose}
        >
            {/* Softened Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-2xl"
            />

            {/* Breathing Background Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <motion.div
                    animate={{
                        scale: [1, 1.25, 1],
                        opacity: [0.35, 0.65, 0.35]
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="h-[700px] w-[700px] rounded-full blur-[140px]"
                    style={{
                        backgroundColor: color,
                        boxShadow: `0 0 250px 120px rgba(${rgb}, 0.45)`
                    }}
                />
            </div>

            <motion.div
                initial={{ scale: 0.9, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 40, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full h-full md:h-auto md:max-w-[380px] overflow-hidden md:rounded-[48px] p-[1px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Border Glow Gradient */}
                <div
                    className="absolute inset-0 opacity-40 blur-sm"
                    style={{ background: `linear-gradient(135deg, ${color}, transparent, ${color})` }}
                />
                {/* Inner Container with Glassmorphism */}
                <div
                    className="rounded-none md:rounded-[44px] h-full w-full p-8 md:p-8 pt-20 md:pt-8 flex flex-col items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-3xl border-none md:border md:border-white/60 dark:md:border-white/20 shadow-none md:shadow-2xl"
                >
                    {/* Safe area padding for mobile */}
                    <div className="md:hidden h-safe-top" />

                    {/* Header */}
                    <div className="mb-6 md:mb-8 w-full text-center">
                        <motion.p
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-xs font-black uppercase tracking-[0.4em] text-black/60 dark:text-white/40 mb-3"
                        >
                            Entry Ticket
                        </motion.p>
                        <motion.h2
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="font-heading text-3xl md:text-4xl font-black uppercase text-black dark:text-white max-w-[320px] leading-tight mx-auto tracking-tighter"
                        >
                            {ticket.eventTitle}
                        </motion.h2>

                        {/* Dynamic Accent Line */}
                        <div className="mt-6 flex flex-col items-center gap-2">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: 96 }}
                                transition={{ delay: 0.3, duration: 0.8 }}
                                className="h-[4px] rounded-full opacity-90 blur-[0.5px] transition-all duration-700"
                                style={{
                                    backgroundColor: color,
                                    boxShadow: `0 0 24px 6px rgba(${rgb}, 0.5)`
                                }}
                            />
                            <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-black/10 dark:via-white/5 to-transparent" />
                        </div>
                    </div>

                    {/* QR Section */}
                    <div className="relative w-full aspect-square max-w-[300px] md:max-w-[260px] flex flex-col justify-center items-center bg-white rounded-[40px] md:rounded-[40px] p-8 md:p-6 shadow-2xl border border-white/40">
                        {ticket.isTransferPending ? (
                            <div className="text-center space-y-4">
                                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center mx-auto">
                                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                </div>
                                <div className="px-4">
                                    <p className="text-sm font-black text-black uppercase tracking-tight">Transfer Pending</p>
                                    <p className="text-[10px] text-black/40 uppercase tracking-widest mt-2 font-bold leading-relaxed">QR is disabled while the pass is being transferred</p>
                                </div>
                            </div>
                        ) : ticket.isShared ? (
                            <div className="text-center space-y-4">
                                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center mx-auto">
                                    <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                </div>
                                <div className="px-4">
                                    <p className="text-sm font-black text-black uppercase tracking-tight">Ticket Shared</p>
                                    <p className="text-[10px] text-black/40 uppercase tracking-widest mt-2 font-bold leading-relaxed">QR is disabled because this ticket is part of a share bundle.</p>
                                </div>
                            </div>
                        ) : ticket.genderMismatch ? (
                            <div className="text-center space-y-4">
                                <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto">
                                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div className="px-4">
                                    <p className="text-sm font-black text-black uppercase tracking-tight">Gender Restricted</p>
                                    <p className="text-[10px] text-black/40 uppercase tracking-widest mt-2 font-bold leading-relaxed">This pass is restricted to {ticket.requiredGender} accounts only.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={`relative ${isUsed || isCancelled || !ticket.qrPayload || (ticket.isSharedQr && ticket.scansRemaining <= 0) ? "opacity-10 grayscale" : ""}`}>
                                    {ticket.qrPayload ? (
                                        <QRCodeSVG
                                            value={ticket.qrPayload}
                                            size={240}
                                            level="H"
                                            className="w-full h-full md:w-[200px] md:h-[200px]"
                                            includeMargin={false}
                                        />
                                    ) : (
                                        <div className="w-[200px] h-[200px] bg-black/5 rounded-xl animate-pulse" />
                                    )}
                                </div>

                                {ticket.isSharedQr && (
                                    <div className="absolute -top-4 -right-4 bg-iris text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg border-2 border-white z-30">
                                        {ticket.scansRemaining} Scans Left
                                    </div>
                                )}

                                {isUsed && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <motion.span
                                            initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                                            animate={{ scale: 1, opacity: 1, rotate: -12 }}
                                            className="border-[3px] border-black px-6 py-3 text-3xl font-black uppercase tracking-[0.2em] text-black bg-white shadow-2xl z-20"
                                        >
                                            USED
                                        </motion.span>
                                    </div>
                                )}

                                {isCancelled && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="rotate-[-12deg] border-[3px] border-red-600 px-6 py-3 text-3xl font-black uppercase tracking-[0.2em] text-red-600 bg-white shadow-xl lowercase">
                                            {ticket.status === 'refunded' ? 'REFUNDED' : 'CANCELLED'}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Couple Ticket Slots UI */}
                    {ticket.isCouple && (
                        <div className="mt-8 w-full space-y-3">
                            <div className="p-4 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-xs">P1</div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Person A (Owner)</p>
                                        <p className="text-xs font-bold text-black dark:text-white">You</p>
                                    </div>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="p-4 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center text-orange font-black text-xs">P2</div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Person B (Partner)</p>
                                        <p className="text-xs font-bold text-black dark:text-white">
                                            {ticket.isPartner ? "You" : (ticket.coupleAssignment?.status === 'fully_assigned' ? "Assigned" : "Unassigned")}
                                        </p>
                                    </div>
                                </div>
                                {ticket.coupleAssignment?.status === 'fully_assigned' ? (
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-black/20 dark:text-white/20 animate-pulse" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-8 md:mt-10 w-full space-y-4">
                        {ticket.isCouple && !ticket.isPartner && ticket.coupleAssignment?.status !== 'fully_assigned' && (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onPartner(ticket)}
                                className="relative w-full py-4 rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.3em] shadow-xl overflow-hidden group/pbtn"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange to-gold opacity-0 group-hover/pbtn:opacity-100 transition-opacity duration-500" />
                                <span className="relative z-10">Assign Partner</span>
                            </motion.button>
                        )}
                        <div className="flex flex-col items-center gap-1.5 px-4 mb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 dark:text-white/40">Policies</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[8px] font-bold uppercase tracking-wider text-black/50 dark:text-white/40">No Entry Post 1 AM</span>
                                <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[8px] font-bold uppercase tracking-wider text-black/50 dark:text-white/40">Transfer Allowed</span>
                                <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[8px] font-bold uppercase tracking-wider text-black/50 dark:text-white/40">Non-Refundable</span>
                            </div>
                        </div>
                        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 dark:text-white/30">
                            {ticket.isCouple ? "Arrive together for entry" : "Show this QR at the entrance"}
                        </p>
                    </div>

                    {/* Meta Info */}
                    <div className="mt-8 md:mt-10 w-full max-w-[300px] flex justify-around items-center border-y border-black/5 dark:border-white/5 py-6">
                        <div className="text-center px-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 dark:text-white/40 mb-1">Tier</p>
                            <p className="text-sm font-bold uppercase text-black dark:text-white">{ticket.ticketType}</p>
                        </div>
                        <div className="h-10 w-[1px] bg-black/10 dark:bg-white/10" />
                        <div className="text-center px-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 dark:text-white/40 mb-1">Status</p>
                            <p className={`text-sm font-black uppercase ${ticket.status === 'active' ? 'text-emerald-500' : 'text-red-500'}`}>
                                {ticket.isTransferPending ? 'Pending' : ticket.status}
                            </p>
                        </div>
                    </div>

                    {/* Final Hint */}
                    <div className="mt-8 md:mt-10 text-center text-black dark:text-white">
                        {!isUsed && !isCancelled && (!ticket.isSharedQr || ticket.scansRemaining > 0) ? (
                            <div className="space-y-6">
                                <div className="inline-flex flex-col items-center">
                                    <p
                                        className="text-xs font-black uppercase tracking-[0.25em] transition-colors duration-700"
                                        style={{ color: color }}
                                    >
                                        {ticket.isSharedQr ? "Group Ticket: Scannable multiple times" : "Present this QR at entry"}
                                    </p>
                                    <motion.div
                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="h-[3px] w-full blur-[4px] mt-2 transition-colors duration-700"
                                        style={{ backgroundColor: color }}
                                    />
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <p className="text-[10px] font-bold text-black/50 dark:text-white/40 uppercase tracking-[0.3em]">
                                        Full brightness recommended
                                    </p>
                                    <div className="flex gap-1">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-1 h-1 rounded-full bg-orange/40" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">
                                This pass is no longer valid
                            </p>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 md:top-8 md:right-8 p-3 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors bg-white/10 md:bg-transparent rounded-full backdrop-blur-md md:backdrop-blur-none"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Bottom Safe Area Padding */}
                    <div className="md:hidden h-safe-bottom" />
                </div>
            </motion.div >
        </motion.div >
    );
};

function TicketsContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tickets, setTickets] = useState({ upcomingTickets: [], pastTickets: [], actionNeeded: [], cancelledTickets: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("upcoming");
    const [selectedTicket, setSelectedTicket] = useState(null);
    const searchParams = useSearchParams();
    const [sharingTicket, setSharingTicket] = useState(null);
    const [partnerTicket, setPartnerTicket] = useState(null);
    const [transferTicket, setTransferTicket] = useState(null);

    // Redirect logic removed to render guest view instead

    const loadTickets = async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            const data = await getUserTickets(user.uid);
            setTickets(data);

            // Handle Deep Linking
            const targetEventId = searchParams.get("eventId");
            if (targetEventId) {
                // Try to find in upcoming first, then past
                const ticketToOpen = data.upcomingTickets.find(t => t.eventId === targetEventId) ||
                    data.pastTickets.find(t => t.eventId === targetEventId);

                if (ticketToOpen) {
                    setSelectedTicket(ticketToOpen);
                    if (data.pastTickets.includes(ticketToOpen)) {
                        setActiveTab("past");
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load tickets", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, [user?.uid, searchParams]);

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 dark:border-white/20 border-t-orange dark:border-t-white" />
            </div>
        );
    }

    const currentTickets = activeTab === "upcoming" ? tickets.upcomingTickets : tickets.pastTickets;

    const TICKETS_DATA = [
        { id: 1, type: "STANDARD", title: "ENTRY", price: "₹ 2,000", color: "from-zinc-800 to-zinc-900" },
        { id: 2, type: "PRESALE", title: "EARLY BIRD", price: "₹ 1,500", color: "from-zinc-700 to-zinc-800" },
        { id: 3, type: "VIP", title: "ALL ACCESS", price: "₹ 5,000", color: "from-orange-900/40 to-black border-orange-500/50" },
        { id: 4, type: "GROUP", title: "SQUAD PACK", price: "₹ 8,000", color: "from-zinc-800 to-zinc-900" },
        { id: 5, type: "BACKSTAGE", title: "ARTIST PASS", price: "₹ 12,000", color: "from-zinc-800 to-black" },
    ];

    const TicketCarousel = () => {
        const [activeIndex, setActiveIndex] = useState(2);

        const handleNext = () => {
            setActiveIndex((prev) => (prev + 1 < TICKETS_DATA.length ? prev + 1 : 0));
        };

        const handlePrev = () => {
            setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : TICKETS_DATA.length - 1));
        };

        return (
            <div className="relative w-full h-[500px] flex flex-col items-center justify-center perspective-1000">
                {/* Glow behind */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative h-[450px] w-full flex justify-center items-center">
                    <AnimatePresence>
                        {TICKETS_DATA.map((ticket, index) => {
                            const offset = index - activeIndex;
                            const isActive = index === activeIndex;

                            return (
                                <motion.div
                                    key={ticket.id}
                                    layout
                                    onClick={() => setActiveIndex(index)}
                                    className={clsx(
                                        "absolute w-[260px] h-[420px] rounded-[32px] cursor-pointer flex flex-col justify-between p-6 overflow-hidden",
                                        "bg-gradient-to-br border shadow-2xl backdrop-blur-md",
                                        isActive ? "border-white/20 z-50" : "border-white/5",
                                        ticket.color.includes("from-") ? ticket.color : "bg-zinc-900"
                                    )}
                                    style={{
                                        boxShadow: isActive
                                            ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                                            : "0 10px 30px -10px rgba(0, 0, 0, 0.8)",
                                    }}
                                    initial={false}
                                    animate={{
                                        x: offset * 140, // Horizontal spread
                                        y: Math.abs(offset) * 40 + (isActive ? 0 : 20), // Arc curve (dropping sides)
                                        scale: 1 - Math.abs(offset) * 0.1, // Scale down sides
                                        rotateZ: offset * 8, // Fan rotation
                                        zIndex: 100 - Math.abs(offset),
                                        opacity: Math.abs(offset) > 2.5 ? 0 : 1,
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 200,
                                        damping: 25,
                                    }}
                                    whileHover={{
                                        scale: isActive ? 1.05 : 1 - Math.abs(offset) * 0.1 + 0.02,
                                        y: isActive ? -10 : Math.abs(offset) * 40
                                    }}
                                >
                                    {/* Ticket Texture/Pattern */}
                                    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                                    {/* Header */}
                                    <div className="relative flex justify-between items-start opacity-70">
                                        <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
                                            <div className="w-6 h-6 rounded-full border border-white/20 border-dashed animate-[spin_10s_linear_infinite]" />
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-bold tracking-[0.2em] text-white/40">THE C1RCLE</span>
                                            <div className="h-0.5 w-8 bg-white/20 mt-1" />
                                        </div>
                                    </div>

                                    {/* Main Content */}
                                    <div className="relative text-center my-auto transform rotate-[-90deg] translate-y-4">
                                        <h2 className="text-5xl font-heading font-black text-white uppercase tracking-tighter whitespace-nowrap">
                                            {ticket.title}
                                        </h2>
                                    </div>

                                    {/* Footer */}
                                    <div className="relative w-full">
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Price</p>
                                                <p className="text-lg font-bold text-white">{ticket.price}</p>
                                            </div>
                                            <div className="h-8 w-12 rounded bg-white/10 flex items-center justify-center">
                                                <div className="w-1 h-4 bg-white/20 mx-[1px]" />
                                                <div className="w-0.5 h-3 bg-white/20 mx-[1px]" />
                                                <div className="w-1.5 h-4 bg-white/20 mx-[1px]" />
                                                <div className="w-0.5 h-2 bg-white/20 mx-[1px]" />
                                            </div>
                                        </div>

                                        {/* Use Button */}
                                        <div className={clsx(
                                            "w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-colors",
                                            isActive ? "bg-white text-black" : "bg-white/10 text-white/60"
                                        )}>
                                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                                {isActive ? "Select Ticket" : "View"}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Navigation Controls */}
                <div className="flex gap-6 mt-8 z-50">
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                        className="w-12 h-12 rounded-full border border-white/10 bg-white/5 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="w-12 h-12 rounded-full border border-white/10 bg-white/5 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
        );
    };

    const GuestView = () => (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 w-full relative">
            <div className="relative w-full max-w-7xl grid lg:grid-cols-2 gap-16 items-center">

                {/* Visual Side - Interactive Carousel */}
                <div className="relative w-full flex items-center justify-center lg:order-2">
                    <TicketCarousel />
                </div>

                {/* Content Side */}
                <div className="text-center lg:text-left flex flex-col items-center lg:items-start relative z-10 lg:order-1">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-5xl md:text-7xl font-heading font-black uppercase tracking-tighter text-black dark:text-white mb-6 leading-[0.85]">
                            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-gold">Pass</span> <br />
                            To The Circle
                        </h2>

                        <p className="text-sm font-medium text-black/60 dark:text-white/60 leading-relaxed max-w-md mb-10 mx-auto lg:mx-0">
                            Secure your spot at exclusive events. Your digital wallet for instant access, live updates, and effortless entry.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto lg:mx-0">
                            <Link href="/login" className="flex-1 group relative overflow-hidden px-8 py-4 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.5)]">
                                <span className="relative text-xs flex items-center justify-center gap-2">
                                    Login to Access
                                </span>
                            </Link>
                            <Link href="/login?mode=register" className="flex-1 px-8 py-4 rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors active:scale-95 flex items-center justify-center">
                                <span className="text-xs">Sign Up</span>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-[var(--bg-color)] text-[var(--text-primary)] transition-colors duration-500 selection:bg-orange/30 flex-1 flex flex-col">
            <AuroraBackground />

            {!user ? (
                <div className="relative z-10 mx-auto max-w-5xl px-4 pt-32 pb-20 sm:px-6 lg:px-8 flex-1 flex flex-col">
                    <h1 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter text-black dark:text-white mb-12">
                        Tickets
                    </h1>
                    <GuestView />
                </div>
            ) : (
                <div className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">

                    <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-0.5 w-6 bg-orange" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-black/30 dark:text-white/30">Your Collection</span>
                            </div>
                            <h1 className="text-6xl md:text-9xl font-heading font-black uppercase tracking-tighter text-black dark:text-white leading-[0.8]">
                                Tickets
                            </h1>
                            <div className="mt-12 flex gap-4 p-1 rounded-3xl bg-black/5 dark:bg-white/5 w-fit border border-black/5 dark:border-white/5 backdrop-blur-md overflow-x-auto no-scrollbar max-w-full">
                                <button
                                    onClick={() => setActiveTab("upcoming")}
                                    className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === "upcoming" ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg" : "text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60"}`}
                                >
                                    Upcoming
                                </button>
                                <button
                                    onClick={() => setActiveTab("action")}
                                    className={`relative whitespace-nowrap px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === "action" ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg" : "text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60"}`}
                                >
                                    Action Needed
                                    {tickets.actionNeeded.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange text-white text-[8px] flex items-center justify-center border-2 border-[var(--bg-color)]">
                                            {tickets.actionNeeded.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab("past")}
                                    className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === "past" ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg" : "text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60"}`}
                                >
                                    Past
                                </button>
                                <button
                                    onClick={() => setActiveTab("cancelled")}
                                    className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === "cancelled" ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg" : "text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60"}`}
                                >
                                    Cancelled
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="min-h-[400px]">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                {loading ? (
                                    <div className="grid gap-10 sm:grid-cols-2">
                                        <TicketSkeleton />
                                        <TicketSkeleton />
                                    </div>
                                ) : activeTab === "action" ? (
                                    tickets.actionNeeded.length > 0 ? (
                                        <div className="grid gap-6">
                                            {tickets.actionNeeded.map((action) => (
                                                <ActionCard key={action.id} action={action} onAction={loadTickets} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-32 text-center rounded-[40px] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                            <p className="text-black/30 dark:text-white/40 text-sm font-bold uppercase tracking-widest">Everything looks good</p>
                                        </div>
                                    )
                                ) : activeTab === "cancelled" ? (
                                    tickets.cancelledTickets.length > 0 ? (
                                        <div className="grid gap-10 sm:grid-cols-2">
                                            {tickets.cancelledTickets.map((ticket) => (
                                                <TicketCard
                                                    key={ticket.id}
                                                    ticket={{ ...ticket, status: ticket.status === 'refunded' ? 'refunded' : 'cancelled' }}
                                                    onClick={() => { }}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-32 text-center rounded-[40px] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                            <p className="text-black/30 dark:text-white/40 text-sm font-bold uppercase tracking-widest">No cancelled passes</p>
                                        </div>
                                    )
                                ) : (activeTab === "upcoming" ? tickets.upcomingTickets : tickets.pastTickets).length > 0 ? (
                                    <div className="grid gap-10 sm:grid-cols-2">
                                        {(activeTab === "upcoming" ? tickets.upcomingTickets : tickets.pastTickets).map((ticket) => (
                                            <TicketCard
                                                key={ticket.ticketId}
                                                ticket={ticket}
                                                onClick={setSelectedTicket}
                                                onShare={() => setSharingTicket(ticket)}
                                                onPartner={setPartnerTicket}
                                                onTransfer={setTransferTicket}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-32 text-center rounded-[40px] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                                        <p className="text-black/30 dark:text-white/40 text-sm font-bold uppercase tracking-widest">
                                            {activeTab === "upcoming" ? "No upcoming tickets" : "No past tickets yet"}
                                        </p>
                                        {activeTab === "upcoming" && (
                                            <Link href="/explore" className="mt-8 inline-block rounded-full bg-black dark:bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-white dark:text-black hover:scale-105 transition-transform shadow-md">
                                                Explore events
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {selectedTicket && (
                    <QRModal
                        ticket={selectedTicket}
                        onClose={() => setSelectedTicket(null)}
                        onPartner={(ticket) => {
                            setSelectedTicket(null);
                            setPartnerTicket(ticket);
                        }}
                    />
                )}
                {partnerTicket && (
                    <PartnerModal
                        ticket={partnerTicket}
                        onClose={() => setPartnerTicket(null)}
                        onSuccess={() => {
                            setPartnerTicket(null);
                            loadTickets();
                        }}
                    />
                )}
                {sharingTicket && (
                    <ShareModal
                        orderId={sharingTicket.orderId}
                        eventId={sharingTicket.eventId}
                        eventTitle={sharingTicket.eventTitle}
                        tierId={sharingTicket.tierId}
                        totalTickets={sharingTicket.totalSlots}
                        alreadyShared={sharingTicket.claimedSlots + 1} // +1 for owner slot which is already "shared/claimed" by owner
                        onClose={() => setSharingTicket(null)}
                        onSuccess={() => {
                            setSharingTicket(null);
                            loadTickets();
                        }}
                    />
                )}
                {transferTicket && (
                    <TransferModal
                        ticket={transferTicket}
                        onClose={() => setTransferTicket(null)}
                        onSuccess={() => {
                            setTransferTicket(null);
                            loadTickets();
                        }}
                    />
                )}
            </AnimatePresence>

            <style jsx global>{`
    /* Hide scrollbar for Chrome, Safari and Opera */
    .no-scrollbar::-webkit-scrollbar {
    display: none;
}

                /* Hide scrollbar for IE, Edge and Firefox */
                .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
`}</style>
        </div>
    );
}

export default function TicketsPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 dark:border-white/20 border-t-orange dark:border-t-white" />
            </div>
        }>
            <TicketsContent />
        </Suspense>
    );
}
