"use client";

import { 
    useState,
    useEffect,
    useCallback,
    useMemo
} from "react";
import {
    ShieldCheck,
    Smartphone,
    Users,
    RefreshCw,
    Lock,
    Unlock,
    QrCode,
    Search,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    Clock,
    Loader2,
    Building2,
    Zap,
    Ticket,
    Activity,
    ArrowRight
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SecurityEvent {
    id: string;
    title: string;
    date: string;
    totalTickets: number;
    checkedIn: number;
    syncCode: string | null;
    status: "active" | "standby" | "completed";
}

interface Guest {
    id: string;
    name: string;
    type: string;
    status: string;
    timestamp?: string;
}

interface PageClientProps {
    setActions?: (actions: React.ReactNode) => void;
}

export default function GateSecurityPage({ setActions }: PageClientProps) {
    const { profile } = useDashboardAuth();
    const [events, setEvents] = useState<SecurityEvent[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [guestList, setGuestList] = useState<Guest[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchSecurityData = useCallback(async () => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsLoading(true);
        try {
            const venueId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/partners/venues/security/sync?venueId=${venueId}`);
            if (res.ok) {
                const data = await res.json();
                setEvents(data.events);
                if (data.events.length > 0 && !selectedEventId) {
                    setSelectedEventId(data.events[0].id);
                }
            }
        } catch (err) {
            console.error("Security fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [profile, selectedEventId]);

    const fetchGuestlist = useCallback(async (eventId: string) => {
        if (!eventId) return;
        try {
            const res = await fetch(`/api/events/${eventId}/guestlist`);
            if (res.ok) {
                const data = await res.json();
                setGuestList(data.guests || data.guestlist || []);
            }
        } catch (err) {
            console.error("Guestlist fetch error:", err);
        }
    }, []);

    useEffect(() => {
        fetchSecurityData();
    }, [profile, fetchSecurityData]);

    useEffect(() => {
        if (selectedEventId) {
            fetchGuestlist(selectedEventId);
        }
    }, [selectedEventId, fetchGuestlist]);

    useEffect(() => {
        if (setActions) {
            setActions(
                <div className="flex gap-3">
                    <button
                        onClick={fetchSecurityData}
                        className="flex items-center gap-2.5 px-6 py-3 bg-surface-elevated border border-border-strong rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-surface-tertiary transition-all hover:scale-105 active:scale-95 shadow-sm"
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        Refresh Data
                    </button>
                    <button className="flex items-center gap-2.5 px-6 py-3 bg-text-primary text-text-inverse rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-text-secondary transition-all hover:scale-105 active:scale-95 shadow-xl">
                        <Users className="h-4 w-4" />
                        Staff Override
                    </button>
                </div>
            );
        }
    }, [setActions, fetchSecurityData, isLoading]);

    const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);

    const generateSyncCode = async (eventId: string) => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsSyncing(true);
        try {
            const venueId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/partners/venues/security/sync`, {
                method: "POST",
                body: JSON.stringify({ eventId, venueId, userId: profile.uid })
            });
            if (res.ok) {
                fetchSecurityData();
            }
        } catch (err) {
            console.error("Sync code error:", err);
        } finally {
            setIsSyncing(false);
        }
    };

    const deactivateSync = async (eventId: string) => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsSyncing(true);
        try {
            const venueId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/partners/venues/security/sync`, {
                method: "POST",
                body: JSON.stringify({ eventId, venueId, action: "deactivate" })
            });
            if (res.ok) {
                fetchSecurityData();
            }
        } catch (err) {
            console.error("Deactivate error:", err);
        } finally {
            setIsSyncing(false);
        }
    };

    const filteredGuests = useMemo(() => guestList.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.id.toLowerCase().includes(searchQuery.toLowerCase())
    ), [guestList, searchQuery]);

    if (isLoading && events.length === 0) {
        return (
            <div className="py-32 flex flex-col items-center justify-center">
                <div className="relative">
                    <div className="absolute inset-0 bg-accent-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <Loader2 className="h-14 w-14 text-accent-primary animate-spin mb-8 relative z-10" />
                </div>
                <p className="text-text-primary font-black uppercase tracking-[0.3em] text-[12px] animate-pulse">
                    Initializing Security Matrix...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Control Panel */}
                <div className="lg:col-span-4 space-y-8 h-full">
                    <BentoCard padding="lg" className="border-border-default shadow-xl bg-surface-elevated/40 backdrop-blur-xl">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="p-4 rounded-[1.25rem] bg-indigo-500/10 text-indigo-500 shadow-sm border border-indigo-500/5">
                                <Smartphone size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-text-primary tracking-tight">Scanner Sync</h2>
                                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mt-0.5 opacity-60">Terminal Management</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-tertiary ml-1">
                                    <Activity size={14} className="text-accent-primary" />
                                    Operational Event
                                </label>
                                <div className="relative group">
                                    <select
                                        value={selectedEventId}
                                        onChange={(e) => setSelectedEventId(e.target.value)}
                                        className="w-full px-8 py-5 bg-surface-secondary/50 border-2 border-border-strong rounded-[1.5rem] font-bold text-[15px] appearance-none cursor-pointer focus:outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all text-text-primary"
                                    >
                                        {events.map(e => (
                                            <option key={e.id} value={e.id}>{e.title}</option>
                                        ))}
                                        {events.length === 0 && <option value="">No Active Deployments</option>}
                                    </select>
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary group-hover:text-text-primary transition-colors">
                                        <ArrowRight size={20} className="rotate-90" />
                                    </div>
                                </div>
                            </div>

                            {selectedEvent && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-10 rounded-[2.5rem] bg-surface-secondary border-2 border-border-strong text-center relative overflow-hidden group shadow-inner"
                                >
                                    <div className="absolute -top-10 -right-10 p-3 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-1000 rotate-12 group-hover:rotate-0 group-hover:scale-110">
                                        <QrCode className="h-48 w-48 text-text-primary" />
                                    </div>

                                    <p className="text-text-primary/40 text-[10px] font-black uppercase tracking-[0.25em] mb-6 flex items-center justify-center gap-2">
                                        <Zap size={14} className="fill-current" />
                                        Cloud Gateway Code
                                    </p>

                                    {selectedEvent.syncCode ? (
                                        <div className="space-y-8 relative z-10">
                                            <div className="text-6xl font-black text-text-primary tracking-[0.3em] mb-2 drop-shadow-[0_20px_30px_rgba(0,0,0,0.1)] font-mono">
                                                {selectedEvent.syncCode}
                                            </div>
                                            <div className="flex items-center justify-center gap-3 text-emerald-500 text-[11px] font-black uppercase tracking-widest bg-emerald-500/10 py-3 px-6 rounded-full w-fit mx-auto border border-emerald-500/20 shadow-sm">
                                                <span className="relative flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                                </span>
                                                Active Link
                                            </div>
                                            <button
                                                onClick={() => deactivateSync(selectedEvent.id)}
                                                disabled={isSyncing}
                                                className="w-full py-5 bg-surface-elevated/20 hover:bg-red-500/10 text-text-tertiary hover:text-red-500 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all border border-border-subtle hover:border-red-500/30 group/kill shadow-sm"
                                            >
                                                Kill Connection
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-8 relative z-10">
                                            <div className="text-6xl font-black text-text-primary/10 tracking-[0.3em] mb-2 font-mono italic">
                                                --- ---
                                            </div>
                                            <button
                                                onClick={() => generateSyncCode(selectedEvent.id)}
                                                disabled={isSyncing}
                                                className="w-full py-5 bg-accent-primary hover:bg-accent-secondary text-text-inverse rounded-[1.5rem] text-xs font-bold uppercase tracking-widest shadow-2xl shadow-accent-primary/20 transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50"
                                            >
                                                {isSyncing ? (
                                                    <div className="flex items-center justify-center gap-3">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Provisioning...
                                                    </div>
                                                ) : "Boot Sync Gateway"}
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-text-primary/30 text-[10px] font-semibold mt-8 max-w-[240px] mx-auto leading-relaxed">
                                        Scan this code within the <span className="text-text-primary">C1rcle Guard App</span> to bridge distributed handheld scanners.
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </BentoCard>

                    {selectedEvent && (
                        <BentoCard padding="lg" className="border-border-default shadow-xl">
                            <h3 className="text-[11px] font-black text-text-tertiary uppercase tracking-widest mb-10 flex items-center gap-2">
                                <Activity size={16} className="text-accent-primary" />
                                Entry Saturation
                            </h3>

                            <div className="relative py-10 flex justify-center">
                                <div className="relative h-64 w-64">
                                    <svg className="h-full w-full -rotate-90">
                                        <circle cx="128" cy="128" r="114" className="stroke-surface-secondary" strokeWidth="24" fill="none" />
                                        <motion.circle
                                            cx="128" cy="128" r="114"
                                            initial={{ strokeDashoffset: 2 * Math.PI * 114 }}
                                            animate={{ strokeDashoffset: 2 * Math.PI * 114 * (1 - (selectedEvent.checkedIn / (selectedEvent.totalTickets || 1))) }}
                                            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                                            className="stroke-text-primary"
                                            strokeWidth="24"
                                            fill="none"
                                            strokeDasharray={2 * Math.PI * 114}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-6xl font-black text-text-primary tracking-tighter tabular-nums">{Math.round((selectedEvent.checkedIn / (selectedEvent.totalTickets || 1)) * 100)}%</span>
                                        <span className="text-[11px] font-black text-text-tertiary uppercase tracking-[0.2em] mt-2 bg-surface-secondary px-4 py-1.5 rounded-full border border-border-subtle shadow-sm italic">Validation Rate</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mt-8">
                                <div className="p-8 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 group hover:border-emerald-500/20 transition-all shadow-sm">
                                    <p className="text-4xl font-black text-text-primary tabular-nums group-hover:scale-110 transition-transform origin-left">{selectedEvent.checkedIn}</p>
                                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mt-1">Cleared</p>
                                </div>
                                <div className="p-8 bg-surface-secondary/50 rounded-[2rem] border border-border-subtle group hover:border-text-primary/20 transition-all shadow-sm">
                                    <p className="text-4xl font-black text-text-primary tabular-nums group-hover:scale-110 transition-transform origin-left">
                                        {Math.max(0, selectedEvent.totalTickets - selectedEvent.checkedIn)}
                                    </p>
                                    <p className="text-[11px] font-black text-text-tertiary uppercase tracking-widest mt-1">Residual</p>
                                </div>
                            </div>
                        </BentoCard>
                    )}
                </div>

                {/* Right Data Terminal */}
                <div className="lg:col-span-8 h-full">
                    <BentoCard padding="lg" className="border-border-default shadow-2xl flex flex-col h-full min-h-[960px] overflow-hidden bg-surface-elevated">
                        <div className="p-8 border-b-2 border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-8 bg-surface-secondary/20">
                            <div>
                                <h2 className="text-3xl font-black text-text-primary tracking-tight flex items-center gap-3">
                                    <Ticket size={32} className="text-accent-primary" />
                                    Main Manifest
                                </h2>
                                <p className="text-[11px] text-text-tertiary font-black uppercase tracking-[0.2em] mt-1 italic">Manual Validation & Override Terminal</p>
                            </div>
                            <div className="relative group min-w-[380px]">
                                <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-6 w-6 text-text-tertiary group-focus-within:text-text-primary transition-all group-focus-within:scale-110" />
                                <input
                                    type="text"
                                    placeholder="SCAN TICKET OR TYPE NAME IDENTIFIER..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-16 pr-10 py-6 w-full bg-surface-elevated border-2 border-border-strong rounded-[1.75rem] text-sm font-bold tracking-tight uppercase focus:outline-none focus:border-accent-primary focus:ring-8 focus:ring-accent-primary/10 transition-all shadow-inner placeholder:text-text-placeholder/60"
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-surface-secondary p-2 rounded-xl border border-border-subtle group-focus-within:opacity-0 transition-opacity">
                                    <kbd className="text-[10px] font-black text-text-tertiary">⌘ F</kbd>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-surface-elevated/95 backdrop-blur-xl border-b border-border-subtle shadow-sm">
                                    <tr>
                                        <th className="px-10 py-8 text-[11px] font-black text-text-tertiary uppercase tracking-[0.25em]">Validated Name</th>
                                        <th className="px-10 py-8 text-[11px] font-black text-text-tertiary uppercase tracking-[0.25em]">Classification</th>
                                        <th className="px-10 py-8 text-[11px] font-black text-text-tertiary uppercase tracking-[0.25em]">Access State</th>
                                        <th className="px-10 py-8 text-[11px] font-black text-text-tertiary uppercase tracking-[0.25em] text-right">Administrative</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle/50">
                                    {filteredGuests.map((guest) => (
                                        <tr key={guest.id} className="hover:bg-surface-secondary/30 transition-all group cursor-pointer border-l-4 border-l-transparent hover:border-l-accent-primary">
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-5">
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border border-border-subtle",
                                                        guest.status === 'checked_in' ? "bg-emerald-500/10 text-emerald-600" : "bg-surface-secondary text-text-placeholder"
                                                    )}>
                                                        {guest.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-extrabold text-text-primary text-[17px] group-hover:text-accent-primary transition-colors tabular-nums">{guest.name || 'Anonymous Guest'}</span>
                                                        <span className="text-[11px] font-black text-text-tertiary uppercase tracking-widest mt-1 font-mono opacity-60">Manifest ID: #{guest.id.substring(0, 8).toUpperCase()}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-8 font-black text-[12px] uppercase tracking-widest text-text-tertiary italic">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-lg",
                                                    guest.type === 'VIP' ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : 
                                                    guest.type === 'BOTTLE' ? "bg-purple-500/10 text-purple-600 border border-purple-500/20" : "bg-surface-secondary/50"
                                                )}>
                                                    {guest.type || 'Standard'}
                                                </span>
                                            </td>
                                            <td className="px-10 py-8">
                                                {guest.status === 'checked_in' ? (
                                                    <span className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm animate-in fade-in zoom-in duration-500">
                                                        <CheckCircle2 size={16} />
                                                        Matrix Cleared
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-surface-secondary text-text-tertiary border border-border-strong shadow-sm group-hover:bg-accent-primary/5 transition-all">
                                                        <Clock size={16} />
                                                        Entry Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-10 py-8 text-right">
                                                {guest.status !== 'checked_in' ? (
                                                    <button className="px-8 py-3.5 bg-surface-secondary text-text-primary rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-text-primary hover:text-text-inverse transition-all shadow-xl hover:shadow-text-primary/20 active:scale-[0.9] border-2 border-border-strong hover:border-text-primary group-hover:scale-105">
                                                        Flash Validate
                                                    </button>
                                                ) : (
                                                    <div className="flex flex-col items-end opacity-40 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest italic">Entry: 22:45 IST</span>
                                                        <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-tighter">Terminal A-12</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {filteredGuests.length === 0 && (
                                <div className="py-48 text-center flex flex-col items-center justify-center">
                                    <div className="p-10 rounded-[3rem] bg-surface-secondary/40 border-4 border-dashed border-border-strong mb-10 group hover:border-accent-primary/30 transition-all">
                                        <Users className="h-28 w-28 text-text-placeholder opacity-20 group-hover:scale-110 group-hover:opacity-40 transition-all duration-700" />
                                    </div>
                                    <p className="font-black text-text-primary uppercase tracking-[0.4em] text-xl">Shadow Protocol Active</p>
                                    <p className="text-text-tertiary font-bold uppercase tracking-widest text-[11px] mt-4 max-w-[400px] leading-relaxed italic">
                                        No matching identities found in current manifest. Ensure scanner is synced or check manual ID entry.
                                    </p>
                                </div>
                            )}
                        </div>
                    </BentoCard>
                </div>
            </div>
        </div>
    );
}

