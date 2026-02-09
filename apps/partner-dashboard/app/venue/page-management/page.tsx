"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import EnhancedVenueEditor from "@/components/venue-management/EnhancedVenueEditor";

interface PageData {
    venue: any;
    highlights: any[];
    gallery: any[];
    menu: any[];
    facilities: any[];
    events: any[];
    pastEvents: any[];
}

export default function VenuePageManagement() {
    const { profile, loading: authLoading, user } = useDashboardAuth();
    const [data, setData] = useState<PageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [error, setError] = useState<string | null>(null);

    const venueId = profile?.activeMembership?.partnerId;

    // Helper for authenticated API calls
    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        // Force refresh token to ensure it's valid
        const token = await user.getIdToken(true);
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
    }, [user]);

    const fetchData = async () => {
        if (!venueId || !user) {
            setIsLoading(false);
            return;
        }

        try {
            // Fetch all venue data - updated API to return both upcoming and past events
            const res = await authedFetch(`/api/venue/page?venueId=${venueId}&dashboard=true&events=true`);
            const json = await res.json();

            if (res.ok && json.venue) {
                setData(json);
            } else {
                // Fallback to existing profile API
                const fallbackRes = await fetch(`/api/profile?profileId=${venueId}&type=venue&stats=true`);
                const fallbackData = await fallbackRes.json();

                if (fallbackRes.ok && fallbackData.profile) {
                    setData({
                        venue: fallbackData.profile,
                        highlights: fallbackData.highlights || [],
                        gallery: (fallbackData.profile?.photos || []).map((url: string, i: number) => ({ id: `photo-${i}`, imageUrl: url, order: i })),
                        menu: [],
                        facilities: [],
                        events: [],
                        pastEvents: []
                    });
                } else {
                    setError(json.error || fallbackData.error || "Failed to load venue data");
                }
            }
        } catch (err: any) {
            console.error("[VenuePageManagement] Fetch error:", err);
            setError(err.message || "Network error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading || !user) return;
        if (venueId) {
            fetchData();
        } else {
            setIsLoading(false);
        }
    }, [venueId, authLoading, user]);

    const handleUpdateVenue = async (updates: any) => {
        if (!venueId || !user) return;
        setSaveStatus("saving");
        try {
            const res = await authedFetch("/api/venue/page", {
                method: "POST",
                body: JSON.stringify({ venueId, updates })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to update");
            }

            await fetchData();
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err: any) {
            console.error("Update error:", err);
            setError(err.message);
            setSaveStatus("idle");
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-[var(--c1rcle-orange)]" />
                <p className="text-sm font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Loading Venue Editor...</p>
            </div>
        );
    }

    if (!data?.venue) {
        return (
            <div className="py-24 max-w-xl mx-auto text-center space-y-6">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">Venue Not Accessible</h2>
                    <p className="text-[var(--text-tertiary)]">We couldn't retrieve the configuration for your venue. This might be due to incorrect permissions or the venue ID not being linked to your account.</p>
                </div>
                {error && <div className="p-4 bg-red-500/5 text-red-500 text-xs font-mono rounded-xl border border-red-500/10">{error}</div>}
                <button
                    onClick={() => window.location.reload()}
                    className="btn btn-secondary"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    return (
        <div className="-mt-8 -mx-4 md:-mx-8">
            <EnhancedVenueEditor
                venueId={venueId!}
                venue={data.venue}
                upcomingEvents={data.events}
                pastEvents={data.pastEvents || []}
                highlights={data.highlights}
                gallery={data.gallery}
                onUpdate={handleUpdateVenue}
                error={error}
            />
        </div>
    );
}
