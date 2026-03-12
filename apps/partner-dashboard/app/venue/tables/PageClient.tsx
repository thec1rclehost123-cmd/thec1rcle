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
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";

const TABLE_TYPES = [
    { id: "standard", label: "Standard", icon: Armchair, color: "var(--v-text-muted)" },
    { id: "premium", label: "Premium", icon: Wine, color: "var(--v-orange)" },
    { id: "vvip", label: "VVIP", icon: Sparkles, color: "#A78BFA" },
    { id: "booth", label: "Booth", icon: Users, color: "var(--v-info)" },
    { id: "cabana", label: "Cabana", icon: Layout, color: "var(--v-success)" },
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
            <div className="py-16 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: "var(--v-text-muted)" }} />
                <p className="v-label text-[9px]">Mapping Floor Plan...</p>
            </div>
        );
    }

    return (
        <VenuePageShell
            title="Tables & VIP"
            subtitle="Floor inventory and nightly reservations"
            actions={
                <div className="flex items-center gap-2">
                    {/* Mode toggle */}
                    <div className="flex p-1 rounded-xl" style={{ background: "var(--v-hero)", border: "1px solid var(--v-border)" }}>
                        <button
                            onClick={() => setMode("setup")}
                            className="px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                            style={{
                                background: mode === "setup" ? "var(--v-elevated)" : "transparent",
                                color: mode === "setup" ? "var(--v-text-primary)" : "var(--v-text-muted)",
                            }}
                        >
                            Floor Setup
                        </button>
                        <button
                            onClick={() => setMode("tonight")}
                            className="px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                            style={{
                                background: mode === "tonight" ? "var(--v-elevated)" : "transparent",
                                color: mode === "tonight" ? "var(--v-text-primary)" : "var(--v-text-muted)",
                            }}
                        >
                            Tonight
                        </button>
                    </div>
                    {mode === "setup" && (
                        <VenueActionButton variant="primary" onClick={() => { setEditingTable(null); setShowAddModal(true); }}>
                            <Plus className="w-4 h-4" /> Add Table
                        </VenueActionButton>
                    )}
                </div>
            }
        >
            {mode === "setup" ? (
                <>
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: "TABLES", value: tables.length, icon: Armchair, bg: "var(--v-info-bg)", text: "var(--v-info)" },
                            { label: "CAPACITY", value: totalCapacity, icon: Users, bg: "var(--v-success-bg)", text: "var(--v-success)" },
                            { label: "VVIP", value: vvipCount, icon: Sparkles, bg: "rgba(167,139,250,0.1)", text: "#A78BFA" },
                            { label: "SECTIONS", value: new Set(tables.map(t => t.location)).size, icon: Layers, bg: "var(--v-warning-bg)", text: "var(--v-warning)" },
                        ].map((stat, i) => (
                            <div key={i} className="rounded-2xl p-4 flex items-center gap-3 border border-white/[0.04]" style={{ background: "var(--v-card)" }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: stat.bg }}>
                                    <stat.icon className="w-3.5 h-3.5" style={{ color: stat.text }} />
                                </div>
                                <div>
                                    <p className="v-label text-[9px] mb-0">{stat.label}</p>
                                    <p className="text-[18px] font-black leading-tight tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                        {stat.value}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--v-text-muted)" }} />
                        <input
                            type="text"
                            placeholder="Search tables..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] font-medium transition-all outline-none"
                            style={{ background: "var(--v-elevated)", color: "var(--v-text-primary)", border: "1px solid var(--v-border)" }}
                        />
                    </div>

                    {/* Table grid */}
                    {filteredTables.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {filteredTables.map((table) => (
                                <TableCard
                                    key={table.id}
                                    table={table}
                                    onEdit={() => { setEditingTable(table); setShowAddModal(true); }}
                                    onDelete={() => handleDeleteTable(table.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <BentoCard
                            empty
                            emptyIcon={<Armchair className="w-8 h-8" />}
                            emptyTitle="No tables mapped. Start building your floor plan."
                            emptyAction={
                                <VenueActionButton variant="primary" onClick={() => { setEditingTable(null); setShowAddModal(true); }}>
                                    <Plus className="w-3.5 h-3.5" /> Add First Table
                                </VenueActionButton>
                            }
                        >{null}</BentoCard>
                    )}
                </>
            ) : (
                /* Tonight's Ops mode */
                <>
                    {/* Tonight header */}
                    <div className="rounded-2xl p-5" style={{ background: "var(--v-hero)", border: "1px solid var(--v-border)" }}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <span className="v-label text-[9px]">TONIGHT&apos;S PRODUCTION</span>
                                <h2 className="text-xl font-black mt-1" style={{ color: "var(--v-text-primary)" }}>
                                    {tonightEvent?.name || "No Live Event"}
                                </h2>
                                <p className="text-[12px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                                    {tonightEvent?.start_date ? new Date(tonightEvent.start_date).toDateString() : 'N/A'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="px-4 py-3 rounded-xl" style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}>
                                    <p className="v-label text-[9px] mb-0.5">BOOKED</p>
                                    <p className="text-xl font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                        {eventTableStatus?.bookings?.length || 0}
                                    </p>
                                </div>
                                <div className="px-4 py-3 rounded-xl" style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}>
                                    <p className="v-label text-[9px] mb-0.5">AVAILABLE</p>
                                    <p className="text-xl font-black tabular-nums" style={{ color: "var(--v-success)" }}>
                                        {tables.length - (eventTableStatus?.bookings?.length || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tonight table rows */}
                    <BentoCard padding="sm" header={<span className="v-label">FLOOR STATUS</span>}>
                        <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
                            {tables.map(table => {
                                const booking = eventTableStatus?.bookings?.find((b: any) => b.tableId === table.id);
                                const isBlocked = eventTableStatus?.blockedTables?.includes(table.id);
                                const type = TABLE_TYPES.find(t => t.id === table.type) || TABLE_TYPES[0];

                                return (
                                    <div key={table.id} className="px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                                                style={{
                                                    background: isBlocked ? "var(--v-warning-bg)" : booking ? "var(--v-success-bg)" : "var(--v-elevated)",
                                                    color: isBlocked ? "var(--v-warning)" : booking ? "var(--v-success)" : "var(--v-text-muted)",
                                                }}
                                            >
                                                <type.icon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h3 className="text-[14px] font-bold" style={{ color: "var(--v-text-primary)" }}>{table.name}</h3>
                                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                                                    {table.location} · {table.capacity} Pax
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {booking ? (
                                                <>
                                                    <div className="text-right">
                                                        <p className="text-[12px] font-bold" style={{ color: "var(--v-text-primary)" }}>{booking.guestName || "Reserved"}</p>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--v-success)" }}>Confirmed</p>
                                                    </div>
                                                    <button onClick={() => updateStatus(table.id, 'available')} className="p-2 rounded-lg transition-colors" style={{ color: "var(--v-text-muted)", background: "var(--v-elevated)" }}>
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            ) : isBlocked ? (
                                                <>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--v-warning)" }}>Held</span>
                                                    <button onClick={() => updateStatus(table.id, 'available')} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest" style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)" }}>
                                                        Release
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => updateStatus(table.id, 'blocked')}
                                                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                                                        style={{ background: "var(--v-elevated)", color: "var(--v-text-muted)", border: "1px solid var(--v-border)" }}
                                                    >
                                                        Hold
                                                    </button>
                                                    <button
                                                        onClick={() => updateStatus(table.id, 'reserved', 'Manual Reservation')}
                                                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                                                        style={{ background: "var(--v-success-bg)", color: "var(--v-success)", border: "1px solid rgba(52,211,153,0.2)" }}
                                                    >
                                                        Reserve
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </BentoCard>
                </>
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
        </VenuePageShell>
    );
}

/* ── Table Card (Setup Mode) ── */
function TableCard({ table, onEdit, onDelete }: any) {
    const type = TABLE_TYPES.find(t => t.id === table.type) || TABLE_TYPES[0];
    const Icon = type.icon;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group rounded-2xl overflow-hidden transition-all duration-300 hover:brightness-110"
            style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
        >
            {/* Header strip */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--v-border)" }}>
                <div className="flex items-center gap-2.5">
                    <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ background: "var(--v-elevated)" }}
                    >
                        <Icon className="h-4 w-4" style={{ color: type.color }} />
                    </div>
                    <div>
                        <p className="text-[14px] font-bold leading-tight" style={{ color: "var(--v-text-primary)" }}>{table.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--v-text-muted)" }}>
                            <MapPin className="h-2.5 w-2.5" /> {table.location || "Main Floor"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onEdit} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--v-text-muted)" }}>
                        <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={onDelete} className="p-1.5 rounded-lg transition-colors hover:text-red-400" style={{ color: "var(--v-text-muted)" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl" style={{ background: "var(--v-elevated)" }}>
                        <p className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: "var(--v-text-muted)" }}>Min Spend</p>
                        <p className="text-[15px] font-black leading-none tabular-nums" style={{ color: "var(--v-text-primary)" }}>₹{table.minSpend || 0}</p>
                    </div>
                    <div className="p-2.5 rounded-xl" style={{ background: "var(--v-elevated)" }}>
                        <p className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: "var(--v-text-muted)" }}>Seats</p>
                        <p className="text-[15px] font-black leading-none tabular-nums" style={{ color: "var(--v-text-primary)" }}>{table.capacity} Pax</p>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid var(--v-border)" }}>
                    <span
                        className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{
                            background: table.isActive !== false ? "var(--v-success-bg)" : "var(--v-elevated)",
                            color: table.isActive !== false ? "var(--v-success)" : "var(--v-text-muted)",
                        }}
                    >
                        {table.isActive !== false ? 'Active' : 'Offline'}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                        {type.label}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

