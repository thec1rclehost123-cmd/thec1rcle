"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Camera,
    Save,
    MapPin,
    Globe,
    Instagram,
    Twitter,
    CalendarDays,
    Ticket,
    Building2,
    Link2,
    Handshake,
    Megaphone,
    Loader2,
    Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";
import ImageCropModal from "@/components/ui/ImageCropModal";
import { cn } from "@/lib/utils";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

const inputStyle: React.CSSProperties = {
    background: "var(--surface-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    width: "100%",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
};

const FormGroup = ({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) => (
    <div className="space-y-2">
        <label className="text-[12px] font-bold uppercase tracking-wider text-text-secondary ml-0.5 block">
            {label}
        </label>
        {children}
        {description && (
            <p className="text-[11px] text-text-tertiary leading-normal px-0.5">{description}</p>
        )}
    </div>
);

const StatPill = ({
    icon: Icon,
    value,
    label,
    color,
    loading,
}: {
    icon: any;
    value: string | number;
    label: string;
    color: string;
    loading?: boolean;
}) => (
    <div className="flex flex-col items-center gap-2 px-6 py-5 rounded-[2rem] bg-surface-secondary/50 border border-border-subtle hover:bg-surface-secondary/80 hover:border-border-default transition-all group">
        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300", color)}>
            <Icon size={18} />
        </div>
        {loading ? (
            <div className="h-7 w-12 bg-surface-tertiary rounded-lg animate-pulse" />
        ) : (
            <span className="text-2xl font-black tabular-nums text-text-primary">{value}</span>
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{label}</span>
    </div>
);

interface Form {
    displayName: string;
    tagline: string;
    venueType: string;
    city: string;
    website: string;
    instagram: string;
    twitter: string;
}

interface Stats {
    eventsHosted: number;
    ticketsSold: number;
    hostsConnected: number;
    promotersConnected: number;
}

export default function VenueProfileClient({
    setActions,
}: {
    setActions: (actions: React.ReactNode) => void;
}) {
    const { success: toastSuccess, error: toastError } = useToast();
    const { user, profile } = useDashboardAuth();

    const venueId = profile?.activeMembership?.partnerId ?? null;
    const partnerName = profile?.activeMembership?.partnerName ?? profile?.displayName ?? "";

    const [pageLoading, setPageLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
    const [backdropPreview, setBackdropPreview] = useState<string | null>(null);
    const [backdropUploading, setBackdropUploading] = useState(false);
    const [cropModal, setCropModal] = useState<{ src: string; aspect: number; type: "logo" | "cover" } | null>(null);
    const [isHeroEditing, setIsHeroEditing] = useState(false);
    const [statsLoading, setStatsLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({ eventsHosted: 0, ticketsSold: 0, hostsConnected: 0, promotersConnected: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const backdropFileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState<Form>({
        displayName: partnerName,
        tagline: "",
        venueType: "",
        city: "",
        website: "",
        instagram: "",
        twitter: "",
    });

    // ── Load existing venue profile data ──────────────────────────────────────
    useEffect(() => {
        if (!user || !venueId) return;

        const load = async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/partners/venues/profile?venueId=${venueId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const json = await res.json();
                const v = json.profile;
                if (!v) return;

                setPhotoUrl(v.photoURL || null);
                setBackdropUrl(v.backdropURL || null);
                setForm({
                    displayName: v.displayName || partnerName,
                    tagline:     v.bio || "",
                    venueType:   v.venueType || "",
                    city:        v.city || "",
                    website:     v.website || "",
                    instagram:   v.socialLinks?.instagram || "",
                    twitter:     v.socialLinks?.twitter || "",
                });
            } catch {
                // Non-blocking — form stays with partnerName default
            } finally {
                setPageLoading(false);
            }
        };

        load();
    }, [user, venueId]);

    // Keep displayName seeded from auth if page fetch hasn't set it yet
    useEffect(() => {
        if (partnerName && !form.displayName) {
            setForm((prev) => ({ ...prev, displayName: partnerName }));
        }
    }, [partnerName]);

    // ── Fetch real stats ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!user || !venueId) return;

        const fetchStats = async () => {
            setStatsLoading(true);
            try {
                const token = await user.getIdToken();
                const headers = { Authorization: `Bearer ${token}` };

                const [eventsRes, connectionsRes, summaryRes] = await Promise.allSettled([
                    fetch(`/api/partners/venues/events?venueId=${venueId}&limit=200&status=all`, { headers }),
                    fetch(`/api/discovery?action=list&partnerId=${venueId}&role=venue`, { headers }),
                    fetch(`/api/partners/venues/overview/summary?venueId=${venueId}`, { headers }),
                ]);

                const eventsData     = eventsRes.status === "fulfilled"      && eventsRes.value.ok      ? await eventsRes.value.json()      : null;
                const connectionsData = connectionsRes.status === "fulfilled" && connectionsRes.value.ok ? await connectionsRes.value.json() : null;
                const summaryData    = summaryRes.status === "fulfilled"      && summaryRes.value.ok     ? await summaryRes.value.json()     : null;

                const active: any[] = (connectionsData?.connections ?? []).filter(
                    (c: any) => c.status === "approved" || c.status === "active"
                );

                const computed = {
                    eventsHosted:      Array.isArray(eventsData?.events) ? eventsData.events.length : 0,
                    ticketsSold:       summaryData?.totalGuestProfiles ?? 0,
                    hostsConnected:    active.filter((c) => c.otherType === "host").length,
                    promotersConnected: active.filter((c) => c.otherType === "promoter").length,
                };
                setStats(computed);

                // Write computed stats back to venue doc so discovery API can read real values
                user.getIdToken().then((token) =>
                    fetch("/api/partners/venues/profile", {
                        method: "PATCH",
                        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            venueId,
                            updates: {
                                eventsCount:       computed.eventsHosted,
                                hostsConnected:    computed.hostsConnected,
                                promotersConnected: computed.promotersConnected,
                                ticketsSold:       computed.ticketsSold,
                            },
                        }),
                    })
                ).catch(() => {}); // fire-and-forget
            } catch {
                // Stats stay at 0
            } finally {
                setStatsLoading(false);
            }
        };

        fetchStats();
    }, [user, venueId]);

    // ── Open crop modal on file select ───────────────────────────────────────
    const openCropModal = (file: File, type: "logo" | "cover") => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            setCropModal({ src: ev.target?.result as string, aspect: type === "logo" ? 1 : 21 / 9, type });
        };
        reader.readAsDataURL(file);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        openCropModal(file, "logo");
        e.target.value = "";
    };

    const handleBackdropChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        openCropModal(file, "cover");
        e.target.value = "";
    };



    // ── Upload after crop confirmed ───────────────────────────────────────────
    const handleCropConfirm = async (dataUrl: string) => {
        if (!cropModal || !user || !venueId) return;
        const { type } = cropModal;
        setCropModal(null);

        const isLogo = type === "logo";
        if (isLogo) {
            setPhotoPreview(dataUrl);
        } else {
            setBackdropPreview(dataUrl);
        }

        // Convert data URL → File for FormData
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `${type}_${Date.now()}.jpg`, { type: "image/jpeg" });

        if (isLogo) setPhotoUploading(true);
        else setBackdropUploading(true);

        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append("file", file);
            formData.append("venueId", venueId);
            formData.append("type", type);

            const res = await fetch("/api/partners/venues/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");

            if (isLogo) setPhotoUrl(data.url);
            else setBackdropUrl(data.url);
            setHasChanges(true);
        } catch (err: any) {
            toastError("Upload failed", err.message || "Could not upload photo.");
            if (isLogo) setPhotoPreview(null);
            else setBackdropPreview(null);
        } finally {
            if (isLogo) setPhotoUploading(false);
            else setBackdropUploading(false);
        }
    };

    const handleFieldChange = (field: keyof Form, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    // ── Save all profile fields ───────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!user || !venueId) return;
        setIsSaving(true);
        try {
            const token = await user.getIdToken();
            const updates: Record<string, any> = {
                displayName: form.displayName,
                name:        form.displayName,
                bio:         form.tagline,
                venueType:   form.venueType,
                city:        form.city,
                website:     form.website,
                socialLinks: {
                    instagram: form.instagram,
                    twitter:   form.twitter,
                },
            };
            if (photoUrl) updates.photoURL = photoUrl;
            if (backdropUrl) {
                updates.backdropURL = backdropUrl;
                updates.coverURL = backdropUrl;   // Presence tab reads coverURL
            }

            const res = await fetch("/api/partners/venues/profile", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ venueId, updates }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Save failed");

            setHasChanges(false);
            toastSuccess("Profile updated", "Your venue profile has been saved.");
        } catch (err: any) {
            toastError("Save failed", err.message || "Could not save profile.");
        } finally {
            setIsSaving(false);
        }
    }, [user, venueId, form, photoUrl, backdropUrl, toastSuccess, toastError]);

    useEffect(() => {
        if (hasChanges || isSaving) {
            setActions(
                <VenueActionButton variant="primary" onClick={handleSave} disabled={isSaving || photoUploading || backdropUploading}>
                    {isSaving ? "Saving..." : <><Save className="w-4 h-4" /> Save Profile</>}
                </VenueActionButton>
            );
        } else {
            setActions(null);
        }
    }, [hasChanges, isSaving, photoUploading, handleSave, setActions]);

    const statItems = [
        { icon: CalendarDays, value: stats.eventsHosted,       label: "Events Hosted",       color: "bg-indigo-500/10 text-indigo-400" },
        { icon: Ticket,       value: stats.ticketsSold,        label: "Tickets Sold",        color: "bg-emerald-500/10 text-emerald-400" },
        { icon: Handshake,    value: stats.hostsConnected,     label: "Hosts Connected",     color: "bg-amber-500/10 text-amber-400" },
        { icon: Megaphone,    value: stats.promotersConnected, label: "Promoters Connected", color: "bg-orange-500/10 text-orange-400" },
    ];

    const displayPhoto = photoPreview || photoUrl;
    const displayBackdrop = backdropPreview || backdropUrl;

    if (pageLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── Profile Hero — same layout as Presence tab ── */}
            <div
                className="overflow-hidden shadow-2xl"
                style={{ borderRadius: "var(--v-r-xl)", background: "var(--v-card)", border: "1px solid var(--border-default)" }}
            >
                {/* Hero image */}
                <section className="relative w-full group">
                    <div className="relative aspect-[3/4] sm:aspect-[4/5] md:aspect-[16/10] lg:aspect-[21/9] w-full overflow-hidden">
                        {displayBackdrop ? (
                            <img src={displayBackdrop} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, var(--surface-tertiary) 0%, var(--surface-elevated) 50%, var(--surface-secondary) 100%)" }} />
                        )}

                        {/* Presence-identical gradients */}
                        <div className="absolute inset-0 opacity-90" style={{ background: "linear-gradient(to top, var(--surface-base) 0%, transparent 100%)" }} />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

                        {/* Upload spinners (non-blocking overlay) */}
                        {(backdropUploading || photoUploading) && (
                            <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
                                <Loader2 size={12} className="text-white animate-spin" />
                                <span className="text-[11px] font-semibold text-white">Uploading…</span>
                            </div>
                        )}

                        {/* Edit Hero & Visuals — appears on hover, exactly like Presence */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button
                                onClick={() => setIsHeroEditing(true)}
                                className="bg-surface-elevated/20 backdrop-blur-md border border-white/30 px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-surface-elevated/30 transition-all font-bold text-white shadow-xl"
                            >
                                <Camera className="w-5 h-5" />
                                Edit Hero &amp; Visuals
                            </button>
                        </div>

                        {/* Bottom content — logo + name, identical to Presence */}
                        <div className="absolute bottom-0 left-0 right-0 z-10 px-6 sm:px-10 pb-6 sm:pb-8">
                            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
                                {/* Logo */}
                                <div
                                    className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-surface-elevated/10 backdrop-blur-xl"
                                    style={{ border: "4px solid var(--surface-base)" }}
                                >
                                    {displayPhoto ? (
                                        <img src={displayPhoto} className="w-full h-full object-cover" alt="logo" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Building2 className="w-8 h-8 text-white/20" />
                                        </div>
                                    )}
                                </div>

                                {/* Name & meta */}
                                <div className="flex-1 min-w-0">
                                    {form.venueType && (
                                        <span className="px-3 py-1 mb-2 inline-block bg-black/20 backdrop-blur-xl border border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-white/80">
                                            {form.venueType}
                                        </span>
                                    )}
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tighter text-white leading-[0.9] drop-shadow-lg">
                                        {form.displayName || "Your Venue"}
                                    </h1>
                                    {form.city && (
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <MapPin size={12} className="text-white/60" />
                                            <span className="text-[12px] font-semibold text-white/60">{form.city}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Stats strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    {statItems.map((s) => (
                        <StatPill key={s.label} {...s} loading={statsLoading} />
                    ))}
                </div>
            </div>

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <input ref={backdropFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackdropChange} />

            {/* ── Hero edit picker ── */}
            <AnimatePresence>
                {isHeroEditing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-40 flex items-end justify-center p-4 pb-8"
                        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
                        onClick={(e) => e.target === e.currentTarget && setIsHeroEditing(false)}
                    >
                        <motion.div
                            initial={{ y: 32, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 32, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-sm"
                            style={{ background: "var(--v-card)", border: "1px solid var(--border-default)", borderRadius: "var(--v-r-xl)", boxShadow: "var(--v-shadow-hero)" }}
                        >
                            <div className="px-6 pt-5 pb-2">
                                <h3 className="text-[15px] font-bold text-text-primary">Edit Hero &amp; Visuals</h3>
                                <p className="text-[12px] text-text-tertiary mt-0.5">Choose what you want to update</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 p-4">
                                <button
                                    onClick={() => { setIsHeroEditing(false); backdropFileInputRef.current?.click(); }}
                                    className="flex flex-col items-center gap-3 p-5 rounded-xl transition-colors"
                                    style={{ border: "1px solid var(--border-default)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-tertiary)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-tertiary)" }}>
                                        <ImageIcon size={18} className="text-text-secondary" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[13px] font-semibold text-text-primary">Cover Photo</p>
                                        <p className="text-[11px] text-text-tertiary mt-0.5">Hero background</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setIsHeroEditing(false); fileInputRef.current?.click(); }}
                                    className="flex flex-col items-center gap-3 p-5 rounded-xl transition-colors"
                                    style={{ border: "1px solid var(--border-default)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-tertiary)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-tertiary)" }}>
                                        <Building2 size={18} className="text-text-secondary" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[13px] font-semibold text-text-primary">Profile Logo</p>
                                        <p className="text-[11px] text-text-tertiary mt-0.5">Venue logo / avatar</p>
                                    </div>
                                </button>
                            </div>
                            <div className="px-4 pb-4">
                                <button
                                    onClick={() => setIsHeroEditing(false)}
                                    className="w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                                    style={{ color: "var(--text-tertiary)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-tertiary)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Edit Form ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-12 xl:col-span-10 xl:col-start-2">
                    <BentoCard padding="lg" className="shadow-2xl border-border-default">
                        <div className="space-y-10">
                            {/* Identity */}
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="p-2.5 rounded-xl bg-surface-tertiary border border-border-default shadow-sm">
                                        <Building2 size={20} className="text-text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary leading-tight">Venue Identity</h3>
                                        <p className="text-sm text-text-tertiary mt-0.5">Public-facing info shown to guests and partners</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <FormGroup label="Display Name" description="Shown on event pages and tickets">
                                        <input
                                            type="text"
                                            value={form.displayName}
                                            style={inputStyle}
                                            onChange={(e) => handleFieldChange("displayName", e.target.value)}
                                            className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10"
                                        />
                                    </FormGroup>

                                    <FormGroup label="Venue Type" description="Best describes your establishment">
                                        <select
                                            value={form.venueType}
                                            style={inputStyle}
                                            onChange={(e) => handleFieldChange("venueType", e.target.value)}
                                            className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 appearance-none"
                                        >
                                            <option value="">Select venue type</option>
                                            <option>Nightclub & Live Music</option>
                                            <option>Lounge & Bar</option>
                                            <option>Festival Ground</option>
                                            <option>Rooftop</option>
                                            <option>Club</option>
                                            <option>Concert Hall</option>
                                            <option>Outdoor Amphitheatre</option>
                                        </select>
                                    </FormGroup>

                                    <FormGroup label="City / Location" description="Primary city displayed on your profile">
                                        <input
                                            type="text"
                                            value={form.city}
                                            placeholder="e.g. Pune, Maharashtra"
                                            style={inputStyle}
                                            onChange={(e) => handleFieldChange("city", e.target.value)}
                                            className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10"
                                        />
                                    </FormGroup>

                                    <FormGroup label="Website" description="Your official website URL">
                                        <div className="relative">
                                            <Globe size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
                                            <input
                                                type="text"
                                                value={form.website}
                                                placeholder="yourwebsite.com"
                                                style={{ ...inputStyle, paddingLeft: "44px" }}
                                                onChange={(e) => handleFieldChange("website", e.target.value)}
                                                className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10"
                                            />
                                        </div>
                                    </FormGroup>
                                </div>

                                <FormGroup
                                    label="Bio / Tagline"
                                    description="A short description shown on your public profile (max 200 characters)"
                                >
                                    <textarea
                                        value={form.tagline}
                                        placeholder="Describe your venue in a few words…"
                                        rows={3}
                                        maxLength={200}
                                        style={{ ...inputStyle, resize: "none", lineHeight: "1.6" }}
                                        onChange={(e) => handleFieldChange("tagline", e.target.value)}
                                        className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10"
                                    />
                                    <p className="text-[11px] text-text-placeholder text-right -mt-1">
                                        {form.tagline.length} / 200
                                    </p>
                                </FormGroup>
                            </div>

                            <div className="border-t border-border-subtle" />

                            {/* Social Links */}
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="p-2.5 rounded-xl bg-surface-tertiary border border-border-default shadow-sm">
                                        <Link2 size={20} className="text-text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary leading-tight">Social Links</h3>
                                        <p className="text-sm text-text-tertiary mt-0.5">Connect your social presence for guest discovery</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <FormGroup label="Instagram Handle">
                                        <div className="relative">
                                            <Instagram size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
                                            <input
                                                type="text"
                                                value={form.instagram}
                                                placeholder="@yourhandle"
                                                style={{ ...inputStyle, paddingLeft: "44px" }}
                                                onChange={(e) => handleFieldChange("instagram", e.target.value)}
                                                className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10"
                                            />
                                        </div>
                                    </FormGroup>

                                    <FormGroup label="X / Twitter Handle">
                                        <div className="relative">
                                            <Twitter size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
                                            <input
                                                type="text"
                                                value={form.twitter}
                                                placeholder="@yourhandle"
                                                style={{ ...inputStyle, paddingLeft: "44px" }}
                                                onChange={(e) => handleFieldChange("twitter", e.target.value)}
                                                className="focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10"
                                            />
                                        </div>
                                    </FormGroup>
                                </div>
                            </div>
                        </div>
                    </BentoCard>
                </div>
            </div>

            {/* ── Crop Modal ── */}
            <AnimatePresence>
                {cropModal && (
                    <ImageCropModal
                        imageSrc={cropModal.src}
                        aspect={cropModal.aspect}
                        title={cropModal.type === "logo" ? "Adjust Profile Photo" : "Adjust Cover Photo"}
                        onConfirm={handleCropConfirm}
                        onCancel={() => setCropModal(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
