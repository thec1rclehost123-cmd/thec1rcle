"use client";

import { useEffect, useState } from "react";
import {
    Layout,
    Plus,
    Trash2,
    Armchair,
    Edit3,
    Users,
    Sparkles,
    Wine,
    Save,
    X,
    Loader2,
    Search,
    MapPin,
    DollarSign,
    Layers,
    ArrowUpRight
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion, AnimatePresence } from "framer-motion";

const TABLE_TYPES = [
    { id: "standard", label: "Standard", icon: Armchair, color: "slate" },
    { id: "premium", label: "Premium", icon: Wine, color: "orange" },
    { id: "vvip", label: "VVIP", icon: Sparkles, color: "purple" },
    { id: "booth", label: "Booth", icon: Users, color: "blue" },
    { id: "cabana", label: "Cabana", icon: Layout, color: "emerald" },
];

export default function TablesPage() {
    const { profile } = useDashboardAuth();
    const [mode, setMode] = useState<"setup" | "tonight">("setup");
    const [tables, setTables] = useState<any[]>([]);
    const [tonightEvent, setTonightEvent] = useState<any>(null);
    const [eventTableStatus, setEventTableStatus] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTable, setEditingTable] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchTables = async () => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/venue/tables?venueId=${profile.activeMembership.partnerId}`);
            if (res.ok) {
                const data = await res.json();
                setTables(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTonightEvent = async () => {
        if (!profile?.activeMembership?.partnerId) return;
        try {
            const res = await fetch(`/api/venue/events?venueId=${profile.activeMembership.partnerId}&limit=1`);
            if (res.ok) {
                const data = await res.json();
                if (data.events?.[0]) {
                    setTonightEvent(data.events[0]);
                    fetchEventStatus(data.events[0].id);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchEventStatus = async (eventId: string) => {
        try {
            const res = await fetch(`/api/venue/tables?eventId=${eventId}`);
            if (res.ok) {
                const data = await res.json();
                setEventTableStatus(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchTables();
        fetchTonightEvent();
    }, [profile]);

    const handleSaveTable = async (tableData: any) => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsSaving(true);
        try {
            const res = await fetch("/api/venue/tables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    venueId: profile.activeMembership.partnerId,
                    table: tableData
                })
            });
            if (res.ok) {
                fetchTables();
                setShowAddModal(false);
                setEditingTable(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const updateStatus = async (tableId: string, status: string, notes: string = "") => {
        if (!tonightEvent?.id) return;
        setIsSaving(true);
        try {
            await fetch("/api/venue/tables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "updateStatus",
                    eventId: tonightEvent.id,
                    tableId,
                    status,
                    notes
                })
            });
            fetchEventStatus(tonightEvent.id);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTable = async (tableId: string) => {
        if (!window.confirm("Delete this table definition?")) return;
        try {
            const res = await fetch(`/api/venue/tables?tableId=${tableId}`, { method: "DELETE" });
            if (res.ok) fetchTables();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredTables = tables.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.location?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalCapacity = tables.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0);
    const vvipCount = tables.filter(t => t.type === 'vvip').length;

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-slate-200 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Mapping Floor Plan...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4 uppercase">
                        Tables & VIP
                    </h1>
                    <p className="text-slate-500 text-lg font-medium mt-3">Manage floor inventory and real-time nightly reservations.</p>
                </div>
                <div className="flex p-1.5 bg-slate-100 rounded-[1.5rem] w-fit">
                    <button
                        onClick={() => setMode("setup")}
                        className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === "setup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                        Floor Setup
                    </button>
                    <button
                        onClick={() => setMode("tonight")}
                        className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === "tonight" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                        Tonight's Ops
                    </button>
                </div>
            </div>

            {mode === "setup" ? (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatCard label="Total Tables" value={tables.length} icon={Armchair} color="indigo" />
                        <StatCard label="Guest Capacity" value={totalCapacity} icon={Users} color="emerald" />
                        <StatCard label="VVIP Units" value={vvipCount} icon={Sparkles} color="purple" />
                        <StatCard label="Sections" value={new Set(tables.map(t => t.location)).size} icon={Layers} color="amber" />
                    </div>

                    <div className="flex items-center justify-between gap-6">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search definitions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-16 pr-6 py-5 bg-white border border-slate-200 rounded-3xl text-sm font-medium focus:ring-4 focus:ring-slate-50 transition-all outline-none"
                            />
                        </div>
                        <button
                            onClick={() => {
                                setEditingTable(null);
                                setShowAddModal(true);
                            }}
                            className="flex items-center gap-3 px-8 py-5 bg-slate-900 text-white rounded-[1.5rem] text-sm font-bold shadow-xl hover:bg-slate-800 transition-all active:scale-95 group shrink-0"
                        >
                            <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                            Add Definition
                        </button>
                    </div>

                    {filteredTables.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {filteredTables.map((table) => (
                                <TableCard
                                    key={table.id}
                                    table={table}
                                    onEdit={() => {
                                        setEditingTable(table);
                                        setShowAddModal(true);
                                    }}
                                    onDelete={() => handleDeleteTable(table.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 p-20 text-center">
                            <div className="h-20 w-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6 text-slate-300">
                                <Armchair className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No tables mapped</h3>
                            <p className="text-slate-500 text-sm max-w-sm mx-auto">Start building your floor plan.</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-10">
                    <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Tonight's Production</span>
                            <h2 className="text-3xl font-black mt-2">{tonightEvent?.name || "No Live Event"}</h2>
                            <p className="text-white/60 text-sm font-medium mt-1">{tonightEvent?.start_date ? new Date(tonightEvent.start_date).toDateString() : 'N/A'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="px-8 py-5 bg-white/5 rounded-3xl border border-white/10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Booked</p>
                                <p className="text-2xl font-black">{eventTableStatus?.bookings?.length || 0}</p>
                            </div>
                            <div className="px-8 py-5 bg-white/5 rounded-3xl border border-white/10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Available</p>
                                <p className="text-2xl font-black">{tables.length - (eventTableStatus?.bookings?.length || 0)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {tables.map(table => {
                            const booking = eventTableStatus?.bookings?.find((b: any) => b.tableId === table.id);
                            const isBlocked = eventTableStatus?.blockedTables?.includes(table.id);

                            return (
                                <div key={table.id} className="bg-white border border-slate-200 rounded-[2rem] p-8 flex items-center justify-between group hover:shadow-xl transition-all">
                                    <div className="flex items-center gap-8">
                                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isBlocked ? 'bg-amber-50 text-amber-500' : booking ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'}`}>
                                            <Armchair className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900">{table.name}</h3>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{table.location} • {table.capacity} Pax</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        {booking ? (
                                            <div className="text-right flex items-center gap-6">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">{booking.guestName || "Reserved Guest"}</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Confimed Reservation</p>
                                                </div>
                                                <div className="h-10 w-[1px] bg-slate-100" />
                                                <button onClick={() => updateStatus(table.id, 'available')} className="p-4 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all">
                                                    <X className="h-5 w-5" />
                                                </button>
                                            </div>
                                        ) : isBlocked ? (
                                            <div className="flex items-center gap-6">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Held / Blocked</p>
                                                <button onClick={() => updateStatus(table.id, 'available')} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                                    Release
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => updateStatus(table.id, 'blocked')}
                                                    className="px-6 py-3 bg-slate-50 text-slate-400 hover:text-slate-900 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    Hold Table
                                                </button>
                                                <button
                                                    onClick={() => updateStatus(table.id, 'reserved', 'Manual Reservation')}
                                                    className="px-6 py-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    Mark Reserved
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {showAddModal && (
                    <TableModal
                        table={editingTable}
                        isSaving={isSaving}
                        onClose={() => setShowAddModal(false)}
                        onSave={handleSaveTable}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color }: any) {
    const colors: any = {
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        purple: "bg-purple-50 text-purple-600 border-purple-100"
    };

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:scale-[1.02]">
            <div className={`h-12 w-12 rounded-2xl ${colors[color]} flex items-center justify-center mb-6 border`}>
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
        </div>
    );
}

