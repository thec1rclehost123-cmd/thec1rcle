"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    Globe,
    Instagram,
    Link2,
    Loader2,
    Mail,
    MapPin,
    Music2,
    Phone,
    Send,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { VenueActionButton, VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

type ProfileResponse = {
    profile: {
        id: string;
        type: "venue" | "host" | "promoter";
        name: string;
        legalName: string;
        bio: string;
        city: string;
        area: string;
        locationLabel: string;
        phone: string;
        email: string;
        avatarUrl: string;
        coverImageUrl: string;
        website: string;
        socialLinks: Record<string, string>;
        isVerified: boolean;
        memberSinceLabel: string;
        stats: {
            totalEvents: number;
            upcomingEvents: number;
            pastEvents: number;
            contactPoints: number;
        };
        upcomingEvents: PartnerEvent[];
        pastEvents: PartnerEvent[];
    };
    connection: {
        id: string;
        status: string | null;
        type: string | null;
        initiatedBy: string | null;
    } | null;
};

type PartnerEvent = {
    id: string;
    title: string;
    dateIso: string | null;
    dateLabel: string;
    imageUrl: string;
    venueName: string;
    city: string;
    lifecycle: string;
};

function formatSocialLink(key: string, value: string) {
    const clean = value.trim();
    if (!clean) return "";

    if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("mailto:") || clean.startsWith("tel:")) {
        return clean;
    }

    switch (key.toLowerCase()) {
        case "instagram":
            return `https://instagram.com/${clean.replace(/^@/, "")}`;
        case "x":
        case "twitter":
            return `https://x.com/${clean.replace(/^@/, "")}`;
        case "spotify":
            return `https://open.spotify.com/search/${encodeURIComponent(clean)}`;
        case "email":
            return `mailto:${clean}`;
        case "phone":
            return `tel:${clean}`;
        default:
            return clean.startsWith("www.") ? `https://${clean}` : clean;
    }
}

function eventBadgeTone(lifecycle: string) {
    const value = lifecycle.toLowerCase();
    if (value === "live") return "rgba(38, 208, 124, 0.14)";
    if (value === "completed") return "rgba(255,255,255,0.06)";
    return "rgba(244,74,34,0.12)";
}