/* ── Add / Edit Table Modal ── */
function TableModal({ table, isSaving, onClose, onSave }: any) {
    const [formData, setFormData] = useState(table || {
        name: "",
        type: "standard",
        capacity: 4,
        minSpend: 5000,
        location: "Main Floor",
        isActive: true
    });

    const inputStyle: React.CSSProperties = {
        background: "var(--v-elevated)",
        color: "var(--v-text-primary)",
        border: "1px solid var(--v-border)",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        outline: "none",
        width: "100%",
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                className="relative w-full max-w-lg rounded-[32px] overflow-hidden"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
            >
                {/* Modal header */}
                <div className="p-6 flex items-center justify-between" style={{ borderBottom: "1px solid var(--v-border)" }}>
                    <div>
                        <h2 className="text-[18px] font-bold" style={{ color: "var(--v-text-primary)" }}>
                            {table ? "Edit Table" : "Add New Table"}
                        </h2>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>Configure layout properties</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl transition-colors" style={{ color: "var(--v-text-muted)", background: "var(--v-elevated)" }}>
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Modal body */}
                <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="v-label mb-1.5 block">TABLE NAME / ID</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={inputStyle}
                            placeholder="e.g. V01, VIP-4"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="v-label mb-1.5 block">TYPE</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                style={{ ...inputStyle, cursor: "pointer" }}
                            >
                                {TABLE_TYPES.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="v-label mb-1.5 block">LOCATION</label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                style={inputStyle}
                                placeholder="Main Floor"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="v-label mb-1.5 block">CAPACITY (PAX)</label>
                            <div className="relative">
                                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--v-text-muted)" }} />
                                <input
                                    type="number"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                    style={{ ...inputStyle, paddingLeft: 36 }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="v-label mb-1.5 block">MIN SPEND (₹)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--v-text-muted)" }} />
                                <input
                                    type="number"
                                    value={formData.minSpend}
                                    onChange={(e) => setFormData({ ...formData, minSpend: e.target.value })}
                                    style={{ ...inputStyle, paddingLeft: 36 }}
                                />
                            </div>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                            className="w-11 h-6 rounded-full relative transition-all flex-shrink-0"
                            style={{ background: formData.isActive ? "var(--v-orange)" : "var(--v-elevated)" }}
                        >
                            <div
                                className="absolute top-1 w-4 h-4 rounded-full shadow-md transition-all"
                                style={{ background: "rgba(255,255,255,0.9)", left: formData.isActive ? "calc(100% - 20px)" : "4px" }}
                            />
                        </button>
                        <span className="text-[12px] font-semibold" style={{ color: "var(--v-text-secondary)" }}>Active in Discovery</span>
                    </label>
                </div>

                {/* Modal footer */}
                <div className="p-6 flex items-center justify-end gap-3" style={{ borderTop: "1px solid var(--v-border)", background: "var(--v-hero)" }}>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                        style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)" }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(formData)}
                        disabled={isSaving || !formData.name}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ background: "var(--v-orange)", color: "#fff" }}
                    >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {table ? "Update" : "Create"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