function TableCard({ table, onEdit, onDelete }: any) {
    const type = TABLE_TYPES.find(t => t.id === table.type) || TABLE_TYPES[0];
    const Icon = type.icon;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
        >
            <div className={`h-24 p-8 flex items-center justify-between border-b border-slate-50 shadow-inner`} style={{ backgroundColor: `${type.color === 'slate' ? '#f8fafc' : type.color === 'orange' ? '#fff7ed' : type.color === 'purple' ? '#faf5ff' : type.color === 'blue' ? '#eff6ff' : '#ecfdf5'}` }}>
                <div className={`h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-900`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onEdit} className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-xl shadow-sm transition-all hover:scale-110 active:scale-95">
                        <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={onDelete} className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-xl shadow-sm transition-all hover:scale-110 active:scale-95">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div className="p-8">
                <div className="mb-6">
                    <p className="text-3xl font-black text-slate-900 tracking-tight">{table.name}</p>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 mt-1">
                        <MapPin className="h-3 w-3" /> {table.location || "Main Floor"}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 leading-none">Min Spend</p>
                        <p className="text-lg font-black text-slate-900 leading-none">₹{table.minSpend || 0}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 leading-none">Seats</p>
                        <p className="text-lg font-black text-slate-900 leading-none">{table.capacity} Pax</p>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${table.isActive !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                        {table.isActive !== false ? 'Active' : 'Offline'}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Type: <span className="text-slate-900">{type.label}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function TableModal({ table, isSaving, onClose, onSave }: any) {
    const [formData, setFormData] = useState(table || {
        name: "",
        type: "standard",
        capacity: 4,
        minSpend: 5000,
        location: "Main Floor",
        isActive: true
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-100/90 backdrop-blur-xl"
            />
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white"
            >
                <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase">
                            {table ? "Edit Table" : "Add New Table"}
                        </h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Configure layout properties.</p>
                    </div>
                    <button onClick={onClose} className="p-4 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-3xl transition-all">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4 col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Table Name / ID</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all outline-none"
                                placeholder="e.g. V01, VIP-4"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Table Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all outline-none appearance-none"
                            >
                                {TABLE_TYPES.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Location / Floor</label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all outline-none"
                                placeholder="Main Floor, Rooftop..."
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Capacity (Pax)</label>
                            <div className="relative">
                                <Users className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="number"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                    className="w-full pl-16 pr-6 py-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Min Spend (₹)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="number"
                                    value={formData.minSpend}
                                    onChange={(e) => setFormData({ ...formData, minSpend: e.target.value })}
                                    className="w-full pl-16 pr-6 py-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <label className="flex items-center gap-4 cursor-pointer group">
                            <div
                                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                className={`w-14 h-8 rounded-full transition-all flex items-center p-1 ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            >
                                <motion.div
                                    animate={{ x: formData.isActive ? 24 : 0 }}
                                    className="w-6 h-6 bg-white rounded-full shadow-sm"
                                />
                            </div>
                            <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">Active in Discovery</span>
                        </label>
                    </div>
                </div>

                <div className="p-10 border-t border-slate-50 bg-slate-50/50 flex items-center justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(formData)}
                        disabled={isSaving || !formData.name}
                        className="flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl text-sm font-black shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Save Definition
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