export default function ProfilePageClient({ id }: { id: string }) {
    const router = useRouter();
    const { profile: viewerProfile, user } = useDashboardAuth();
    const [data, setData] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [requestLoading, setRequestLoading] = useState(false);

    const viewerId = viewerProfile?.activeMembership?.partnerId || "";
    const viewerRole = viewerProfile?.activeMembership?.partnerType || "";

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!user || !viewerId || !viewerRole) return;

            setLoading(true);
            setError("");
            try {
                const token = await user.getIdToken();
                const params = new URLSearchParams({
                    viewerId,
                    viewerRole,
                });
                const response = await fetch(`/api/venue/partners/${id}?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Failed to load partner profile");
                if (!cancelled) setData(payload);
            } catch (err: any) {
                if (!cancelled) setError(err.message || "Failed to load partner profile");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [id, user, viewerId, viewerRole]);

    const profile = data?.profile;
    const connection = data?.connection;

    const requestState = useMemo(() => {
        const status = connection?.status || "";
        if (status === "active" || status === "approved") {
            return { label: "Partnership Active", disabled: true };
        }
        if (status === "pending") {
            return { label: "Request Pending", disabled: true };
        }
        return { label: "Send Request", disabled: false };
    }, [connection?.status]);

    const handleSendRequest = async () => {
        if (!profile || !user || !viewerId || !viewerRole || requestState.disabled) return;

        setRequestLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/discovery", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    requesterId: viewerId,
                    requesterType: viewerRole,
                    requesterName: viewerProfile?.activeMembership?.partnerName || viewerProfile?.displayName || "",
                    requesterEmail: viewerProfile?.email || "",
                    targetId: profile.id,
                    targetType: profile.type,
                    targetName: profile.name,
                }),
            });

            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Failed to send request");

            setData((current) => current ? {
                ...current,
                connection: {
                    id: payload.id || "",
                    status: "pending",
                    type: profile.type === "host" ? "partnership" : "promoter_connection",
                    initiatedBy: viewerRole,
                },
            } : current);
        } catch (err: any) {
            setError(err.message || "Failed to send request");
        } finally {
            setRequestLoading(false);
        }
    };

    if (loading) {
        return (
            <VenuePageShell title="Partner Profile">
                <div className="min-h-[50vh] flex items-center justify-center">
                    <Loader2 className="w-9 h-9 animate-spin" style={{ color: "var(--v-orange)" }} />
                </div>
            </VenuePageShell>
        );
    }

    if (error || !profile) {
        return (
            <VenuePageShell title="Partner Profile">
                <div
                    className="rounded-[32px] border border-dashed px-8 py-16 text-center"
                    style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                >
                    <p className="text-[20px] font-black" style={{ color: "var(--v-text-primary)" }}>
                        Unable to load this partner
                    </p>
                    <p className="mt-2 text-[14px]" style={{ color: "var(--v-text-secondary)" }}>
                        {error || "This partner profile is unavailable right now."}
                    </p>
                    <div className="mt-6 flex justify-center">
                        <VenueActionButton onClick={() => router.back()} variant="secondary">
                            Back
                        </VenueActionButton>
                    </div>
                </div>
            </VenuePageShell>
        );
    }

    const socialEntries = Object.entries(profile.socialLinks || {}).filter(([, value]) => value);

    return (
        <VenuePageShell
            title={profile.name}
            subtitle={
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="inline-flex items-center gap-2">
                        <MapPin className="w-4 h-4" style={{ color: "var(--v-orange)" }} />
                        {profile.locationLabel || "Location not set"}
                    </span>
                    {profile.memberSinceLabel ? (
                        <span className="inline-flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                            Member since {profile.memberSinceLabel}
                        </span>
                    ) : null}
                </div>
            }
            actions={
                <div className="flex items-center gap-2">
                    <VenueActionButton onClick={() => router.back()} variant="secondary" icon={ChevronLeft}>
                        Back
                    </VenueActionButton>
                    <VenueActionButton
                        onClick={handleSendRequest}
                        disabled={requestState.disabled || requestLoading}
                        icon={requestState.disabled ? CheckCircle2 : Send}
                    >
                        {requestLoading ? "Sending..." : requestState.label}
                    </VenueActionButton>
                </div>
            }
        >
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.75fr)_360px] gap-6">
                <div className="space-y-6">
                    <section
                        className="relative overflow-hidden rounded-[32px] border"
                        style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
                            borderColor: "var(--v-border)",
                            boxShadow: "var(--v-shadow-card)",
                        }}
                    >
                        <div
                            className="absolute inset-0"
                            style={{
                                background: profile.coverImageUrl
                                    ? `linear-gradient(120deg, rgba(12,12,14,0.9) 0%, rgba(12,12,14,0.78) 44%, rgba(12,12,14,0.9) 100%), url(${profile.coverImageUrl}) center/cover`
                                    : "radial-gradient(circle at top right, rgba(244,74,34,0.18), transparent 30%), radial-gradient(circle at bottom left, rgba(255,255,255,0.06), transparent 30%)",
                            }}
                        />
                        <div className="relative p-6 md:p-8">
                            <div className="flex flex-col md:flex-row gap-6 md:items-start">
                                <div
                                    className="h-28 w-28 md:h-32 md:w-32 rounded-[28px] overflow-hidden border shrink-0"
                                    style={{ borderColor: "rgba(255,255,255,0.08)", background: "var(--v-elevated)" }}
                                >
                                    {profile.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-[42px] font-black uppercase text-white bg-[linear-gradient(145deg,#f44a22,#ff7a59)]">
                                            {profile.name.slice(0, 1)}
                                        </div>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span
                                            className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                                            style={{ background: "rgba(255,255,255,0.06)", color: "var(--v-text-secondary)" }}
                                        >
                                            {profile.type}
                                        </span>
                                        {profile.isVerified ? (
                                            <span
                                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                                                style={{ background: "rgba(244,74,34,0.12)", color: "var(--v-orange)" }}
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                Verified
                                            </span>
                                        ) : null}
                                    </div>

                                    <p className="mt-4 max-w-3xl text-[15px] leading-7" style={{ color: "var(--v-text-secondary)" }}>
                                        {profile.bio || "No bio has been added yet."}
                                    </p>

                                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <HeroMetric label="Events" value={String(profile.stats.totalEvents)} />
                                        <HeroMetric label="Upcoming" value={String(profile.stats.upcomingEvents)} />
                                        <HeroMetric label="Past Events" value={String(profile.stats.pastEvents)} />
                                        <HeroMetric label="Contact Points" value={String(profile.stats.contactPoints)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        className="rounded-[32px] border p-5 md:p-6"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--v-text-muted)" }}>
                                    Upcoming Events
                                </p>
                                <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em]" style={{ color: "var(--v-text-primary)" }}>
                                    Upcoming events
                                </h2>
                            </div>
                            <div
                                className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
                                style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)" }}
                            >
                                {profile.stats.upcomingEvents} listed
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {profile.upcomingEvents.length === 0 ? (
                                <EmptyEventState label="No upcoming events linked yet" />
                            ) : (
                                profile.upcomingEvents.map((event) => <EventCard key={event.id} event={event} />)
                            )}
                        </div>
                    </section>

                    <section
                        className="rounded-[32px] border p-5 md:p-6"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--v-text-muted)" }}>
                                    Past Events
                                </p>
                                <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em]" style={{ color: "var(--v-text-primary)" }}>
                                    Past events
                                </h2>
                            </div>
                            <Sparkles className="w-5 h-5" style={{ color: "var(--v-orange)" }} />
                        </div>

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {profile.pastEvents.length === 0 ? (
                                <EmptyEventState label="No completed events found" />
                            ) : (
                                profile.pastEvents.map((event) => <CompactEventCard key={event.id} event={event} />)
                            )}
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <section
                        className="rounded-[32px] border p-5 md:p-6"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--v-text-muted)" }}>
                            Direct Contact
                        </p>
                        <div className="mt-5 space-y-3">
                            <InfoRow
                                icon={<Mail className="w-4 h-4" />}
                                label="Email"
                                value={profile.email || "Not provided"}
                                href={profile.email ? `mailto:${profile.email}` : ""}
                            />
                            <InfoRow
                                icon={<Phone className="w-4 h-4" />}
                                label="Phone"
                                value={profile.phone || "Not provided"}
                                href={profile.phone ? `tel:${profile.phone}` : ""}
                            />
                            <InfoRow
                                icon={<Globe className="w-4 h-4" />}
                                label="Website"
                                value={profile.website || "Not provided"}
                                href={profile.website ? formatSocialLink("website", profile.website) : ""}
                            />
                        </div>
                    </section>

                    <section
                        className="rounded-[32px] border p-5 md:p-6"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--v-text-muted)" }}>
                            Social Links
                        </p>
                        <div className="mt-5 space-y-3">
                            {socialEntries.length === 0 ? (
                                <p className="text-[14px]" style={{ color: "var(--v-text-secondary)" }}>
                                    No social links connected yet.
                                </p>
                            ) : (
                                socialEntries.map(([key, value]) => (
                                    <InfoRow
                                        key={key}
                                        icon={getSocialIcon(key)}
                                        label={key}
                                        value={value}
                                        href={formatSocialLink(key, value)}
                                    />
                                ))
                            )}
                        </div>
                    </section>

                    <section
                        className="rounded-[32px] border p-5 md:p-6"
                        style={{ background: "linear-gradient(180deg, rgba(244,74,34,0.08), rgba(244,74,34,0.02))", borderColor: "rgba(244,74,34,0.18)" }}
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--v-text-muted)" }}>
                            Partnership Status
                        </p>
                        <h3 className="mt-3 text-[20px] font-black tracking-[-0.04em]" style={{ color: "var(--v-text-primary)" }}>
                            {requestState.label}
                        </h3>
                        <p className="mt-2 text-[14px] leading-6" style={{ color: "var(--v-text-secondary)" }}>
                            {requestState.disabled
                                ? "This connection already exists in your network state."
                                : `Send a formal request to connect with ${profile.name} and bring their events into your venue network.`}
                        </p>
                        <div className="mt-5">
                            <VenueActionButton
                                onClick={handleSendRequest}
                                disabled={requestState.disabled || requestLoading}
                                icon={requestState.disabled ? CheckCircle2 : Send}
                                className="w-full justify-center"
                            >
                                {requestLoading ? "Sending..." : requestState.label}
                            </VenueActionButton>
                        </div>
                    </section>
                </aside>
            </div>
        </VenuePageShell>
    );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
    return (
        <div
            className="rounded-[22px] border px-4 py-3"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
        >
            <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--v-text-muted)" }}>
                {label}
            </p>
            <p className="mt-2 text-[24px] font-black tracking-[-0.05em]" style={{ color: "var(--v-text-primary)" }}>
                {value}
            </p>
        </div>
    );
}

function EmptyEventState({ label }: { label: string }) {
    return (
        <div
            className="rounded-[24px] border border-dashed p-8 md:col-span-2 xl:col-span-3"
            style={{ borderColor: "var(--v-border)", background: "var(--v-elevated)" }}
        >
            <p className="text-[15px] font-semibold" style={{ color: "var(--v-text-secondary)" }}>
                {label}
            </p>
        </div>
    );
}

function EventCard({ event }: { event: PartnerEvent }) {
    return (
        <div
            className="relative overflow-hidden rounded-[28px] border min-h-[260px]"
            style={{
                borderColor: "rgba(255,255,255,0.08)",
                background: event.imageUrl
                    ? `linear-gradient(180deg, rgba(7,7,9,0.15), rgba(7,7,9,0.92)), url(${event.imageUrl}) center/cover`
                    : "linear-gradient(145deg, rgba(244,74,34,0.15), rgba(255,255,255,0.03))",
            }}
        >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.22)_42%,rgba(0,0,0,0.94)_100%)]" />
            <div className="relative flex h-full flex-col justify-end p-5">
                <div className="mb-3 inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ background: eventBadgeTone(event.lifecycle), color: "white" }}>
                    {event.lifecycle}
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.64)" }}>
                    {event.dateLabel}
                </p>
                <h3 className="mt-2 text-[28px] font-black tracking-[-0.06em] leading-[1.02]" style={{ color: "white" }}>
                    {event.title}
                </h3>
                {(event.venueName || event.city) ? (
                    <p className="mt-3 text-[14px]" style={{ color: "rgba(255,255,255,0.76)" }}>
                        {[event.venueName, event.city].filter(Boolean).join(" • ")}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

function CompactEventCard({ event }: { event: PartnerEvent }) {
    return (
        <div
            className="rounded-[24px] overflow-hidden border"
            style={{ borderColor: "var(--v-border)", background: "var(--v-elevated)" }}
        >
            <div
                className="h-36"
                style={{
                    background: event.imageUrl
                        ? `linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.46)), url(${event.imageUrl}) center/cover`
                        : "linear-gradient(135deg, rgba(244,74,34,0.18), rgba(255,255,255,0.04))",
                }}
            />
            <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--v-text-muted)" }}>
                    {event.dateLabel}
                </p>
                <h4 className="mt-2 text-[18px] font-black tracking-[-0.04em]" style={{ color: "var(--v-text-primary)" }}>
                    {event.title}
                </h4>
                {(event.venueName || event.city) ? (
                    <p className="mt-2 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                        {[event.venueName, event.city].filter(Boolean).join(" • ")}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

function InfoRow({
    icon,
    label,
    value,
    href,
}: {
    icon: ReactNode;
    label: string;
    value: string;
    href?: string;
}) {
    const content = (
        <div
            className="flex items-center justify-between gap-3 rounded-[22px] border px-4 py-3 transition-colors"
            style={{ borderColor: "var(--v-border)", background: "var(--v-elevated)" }}
        >
            <div className="flex min-w-0 items-center gap-3">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-[14px]"
                    style={{ background: "rgba(255,255,255,0.05)", color: "var(--v-orange)" }}
                >
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--v-text-muted)" }}>
                        {label}
                    </p>
                    <p className="truncate text-[14px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                        {value}
                    </p>
                </div>
            </div>
            {href ? <ArrowUpRight className="w-4 h-4 shrink-0" style={{ color: "var(--v-text-tertiary)" }} /> : null}
        </div>
    );

    if (!href) return content;

    return (
        <Link href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            {content}
        </Link>
    );
}

function getSocialIcon(key: string) {
    const normalized = key.toLowerCase();
    if (normalized === "instagram") return <Instagram className="w-4 h-4" />;
    if (normalized === "spotify") return <Music2 className="w-4 h-4" />;
    if (normalized === "email") return <Mail className="w-4 h-4" />;
    if (normalized === "phone") return <Phone className="w-4 h-4" />;
    if (normalized === "website") return <Globe className="w-4 h-4" />;
    return <Link2 className="w-4 h-4" />;
}
