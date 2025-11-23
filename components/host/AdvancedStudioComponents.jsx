"use client";

import { motion } from "framer-motion";
import {
    Users,
    TrendingUp,
    Music,
    Crown,
    Zap,
    Clock,
    MapPin,
    Star,
    Share2,
    Calendar
} from "lucide-react";
import { StudioCard } from "./StudioComponents";

// --- Club Intelligence ---

export const CrowdPredictionChart = () => {
    // Mock prediction data (Time vs Crowd Level)
    const data = [
        { time: "9 PM", level: 20 },
        { time: "10 PM", level: 45 },
        { time: "11 PM", level: 85 },
        { time: "12 AM", level: 100 },
        { time: "1 AM", level: 90 },
        { time: "2 AM", level: 60 },
        { time: "3 AM", level: 30 },
    ];

    return (
        <div className="h-64 w-full mt-4 relative">
            <div className="absolute inset-0 flex items-end justify-between px-2">
                {data.map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 flex-1 group cursor-pointer">
                        <div className="w-full max-w-[40px] h-full flex items-end relative">
                            {/* Bar */}
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${item.level}%` }}
                                transition={{ duration: 1, delay: i * 0.1 }}
                                className={`w-full rounded-t-lg relative overflow-hidden ${item.level > 80 ? "bg-gradient-to-t from-red-600 to-orange-500" :
                                        item.level > 50 ? "bg-gradient-to-t from-iris to-purple-500" :
                                            "bg-white/10"
                                    }`}
                            >
                                {/* Pulse effect for peak times */}
                                {item.level > 80 && (
                                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                )}
                            </motion.div>

                            {/* Tooltip */}
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                {item.level}% Capacity
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-white/40">{item.time}</span>
                    </div>
                ))}
            </div>

            {/* Peak Time Indicator */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-bold text-white">Peak: 12:00 AM</span>
            </div>
        </div>
    );
};

export const TableBookingGrid = () => {
    // Mock table data
    const tables = Array.from({ length: 12 }).map((_, i) => ({
        id: i + 1,
        status: i < 3 ? "occupied" : i < 5 ? "reserved" : "available",
        type: i < 4 ? "VIP" : "Standard"
    }));

    return (
        <div className="grid grid-cols-4 gap-3 mt-4">
            {tables.map((table, i) => (
                <motion.div
                    key={table.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer hover:scale-105 transition-transform relative overflow-hidden ${table.status === "occupied" ? "bg-red-500/10 border-red-500/20" :
                            table.status === "reserved" ? "bg-yellow-500/10 border-yellow-500/20" :
                                "bg-emerald-500/10 border-emerald-500/20"
                        }`}
                >
                    <div className={`w-2 h-2 rounded-full absolute top-2 right-2 ${table.status === "occupied" ? "bg-red-500" :
                            table.status === "reserved" ? "bg-yellow-500" :
                                "bg-emerald-500"
                        }`} />

                    <span className="text-lg font-bold text-white">{table.id}</span>
                    <span className="text-[10px] uppercase tracking-wider font-medium text-white/60">{table.type}</span>

                    {table.status === "occupied" && (
                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20" />
                    )}
                </motion.div>
            ))}
        </div>
    );
};

export const AICrowdInsight = () => {
    return (
        <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-iris/10 to-purple-500/10 rounded-xl border border-iris/20 mt-4">
            <div className="p-2 bg-iris/20 rounded-lg">
                <Star className="w-5 h-5 text-iris" />
            </div>
            <div>
                <h4 className="text-sm font-bold text-white mb-1">AI Prediction</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                    Based on historical data, expect a <span className="text-white font-bold">25% surge</span> in attendance between 11 PM and 1 AM due to the "Techno Night" theme. Recommend opening 2 extra bars.
                </p>
            </div>
        </div>
    );
};

// --- Promoter Tools ---

export const PromoterLeaderboard = () => {
    const promoters = [
        { name: "Rahul S.", sales: 145, revenue: "₹72.5k", trend: "+12%" },
        { name: "Priya M.", sales: 120, revenue: "₹60.0k", trend: "+5%" },
        { name: "Vikram K.", sales: 98, revenue: "₹49.0k", trend: "-2%" },
        { name: "Aditya R.", sales: 85, revenue: "₹42.5k", trend: "+8%" },
    ];

    return (
        <div className="space-y-3 mt-4">
            {promoters.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-500 text-black" :
                                i === 1 ? "bg-gray-300 text-black" :
                                    i === 2 ? "bg-orange-700 text-white" : "bg-white/10 text-white"
                            }`}>
                            {i + 1}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{p.name}</p>
                            <p className="text-[10px] text-white/40">{p.sales} sales</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-mono font-bold text-emerald-400">{p.revenue}</p>
                        <p className={`text-[10px] ${p.trend.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{p.trend}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- Artist Tools ---

export const ArtistGigRequests = () => {
    const requests = [
        { club: "Club Prive", date: "Nov 24", fee: "₹25k", status: "Pending" },
        { club: "High Spirits", date: "Dec 02", fee: "₹30k", status: "Approved" },
    ];

    return (
        <div className="space-y-3 mt-4">
            {requests.map((req, i) => (
                <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${req.status === "Pending" ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"
                            }`}>
                            {req.status}
                        </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">{req.club}</h4>
                    <div className="flex items-center gap-4 text-xs text-white/60 mb-3">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {req.date}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> 500+ exp.</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-lg font-mono font-bold text-white">{req.fee}</span>
                        <button className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:scale-105 transition-transform">
                            {req.status === "Pending" ? "Accept" : "View Details"}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- Event Management Tools ---

export const TicketTierList = () => {
    const tiers = [
        { name: "Early Bird", sold: 150, total: 200, price: "₹499" },
        { name: "Phase 1", sold: 85, total: 300, price: "₹799" },
        { name: "VIP", sold: 20, total: 50, price: "₹1499" },
    ];

    return (
        <div className="space-y-3 mt-4">
            {tiers.map((tier, i) => (
                <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="font-bold text-white">{tier.name}</span>
                        <span className="text-white/60">{tier.sold}/{tier.total} Sold</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(tier.sold / tier.total) * 100}%` }}
                            transition={{ duration: 1, delay: i * 0.2 }}
                            className="h-full bg-gradient-to-r from-iris to-purple-500"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};
