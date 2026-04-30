"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import {
    Loader2, Save, X, CheckCircle,
    AlertCircle, Image as ImageIcon, Clock, Users, Phone
} from "lucide-react";

interface BookingConfig {
    enabled: boolean;
    capacity: number;
    timings: string[];
    contact: string;
}

interface PresenceConfig {
    name: string;
    description: string;
    price: string;
    images: string[];
    bookingConfig: BookingConfig;
}

const DEFAULT_CONFIG: PresenceConfig = {
    name: "",
    description: "",
    price: "",
    images: [],
    bookingConfig: {
        enabled: false,
        capacity: 100,
        timings: [],
        contact: ""
    }
};

export default function PresenceConfigEditor() {
    const { profile, user, loading: authLoading } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    const [config, setConfig] = useState<PresenceConfig>(DEFAULT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
    const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
    const [timingInput, setTimingInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        const token = await user.getIdToken(true);
        return fetch(url, {
            ...options,
            headers: {
                ...((options.headers as Record<string, string>) || {}),
                "Authorization": `Bearer ${token}`,
            }
        });
    }, [user]);

    useEffect(() => {
        // Mirror the guard pattern from VenuePageManagement — wait for auth to settle
        if (authLoading || !user) return;

        if (!venueId) {
            setIsLoading(false);
            return;
        }

        const fetchConfig = async () => {
            try {
                console.log("Venue ID:", venueId);
                const res = await authedFetch(`/api/partners/venues/presence?venueId=${venueId}`);
                const json = await res.json();
                console.log("Presence Data:", json.presenceConfig);

                if (json.presenceConfig) {
                    setConfig({
                        ...DEFAULT_CONFIG,
                        ...json.presenceConfig,
                        bookingConfig: {
                            ...DEFAULT_CONFIG.bookingConfig,
                            ...json.presenceConfig.bookingConfig
                        }
                    });
                }
            } catch (err: any) {
                console.error("[PresenceConfigEditor] Fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [venueId, authLoading, user]);

    const handleImageUpload = async (idx: number, file: File) => {
        if (!venueId || !user) return;
        setUploadingIdx(idx);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("venueId", venueId);
            formData.append("type", "presence");

            const token = await user.getIdToken(true);
            const res = await fetch("/api/partners/venues/upload", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Upload failed");

            setConfig(prev => {
                const newImages = [...prev.images];
                newImages[idx] = json.url;
                return { ...prev, images: newImages };
            });
        } catch (err: any) {
            console.error("[PresenceConfigEditor] Upload error:", err);
            setError(err.message);
        } finally {
            setUploadingIdx(null);
        }
    };

    const handleRemoveImage = (idx: number) => {
        setConfig(prev => {
            const newImages = [...prev.images];
            newImages.splice(idx, 1);
            return { ...prev, images: newImages };
        });
    };

    const handleAddTiming = () => {
        if (!timingInput.trim()) return;
        setConfig(prev => ({
            ...prev,
            bookingConfig: {
                ...prev.bookingConfig,
                timings: [...prev.bookingConfig.timings, timingInput.trim()]
            }
        }));
        setTimingInput("");
    };

    const handleRemoveTiming = (idx: number) => {
        setConfig(prev => {
            const newTimings = [...prev.bookingConfig.timings];
            newTimings.splice(idx, 1);
            return { ...prev, bookingConfig: { ...prev.bookingConfig, timings: newTimings } };
        });
    };

    const handleSave = async () => {
        if (!venueId || !user) return;
        setIsSaving(true);
        setSaveStatus("idle");

        try {
            const res = await authedFetch("/api/partners/venues/presence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ venueId, presenceConfig: config })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Save failed");
            }

            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (err: any) {
            console.error("[PresenceConfigEditor] Save error:", err);
            setError(err.message);
            setSaveStatus("error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--c1rcle-orange)" }} />
                <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                    Loading Presence Config...
                </p>
            </div>
        );
    }

    if (!venueId) {
        return (
            <div className="py-16 text-center">
                <p style={{ color: "var(--v-text-tertiary)" }}>Venue not linked. Please reload the page.</p>
            </div>
        );
    }

    const inputStyle = {
        background: "var(--v-elevated)",
        border: "1px solid var(--v-border)",
        borderRadius: 12,
        padding: "9px 14px",
        fontSize: 13,
        outline: "none",
        width: "100%",
        color: "var(--v-text-primary)"
    } as React.CSSProperties;

    const cardStyle = {
        background: "var(--v-card)",
        border: "1px solid var(--v-border)"
    } as React.CSSProperties;

    return (
        <div className="space-y-5 max-w-2xl">
            {/* Error banner */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "var(--v-error-bg)", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <AlertCircle size={16} style={{ color: "var(--v-error)" }} />
                    <p className="text-sm flex-1" style={{ color: "var(--v-error)" }}>{error}</p>
                    <button onClick={() => setError(null)}>
                        <X size={14} style={{ color: "var(--v-error)" }} />
                    </button>
                </div>
            )}

            {/* A. BASIC INFO */}
            <div className="p-5 rounded-2xl space-y-4" style={cardStyle}>
                <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                    Basic Info
                </h3>

                <div className="space-y-3">
                    <div>
                        <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--v-text-secondary)" }}>
                            Venue Name
                        </label>
                        <input
                            type="text"
                            value={config.name}
                            onChange={e => setConfig(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Your venue name"
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--v-text-secondary)" }}>
                            Description
                        </label>
                        <textarea
                            value={config.description}
                            onChange={e => setConfig(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe your venue for guests..."
                            rows={3}
                            style={{ ...inputStyle, resize: "vertical" }}
                        />
                    </div>

                    <div>
                        <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--v-text-secondary)" }}>
                            Price Range
                        </label>
                        <input
                            type="text"
                            value={config.price}
                            onChange={e => setConfig(prev => ({ ...prev, price: e.target.value }))}
                            placeholder="e.g. ₹1500 per person or ₹500–₹2000"
                            style={inputStyle}
                        />
                    </div>
                </div>
            </div>

            {/* B. IMAGE GRID (7 photos) */}
            <div className="p-5 rounded-2xl space-y-4" style={cardStyle}>
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                        Image Gallery
                    </h3>
                    <p className="text-xs mt-1" style={{ color: "var(--v-text-tertiary)" }}>
                        Upload up to 7 photos shown publicly on your venue page.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {Array.from({ length: 7 }).map((_, idx) => {
                        const url = config.images[idx];
                        const isUploading = uploadingIdx === idx;

                        return (
                            <div
                                key={idx}
                                className="relative aspect-square rounded-xl overflow-hidden flex items-center justify-center"
                                style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
                            >
                                {url ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt={`Gallery photo ${idx + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => handleRemoveImage(idx)}
                                            className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                                            style={{ background: "rgba(0,0,0,0.7)" }}
                                        >
                                            <X size={11} className="text-white" />
                                        </button>
                                    </>
                                ) : isUploading ? (
                                    <Loader2 size={20} className="animate-spin" style={{ color: "var(--c1rcle-orange)" }} />
                                ) : (
                                    <button
                                        onClick={() => fileInputRefs.current[idx]?.click()}
                                        className="flex flex-col items-center gap-1 transition-opacity opacity-50 hover:opacity-100"
                                    >
                                        <ImageIcon size={18} style={{ color: "var(--v-text-tertiary)" }} />
                                        <span className="text-[10px]" style={{ color: "var(--v-text-tertiary)" }}>{idx + 1}</span>
                                    </button>
                                )}

                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={el => { fileInputRefs.current[idx] = el; }}
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageUpload(idx, file);
                                        e.target.value = "";
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* C. TABLE BOOKING CONFIG */}
            <div className="p-5 rounded-2xl space-y-4" style={cardStyle}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                            Table Booking
                        </h3>
                        <p className="text-xs mt-1" style={{ color: "var(--v-text-tertiary)" }}>
                            Let guests request table bookings from your venue page.
                        </p>
                    </div>
                    {/* Toggle */}
                    <button
                        onClick={() => setConfig(prev => ({
                            ...prev,
                            bookingConfig: { ...prev.bookingConfig, enabled: !prev.bookingConfig.enabled }
                        }))}
                        className="relative flex-shrink-0 w-12 h-6 rounded-full transition-colors"
                        style={{ background: config.bookingConfig.enabled ? "var(--c1rcle-orange)" : "var(--v-elevated)" }}
                        aria-label="Toggle table booking"
                    >
                        <span
                            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                            style={{ transform: config.bookingConfig.enabled ? "translateX(24px)" : "translateX(2px)" }}
                        />
                    </button>
                </div>

                {config.bookingConfig.enabled && (
                    <div className="space-y-3 pt-1">
                        <div>
                            <label className="flex items-center gap-1.5 text-[13px] font-semibold mb-1.5" style={{ color: "var(--v-text-secondary)" }}>
                                <Users size={13} /> Max Capacity
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={config.bookingConfig.capacity}
                                onChange={e => setConfig(prev => ({
                                    ...prev,
                                    bookingConfig: { ...prev.bookingConfig, capacity: parseInt(e.target.value) || 0 }
                                }))}
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-[13px] font-semibold mb-1.5" style={{ color: "var(--v-text-secondary)" }}>
                                <Clock size={13} /> Available Timings
                            </label>
                            {config.bookingConfig.timings.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {config.bookingConfig.timings.map((t, i) => (
                                        <span
                                            key={i}
                                            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                                            style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)", border: "1px solid var(--v-border)" }}
                                        >
                                            {t}
                                            <button onClick={() => handleRemoveTiming(i)} className="flex items-center">
                                                <X size={11} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={timingInput}
                                    onChange={e => setTimingInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddTiming(); } }}
                                    placeholder="e.g. 7PM–10PM"
                                    style={{ ...inputStyle, flex: 1, width: "auto" }}
                                />
                                <button
                                    onClick={handleAddTiming}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                                    style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-primary)" }}
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-[13px] font-semibold mb-1.5" style={{ color: "var(--v-text-secondary)" }}>
                                <Phone size={13} /> Contact Info
                            </label>
                            <input
                                type="text"
                                value={config.bookingConfig.contact}
                                onChange={e => setConfig(prev => ({
                                    ...prev,
                                    bookingConfig: { ...prev.bookingConfig, contact: e.target.value }
                                }))}
                                placeholder="Phone or email for bookings"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* D. SAVE */}
            <div className="flex items-center gap-4 pb-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                        background: "var(--c1rcle-orange)",
                        color: "white",
                        opacity: isSaving ? 0.7 : 1
                    }}
                >
                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {isSaving ? "Saving..." : "Save Changes"}
                </button>

                {saveStatus === "saved" && (
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--v-success)" }}>
                        <CheckCircle size={15} />
                        Saved successfully
                    </div>
                )}
                {saveStatus === "error" && (
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--v-error)" }}>
                        <AlertCircle size={15} />
                        Failed to save
                    </div>
                )}
            </div>
        </div>
    );
}
