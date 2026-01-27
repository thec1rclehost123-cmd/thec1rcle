"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Plus,
    GripVertical,
    Trash2,
    Save,
    Sparkles,
    Eye,
    EyeOff,
    Settings,
    TrendingUp,
    Users,
    Wine,
    Plane,
    Calendar,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function ExploreCMS() {
    const { user } = useAuth();
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalConfig, setModalConfig] = useState(null);

    const fetchConfig = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=app_config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            const layout = json.data?.find(d => d.id === 'explore_layout');

            if (layout && layout.sections) {
                setSections(layout.sections.sort((a, b) => (a.order || 0) - (b.order || 0)));
            } else {
                // Initial default sections
                setSections([
                    { id: "for-you", title: "For You", icon: "sparkles", type: "horizontal", filterType: "trending", limit: 8, enabled: true, order: 0 },
                    { id: "similar", title: "Similar to you", icon: "people", type: "horizontal", filterType: "social_proof", limit: 8, enabled: true, order: 1 },
                    { id: "parties", title: "Parties & Clubs", icon: "wine", type: "horizontal", filterType: "category", filterValue: ["party", "club", "night"], limit: 8, enabled: true, order: 2 },
                    { id: "all", title: "All Events", icon: "planet", type: "horizontal", filterType: "all", limit: 50, enabled: true, order: 3 }
                ]);
            }
        } catch (err) {
            console.error("Failed to fetch explore layout", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchConfig();
    }, [user]);

    const handleSave = async (reason) => {
        setSaving(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'DATABASE_CORRECTION',
                    targetId: 'app_config',
                    reason,
                    params: {
                        id: 'explore_layout',
                        after: { sections: sections.map((s, i) => ({ ...s, order: i })) }
                    }
                })
            });

            if (!res.ok) throw new Error("Save failed");
            alert("Explore layout updated successfully.");
            setModalConfig(null);
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const addSection = () => {
        const newId = `section_${Date.now()}`;
        setSections([...sections, {
            id: newId,
            title: "New Section",
            icon: "sparkles",
            type: "horizontal",
            filterType: "all",
            limit: 8,
            enabled: true,
            order: sections.length
        }]);
    };

    const removeSection = (id) => {
        setSections(sections.filter(s => s.id !== id));
    };

    const updateSection = (id, updates) => {
        setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const moveSection = (index, direction) => {
        const newSections = [...sections];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newSections.length) return;

        [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
        setSections(newSections);
    };

    if (loading) return (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
            <div className="h-8 w-8 border-2 border-iris border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Loading Orchestrator...</p>
        </div>
    );

    return (
        <div className="space-y-12 pb-24">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-iris" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">CMS / Layout Orchestration</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Explore Page CMS</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Design the member experience. Reorder sections, update logic, and curate the discovery feed.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={addSection}
                        className="h-10 px-4 rounded-xl bg-white/5 border border-white/5 text-[11px] font-bold uppercase tracking-widest text-zinc-300 hover:bg-white/10 transition-all flex items-center gap-2"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Section
                    </button>
                    <button
                        onClick={() => setModalConfig({
                            title: "Publish Layout Changes",
                            message: "This will immediately update the Explore page for all mobile users. This action is logged and immutable.",
                            label: "Publish Changes"
                        })}
                        className="h-10 px-6 rounded-xl bg-iris text-white text-[11px] font-bold uppercase tracking-widest hover:bg-iris/90 transition-all flex items-center gap-2 shadow-lg shadow-iris/20"
                    >
                        <Save className="h-3.5 w-3.5" />
                        Publish Layout
                    </button>
                </div>
            </header>

            <div className="space-y-4">
                {sections.map((section, index) => (
                    <div key={section.id} className={`p-6 rounded-2xl bg-obsidian-surface border ${section.enabled ? 'border-[#ffffff08]' : 'border-dashed border-[#ffffff15] opacity-60'} transition-all group relative`}>
                        <div className="flex items-start gap-6">
                            <div className="flex flex-col items-center gap-2 py-2">
                                <GripVertical className="h-5 w-5 text-zinc-700 group-hover:text-zinc-500 cursor-grab active:cursor-grabbing" />
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => moveSection(index, -1)} disabled={index === 0} className="p-1 hover:bg-white/5 rounded-md disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
                                    <button onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1} className="p-1 hover:bg-white/5 rounded-md disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
                                </div>
                            </div>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8">
                                <div className="md:col-span-4 space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Section Title</label>
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                            className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-iris/50 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Icon Key</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={section.icon}
                                                    onChange={(e) => updateSection(section.id, { icon: e.target.value })}
                                                    className="w-full bg-black/20 border border-white/5 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none"
                                                />
                                                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Item Limit</label>
                                            <input
                                                type="number"
                                                value={section.limit}
                                                onChange={(e) => updateSection(section.id, { limit: parseInt(e.target.value) })}
                                                className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-5 space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Discovery Logic</label>
                                        <select
                                            value={section.filterType}
                                            onChange={(e) => updateSection(section.id, { filterType: e.target.value })}
                                            className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="trending">Trending (Heat Score)</option>
                                            <option value="social_proof">High RSVPs (Social Proof)</option>
                                            <option value="category">Category Match</option>
                                            <option value="tonight">Tonight Only</option>
                                            <option value="all">Unfiltered (All Events)</option>
                                        </select>
                                    </div>

                                    {section.filterType === 'category' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Category Tags (comma separated)</label>
                                            <input
                                                type="text"
                                                value={Array.isArray(section.filterValue) ? section.filterValue.join(", ") : (section.filterValue || "")}
                                                onChange={(e) => updateSection(section.id, { filterValue: e.target.value.split(",").map(v => v.trim()) })}
                                                placeholder="party, club, night"
                                                className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                                            />
                                        </div>
                                    )}

                                    {(section.filterType === 'trending' || section.filterType === 'social_proof') && (
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Threshold Value</label>
                                            <input
                                                type="number"
                                                value={section.filterValue || (section.filterType === 'trending' ? 30 : 5)}
                                                onChange={(e) => updateSection(section.id, { filterValue: parseInt(e.target.value) })}
                                                className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-3 flex flex-col justify-between items-end">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateSection(section.id, { enabled: !section.enabled })}
                                            className={`p-2 rounded-lg border border-white/5 transition-all ${section.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}
                                            title={section.enabled ? "Enabled" : "Disabled"}
                                        >
                                            {section.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        </button>
                                        <button
                                            onClick={() => removeSection(section.id)}
                                            className="p-2 rounded-lg border border-white/5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                                            title="Delete Section"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 italic">
                                        Ref: {section.id.split("_")[0]}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {sections.length === 0 && (
                <div className="py-24 text-center border-2 border-dashed border-[#ffffff08] rounded-3xl">
                    <LayoutDashboard className="h-10 w-10 text-zinc-800 mx-auto mb-4" strokeWidth={1} />
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-600">No layout sections defined.</p>
                </div>
            )}

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={confirmAction => handleSave(confirmAction)}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    actionLabel={modalConfig.label}
                    type="danger"
                    isTier3={false}
                />
            )}
        </div>
    );
}
