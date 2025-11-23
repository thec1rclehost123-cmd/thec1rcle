"use client";

import {
    Zap,
    Share2,
    Megaphone,
    Smartphone,
    Users,
    Trophy,
    Plus,
    X,
    Loader2,
    Copy,
    Check,
    ArrowUpRight
} from "lucide-react";
import {
    StudioCard,
    QuickActionCard
} from "../../../components/host/StudioComponents";
import {
    PromoterLeaderboard
} from "../../../components/host/AdvancedStudioComponents";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase/client";
import { useAuth } from "../../../components/providers/AuthProvider";

export default function MarketingPage() {
    const { user } = useAuth();
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [promos, setPromos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

    const [newPromo, setNewPromo] = useState({
        code: "",
        discount: 10,
        type: "percentage",
        maxUses: 100
    });

    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();

        const q = query(
            collection(db, "promocodes"),
            where("hostId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPromos(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching promos:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleCreatePromo = async (e) => {
        e.preventDefault();
        if (!user) return;
        setSubmitting(true);

        try {
            const db = getFirebaseDb();
            await addDoc(collection(db, "promocodes"), {
                hostId: user.uid,
                ...newPromo,
                uses: 0,
                createdAt: serverTimestamp(),
                active: true
            });
            setIsPromoModalOpen(false);
            setNewPromo({ code: "", discount: 10, type: "percentage", maxUses: 100 });
        } catch (error) {
            console.error("Error creating promo:", error);
            alert("Failed to create promo code");
        } finally {
            setSubmitting(false);
        }
    };

    const copyToClipboard = (code, id) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="max-w-[1800px] mx-auto space-y-8 pb-12 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white mb-1">Marketing</h1>
                    <p className="text-[#888] text-sm font-medium">Campaigns, promoters, and growth tools.</p>
                </div>
                <button
                    onClick={() => setIsPromoModalOpen(true)}
                    className="px-6 py-3 bg-[#F44A22] text-white rounded-full font-bold uppercase tracking-widest text-xs hover:bg-[#D43A12] transition-all shadow-[0_0_20px_-5px_rgba(244,74,34,0.5)] hover:shadow-[0_0_25px_-5px_rgba(244,74,34,0.6)] hover:-translate-y-0.5 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    New Campaign
                </button>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickActionCard icon={Smartphone} label="Push Notification" delay={0.1} />
                <QuickActionCard icon={Megaphone} label="Email Blast" delay={0.2} />
                <QuickActionCard icon={Share2} label="Create Promo Code" delay={0.3} onClick={() => setIsPromoModalOpen(true)} />
                <QuickActionCard icon={Users} label="Invite Promoters" delay={0.4} />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Promoter Leaderboard - 8 Cols */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <StudioCard className="flex-1 min-h-[500px]" delay={0.5}>
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-yellow-400" />
                                    Promoter Leaderboard
                                </h3>
                                <p className="text-xs text-[#666] font-medium mt-1">Top Performers This Month</p>
                            </div>
                            <button className="flex items-center gap-1 text-xs font-bold text-[#F44A22] hover:text-white transition-colors">
                                View Full Report
                                <ArrowUpRight className="w-3 h-3" />
                            </button>
                        </div>
                        <PromoterLeaderboard />
                    </StudioCard>
                </div>

                {/* Active Promo Codes - 4 Cols */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <StudioCard delay={0.6} className="h-full flex flex-col" noPadding>
                        <div className="p-6 border-b border-white/[0.05] bg-[#0A0A0A]">
                            <h3 className="text-lg font-bold text-white">Active Codes</h3>
                            <p className="text-xs text-[#666] mt-1">Live Campaigns</p>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 max-h-[600px]">
                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#F44A22]" /></div>
                            ) : promos.length === 0 ? (
                                <div className="text-center py-12 text-[#444] text-sm">No active codes</div>
                            ) : (
                                promos.map((promo) => (
                                    <div key={promo.id} className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10 transition-all group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/[0.05] flex items-center justify-center text-[#F44A22]">
                                                    <Zap className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-white text-lg tracking-wider">{promo.code}</span>
                                                        <button
                                                            onClick={() => copyToClipboard(promo.code, promo.id)}
                                                            className="text-[#444] hover:text-white transition-colors"
                                                        >
                                                            {copiedId === promo.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">
                                                        {promo.type === 'percentage' ? `${promo.discount}% Discount` : `₹${promo.discount} Flat Off`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/[0.05]">
                                            <div>
                                                <p className="text-[10px] text-[#666] font-bold uppercase tracking-wider mb-0.5">Redeemed</p>
                                                <p className="text-sm font-bold text-white">{promo.uses} <span className="text-[#444]">/ {promo.maxUses}</span></p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-[#666] font-bold uppercase tracking-wider mb-0.5">Status</p>
                                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    Active
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </StudioCard>
                </div>
            </div>

            {/* Create Promo Modal - Premium Glass */}
            <AnimatePresence>
                {isPromoModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setIsPromoModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
                        >
                            {/* Top Highlight */}
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-xl font-heading font-bold text-white">New Campaign</h3>
                                    <p className="text-xs text-[#666]">Create a promo code.</p>
                                </div>
                                <button onClick={() => setIsPromoModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleCreatePromo} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Promo Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={newPromo.code}
                                        onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                                        className="w-full bg-[#111] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-[#444] focus:border-[#F44A22] focus:bg-[#161616] outline-none transition-all"
                                        placeholder="SUMMER2025"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Discount</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={newPromo.discount}
                                            onChange={e => setNewPromo({ ...newPromo, discount: e.target.value })}
                                            className="w-full bg-[#111] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F44A22] focus:bg-[#161616] outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Type</label>
                                        <div className="relative">
                                            <select
                                                value={newPromo.type}
                                                onChange={e => setNewPromo({ ...newPromo, type: e.target.value })}
                                                className="w-full bg-[#111] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F44A22] focus:bg-[#161616] outline-none transition-all appearance-none"
                                            >
                                                <option value="percentage">% Percentage</option>
                                                <option value="flat">₹ Flat Amount</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <ArrowUpRight className="w-3 h-3 text-[#666] rotate-45" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Max Uses</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={newPromo.maxUses}
                                        onChange={e => setNewPromo({ ...newPromo, maxUses: e.target.value })}
                                        className="w-full bg-[#111] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:border-[#5D5FEF] focus:bg-[#161616] outline-none transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-[#e5e5e5] transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-white/5"
                                >
                                    {submitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Zap className="w-4 h-4" />}
                                    Launch Campaign
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
