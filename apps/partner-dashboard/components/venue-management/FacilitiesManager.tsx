"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Loader2, Edit3 } from "lucide-react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

const FACILITY_ICONS = [
    { id: "car", label: "Parking", emoji: "🅿️" },
    { id: "key", label: "Valet", emoji: "🔑" },
    { id: "sun", label: "Rooftop", emoji: "☀️" },
    { id: "cigarette", label: "Smoking", emoji: "🚬" },
    { id: "music", label: "Dance Floor", emoji: "💃" },
    { id: "wine", label: "Bar", emoji: "🍷" },
    { id: "accessibility", label: "Wheelchair", emoji: "♿" },
    { id: "star", label: "VIP", emoji: "⭐" },
    { id: "tree", label: "Outdoor", emoji: "🌳" },
    { id: "mic", label: "Live Music", emoji: "🎤" },
    { id: "wifi", label: "WiFi", emoji: "📶" },
    { id: "food", label: "Food", emoji: "🍽️" },
];

interface Facility {
    id: string;
    name: string;
    icon: string;
    isEnabled: boolean;
    order: number;
}

interface FacilitiesManagerProps {
    venueId: string;
    facilities: Facility[];
    onRefresh: () => void;
}

export default function FacilitiesManager({ venueId, facilities, onRefresh }: FacilitiesManagerProps) {
    const { user } = useDashboardAuth();
    const { success: toastSuccess } = useToast();
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newIcon, setNewIcon] = useState("star");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const getEmoji = (iconId: string) => FACILITY_ICONS.find(i => i.id === iconId)?.emoji || "⭐";

    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        const token = await user.getIdToken();
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
    }, [user]);

    const apiCall = async (action: string, data: any, successMsg?: string) => {
        if (!user) return;
        try {
            await authedFetch("/api/venue/facilities", {
                method: "POST",
                body: JSON.stringify({ venueId, action, data })
            });
            if (successMsg) toastSuccess(successMsg, "Live profile updated.");
            onRefresh();
        } catch (err) {
            console.error("Facility API error:", err);
        }
    };

    const handleAddFacility = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        await apiCall("add", { name: newName.trim(), icon: newIcon }, "Facility added");
        setNewName("");
        setNewIcon("star");
        setIsAdding(false);
        setSaving(false);
    };

    const handleToggle = (id: string, isEnabled: boolean) => apiCall("toggle", { facilityId: id, isEnabled }, isEnabled ? "Facility visible" : "Facility hidden");
    const handleUpdate = (id: string, updates: any) => { apiCall("update", { facilityId: id, updates }, "Facility updated"); setEditingId(null); };
    const handleDelete = (id: string) => window.confirm("Remove?") && apiCall("delete", { facilityId: id }, "Facility removed");
    const handleReorder = (newOrder: Facility[]) => apiCall("reorder", { orderedIds: newOrder.map(f => f.id) }, "Layout saved");

    const enabledCount = facilities.filter(f => f.isEnabled).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Venue Facilities</h3>
                    <p className="text-sm text-[var(--text-tertiary)]">Show guests what amenities your venue offers</p>
                </div>
                <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-[var(--text-primary)] rounded-xl text-sm font-medium">
                    <Plus className="w-4 h-4" /> Add Custom
                </button>
            </div>

            <AnimatePresence>
                {isAdding && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        <div className="p-4 bg-[var(--bg-fill)] rounded-xl border border-[var(--border-subtle)] space-y-4">
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Facility name" className="w-full px-4 py-2 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg text-sm" />
                            <div className="flex flex-wrap gap-2">
                                {FACILITY_ICONS.map((icon) => (
                                    <button key={icon.id} onClick={() => setNewIcon(icon.id)} className={`p-2 rounded-lg text-xl ${newIcon === icon.id ? "bg-green-500/20 ring-2 ring-emerald-500" : "bg-[var(--bg-base)]"}`}>{icon.emoji}</button>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm">Cancel</button>
                                <button onClick={handleAddFacility} disabled={!newName.trim() || saving} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-[var(--text-primary)] rounded-lg text-sm font-medium disabled:opacity-50">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {facilities.length > 0 ? (
                <Reorder.Group axis="y" values={facilities} onReorder={handleReorder} className="space-y-2">
                    {facilities.map((f) => (
                        <Reorder.Item key={f.id} value={f} className={`flex items-center gap-4 p-4 rounded-xl cursor-grab ${f.isEnabled ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200" : "bg-[var(--bg-fill)] border border-[var(--border-subtle)]"}`}>
                            <GripVertical className="w-5 h-5 text-[var(--text-tertiary)]" />
                            <span className="text-2xl">{getEmoji(f.icon)}</span>
                            {editingId === f.id ? (
                                <input autoFocus defaultValue={f.name} onBlur={(e) => handleUpdate(f.id, { name: e.target.value })} className="flex-1 px-2 py-1 bg-[var(--bg-elevated)] dark:bg-[var(--bg-secondary)] border rounded text-sm" />
                            ) : (
                                <span className={`flex-1 font-medium ${f.isEnabled ? "" : "text-[var(--text-tertiary)]"}`}>{f.name}</span>
                            )}
                            <button onClick={() => setEditingId(editingId === f.id ? null : f.id)} className="p-2"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(f.id)} className="p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={f.isEnabled} onChange={(e) => handleToggle(f.id, e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-elevated)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
                            </label>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            ) : (
                <div className="py-12 text-center bg-[var(--bg-fill)]/30 rounded-2xl border border-dashed">
                    <p className="text-[var(--text-tertiary)]">No facilities configured</p>
                </div>
            )}

            {enabledCount > 0 && (
                <div className="p-4 bg-[var(--bg-fill)]/50 rounded-xl">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase mb-3 font-bold">Preview</p>
                    <div className="flex flex-wrap gap-3">
                        {facilities.filter(f => f.isEnabled).map((f) => (
                            <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-base)] rounded-full text-sm">
                                <span>{getEmoji(f.icon)}</span>
                                <span className="font-medium">{f.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
