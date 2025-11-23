"use client";

import {
    Search,
    Filter,
    MoreHorizontal,
    Star,
    Mail,
    Gift,
    Phone,
    Crown,
    History,
    ArrowUpRight,
    Download,
    UserPlus
} from "lucide-react";
import { StudioCard } from "../../../components/host/StudioComponents";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../components/providers/AuthProvider";

export default function AudiencePage() {
    const { user } = useAuth();
    const [guests, setGuests] = useState([]);
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const mockGuests = [
            { id: 1, name: "Rahul Sharma", email: "rahul@example.com", phone: "+91 98765 43210", visits: 12, spend: 24500, lastSeen: "2 days ago", tags: ["VIP", "High Roller"] },
            { id: 2, name: "Priya Patel", email: "priya@example.com", phone: "+91 98765 12345", visits: 5, spend: 4500, lastSeen: "1 week ago", tags: ["Regular"] },
            { id: 3, name: "Vikram Singh", email: "vikram@example.com", phone: "+91 98765 67890", visits: 1, spend: 800, lastSeen: "1 month ago", tags: ["New"] },
            { id: 4, name: "Anjali Gupta", email: "anjali@example.com", phone: "+91 98765 98765", visits: 8, spend: 15000, lastSeen: "3 days ago", tags: ["VIP"] },
            { id: 5, name: "Aditya Roy", email: "adi@example.com", phone: "+91 98765 54321", visits: 3, spend: 2500, lastSeen: "2 weeks ago", tags: [] },
        ];
        setGuests(mockGuests);
        // Select first guest by default for better UX
        setSelectedGuest(mockGuests[0]);
    }, []);

    const filteredGuests = guests.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-[1800px] mx-auto h-[calc(100vh-140px)] flex flex-col gap-6 pb-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white mb-1">Audience</h1>
                    <p className="text-[#888] text-sm font-medium">Your most valuable asset: your community.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-5 py-2.5 bg-white/[0.03] border border-white/[0.05] text-white rounded-full text-xs font-bold hover:bg-white/[0.08] transition-colors flex items-center gap-2">
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                    <button className="px-5 py-2.5 bg-white text-black rounded-full text-xs font-bold uppercase tracking-wider hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]">
                        <UserPlus className="w-3.5 h-3.5" />
                        Add Guest
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-6 min-h-0">
                {/* Main List */}
                <StudioCard className="flex flex-col h-full overflow-hidden" noPadding>
                    {/* Toolbar */}
                    <div className="p-4 border-b border-white/[0.05] flex items-center gap-4 bg-[#0A0A0A]">
                        <div className="flex-1 flex items-center gap-3 bg-[#111] border border-white/[0.05] rounded-xl px-4 py-2.5 focus-within:border-[#F44A22] transition-colors">
                            <Search className="w-4 h-4 text-[#666]" />
                            <input
                                type="text"
                                placeholder="Search guests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm text-white placeholder:text-[#444] w-full"
                            />
                        </div>
                        <button className="p-2.5 rounded-xl bg-[#111] border border-white/[0.05] text-[#666] hover:text-white hover:border-white/10 transition-colors">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-[#0A0A0A] border-b border-white/[0.05] text-[10px] font-bold text-[#666] uppercase tracking-wider">
                        <div className="col-span-4">Guest</div>
                        <div className="col-span-3">Status</div>
                        <div className="col-span-2 text-right">Visits</div>
                        <div className="col-span-2 text-right">Spend</div>
                        <div className="col-span-1"></div>
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0A0A]">
                        {filteredGuests.map((guest) => (
                            <div
                                key={guest.id}
                                onClick={() => setSelectedGuest(guest)}
                                className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.02] hover:bg-white/[0.02] transition-all cursor-pointer items-center group ${selectedGuest?.id === guest.id ? "bg-white/[0.04] border-l-2 border-l-[#F44A22]" : "border-l-2 border-l-transparent"
                                    }`}
                            >
                                <div className="col-span-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#161616] border border-white/[0.05] flex items-center justify-center text-xs font-bold text-[#888]">
                                        {guest.name[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm text-white truncate group-hover:text-[#F44A22] transition-colors">{guest.name}</div>
                                        <div className="text-[10px] text-[#666] truncate">{guest.email}</div>
                                    </div>
                                </div>
                                <div className="col-span-3 flex flex-wrap gap-1.5">
                                    {guest.tags.length > 0 ? guest.tags.map(tag => (
                                        <span key={tag} className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${tag === "VIP" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                            tag === "High Roller" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                tag === "New" ? "bg-[#F44A22]/10 text-[#F44A22] border-[#F44A22]/20" :
                                                    "bg-white/5 text-[#888] border-white/10"
                                            }`}>
                                            {tag}
                                        </span>
                                    )) : <span className="text-[10px] text-[#444] italic">No tags</span>}
                                </div>
                                <div className="col-span-2 text-right font-mono text-xs text-[#888]">{guest.visits}</div>
                                <div className="col-span-2 text-right font-mono text-xs font-bold text-white">₹{guest.spend.toLocaleString()}</div>
                                <div className="col-span-1 flex justify-end">
                                    <MoreHorizontal className="w-4 h-4 text-[#444] group-hover:text-white transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                </StudioCard>

                {/* Detail Panel */}
                <AnimatePresence mode="wait">
                    {selectedGuest ? (
                        <motion.div
                            key={selectedGuest.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="h-full"
                        >
                            <StudioCard className="h-full flex flex-col relative overflow-hidden" noPadding>
                                {/* Background Gradient */}
                                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#111] to-[#0A0A0A]" />

                                {/* Profile Header */}
                                <div className="relative p-8 pb-0 text-center z-10">
                                    <div className="w-24 h-24 rounded-full bg-[#0A0A0A] border-4 border-[#111] mx-auto mb-4 flex items-center justify-center relative group cursor-pointer">
                                        {/* Avatar Image or Initials */}
                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#1A1A1A] to-[#050505] flex items-center justify-center text-3xl font-heading font-bold text-white group-hover:scale-105 transition-transform">
                                            {selectedGuest.name[0]}
                                        </div>
                                        {/* Status Indicator */}
                                        <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#C6F432] rounded-full border-4 border-[#111]" />
                                    </div>

                                    <h2 className="text-2xl font-heading font-bold text-white mb-1">{selectedGuest.name}</h2>
                                    <p className="text-[#666] text-xs font-mono mb-6">{selectedGuest.id} • Joined Nov 2024</p>

                                    <div className="flex justify-center gap-3 mb-8">
                                        <button className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[#888] hover:text-white hover:bg-white/[0.08] transition-colors" title="Call">
                                            <Phone className="w-4 h-4" />
                                        </button>
                                        <button className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[#888] hover:text-white hover:bg-white/[0.08] transition-colors" title="Email">
                                            <Mail className="w-4 h-4" />
                                        </button>
                                        <button className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[#888] hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors" title="Star">
                                            <Star className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-px bg-white/[0.05] border-y border-white/[0.05]">
                                    <div className="p-6 bg-[#0A0A0A] text-center hover:bg-[#111] transition-colors">
                                        <div className="text-[10px] text-[#666] font-bold uppercase tracking-wider mb-1">Lifetime Value</div>
                                        <div className="text-xl font-bold text-white">₹{selectedGuest.spend.toLocaleString()}</div>
                                    </div>
                                    <div className="p-6 bg-[#0A0A0A] text-center hover:bg-[#111] transition-colors">
                                        <div className="text-[10px] text-[#666] font-bold uppercase tracking-wider mb-1">Avg. Ticket</div>
                                        <div className="text-xl font-bold text-white">₹{(selectedGuest.spend / selectedGuest.visits).toFixed(0)}</div>
                                    </div>
                                </div>

                                {/* Activity Feed */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#0A0A0A]">
                                    <h3 className="text-xs font-bold text-[#888] uppercase tracking-wider mb-6 flex items-center gap-2">
                                        <History className="w-3.5 h-3.5" />
                                        Recent Activity
                                    </h3>
                                    <div className="space-y-6 relative pl-2">
                                        {/* Timeline Line */}
                                        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/[0.05]" />

                                        {[1, 2, 3].map((_, i) => (
                                            <div key={i} className="relative pl-6 group">
                                                <div className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full bg-[#0A0A0A] border-2 border-[#333] group-hover:border-[#F44A22] group-hover:scale-110 transition-all z-10" />
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-sm text-white font-bold group-hover:text-[#F44A22] transition-colors">Attended "Neon Nights"</p>
                                                        <p className="text-xs text-[#666] mt-0.5">Purchased VIP Table</p>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-white bg-white/[0.05] px-2 py-1 rounded">₹5,000</span>
                                                </div>
                                                <p className="text-[10px] text-[#444] mt-1 font-medium">2 weeks ago</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="p-6 bg-[#0A0A0A] border-t border-white/[0.05] space-y-3">
                                    <button className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#e5e5e5] transition-colors flex items-center justify-center gap-2">
                                        <Gift className="w-3.5 h-3.5" />
                                        Send Comp Ticket
                                    </button>
                                    <button className="w-full py-3 bg-[#161616] text-[#FF4B55] border border-[#FF4B55]/20 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#FF4B55]/10 transition-colors">
                                        Block User
                                    </button>
                                </div>
                            </StudioCard>
                        </motion.div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[#444] text-sm font-medium">
                            Select a guest to view details
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
