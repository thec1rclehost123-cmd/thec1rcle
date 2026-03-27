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
    Edit3,
    Link2,
    Handshake,
    Megaphone,
    Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";
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
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);   // saved URL from storage
    const [photoPreview, setPhotoPreview] = useState<string | null>(null); // local blob preview
    const [isPhotoHovered, setIsPhotoHovered] = useState(false);
    const [statsLoading, setStatsLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({ eventsHosted: 0, ticketsSold: 0, hostsConnected: 0, promotersConnected: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);

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
                const res = await fetch(`/api/venue/profile?venueId=${venueId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const json = await res.json();
                const v = json.profile;
                if (!v) return;

                setPhotoUrl(v.photoURL || null);
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
                    fetch(`/api/venue/events?venueId=${venueId}&limit=200&status=all`, { headers }),
                    fetch(`/api/discovery?action=list&partnerId=${venueId}&role=venue`, { headers }),
                    fetch(`/api/venue/overview/summary?venueId=${venueId}`, { headers }),
                ]);

                const eventsData     = eventsRes.status === "fulfilled"      && eventsRes.value.ok      ? await eventsRes.value.json()      : null;
                const connectionsData = connectionsRes.status === "fulfilled" && connectionsRes.value.ok ? await connectionsRes.value.json() : null;
                const summaryData    = summaryRes.status === "fulfilled"      && summaryRes.value.ok     ? await summaryRes.value.json()     : null;

                const active: any[] = (connectionsData?.connections ?? []).filter(
                    (c: any) => c.status === "approved" || c.status === "active"
                );

                setStats({
                    eventsHosted:      Array.isArray(eventsData?.events) ? eventsData.events.length : 0,
                    ticketsSold:       summaryData?.totalGuestProfiles ?? 0,
                    hostsConnected:    active.filter((c) => c.otherType === "host").length,
                    promotersConnected: active.filter((c) => c.otherType === "promoter").length,
                });
            } catch {
                // Stats stay at 0
            } finally {
                setStatsLoading(false);
            }
        };

        fetchStats();
    }, [user, venueId]);

    // ── Photo selection → immediate upload ───────────────────────────────────
    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !venueId) return;

        // Show local preview instantly
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
        reader.readAsDataURL(file);

        // Upload to storage
        setPhotoUploading(true);
        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append("file", file);
            formData.append("venueId", venueId);
            formData.append("type", "logo");

            const res = await fetch("/api/venue/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");
            setPhotoUrl(data.url);
            setHasChanges(true);
        } catch (err: any) {
            toastError("Upload failed", err.message || "Could not upload photo.");
            setPhotoPreview(null); // revert preview
        } finally {
            setPhotoUploading(false);
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

            const res = await fetch("/api/venue/profile", {
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
    }, [user, venueId, form, photoUrl, toastSuccess, toastError]);

    useEffect(() => {
        if (hasChanges || isSaving) {
            setActions(
                <VenueActionButton variant="primary" onClick={handleSave} disabled={isSaving || photoUploading}>
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

    if (pageLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── Profile Hero Card ── */}
            <BentoCard padding="lg" className="overflow-visible shadow-2xl border-border-default">
                <div className="flex flex-col items-center gap-6 py-4">
                    {/* Avatar */}
                    <div
                        className="relative cursor-pointer group"
                        onMouseEnter={() => setIsPhotoHovered(true)}
                        onMouseLeave={() => setIsPhotoHovered(false)}
                        onClick={() => !photoUploading && fileInputRef.current?.click()}
                    >
                        <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-2 border-border-default shadow-xl ring-4 ring-accent-primary/10 bg-surface-tertiary flex items-center justify-center">
                            {displayPhoto ? (
                                <img src={displayPhoto} alt="Venue" className="w-full h-full object-cover" />
                            ) : (
                                <Building2 size={40} className="text-text-placeholder" />
                            )}
                        </div>

                        <AnimatePresence>
                            {isPhotoHovered && !photoUploading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute inset-0 rounded-[2rem] bg-black/60 flex flex-col items-center justify-center gap-1"
                                >
                                    <Camera size={20} className="text-white" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Change</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-accent-primary flex items-center justify-center shadow-lg border-2 border-surface-base">
                            {photoUploading
                                ? <Loader2 size={13} className="text-white animate-spin" />
                                : <Edit3 size={13} className="text-white" />
                            }
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                    />

                    {/* Name & tagline */}
                    <div className="text-center space-y-1.5">
                        <h2 className="text-2xl font-black tracking-tight text-text-primary">
                            {form.displayName || "Your Venue"}
                        </h2>
                        {form.tagline && (
                            <p className="text-sm text-text-tertiary max-w-xs leading-relaxed">{form.tagline}</p>
                        )}
                        {form.city && (
                            <div className="flex items-center justify-center gap-1.5 mt-2">
                                <MapPin size={12} className="text-accent-primary" />
                                <span className="text-[12px] font-semibold text-text-secondary">{form.city}</span>
                            </div>
                        )}
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full pt-2 border-t border-border-subtle">
                        {statItems.map((s) => (
                            <StatPill key={s.label} {...s} loading={statsLoading} />
                        ))}
                    </div>
                </div>
            </BentoCard>

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
        </div>
    );
}
