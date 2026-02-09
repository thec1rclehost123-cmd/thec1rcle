"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Calendar, Music, Ticket, Wine, Percent,
    Image as ImageIcon, CheckCircle2, ChevronRight, ChevronLeft,
    AlertCircle, Loader2, MapPin, Plus
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useRouter, useSearchParams } from "next/navigation";

// Step Components
import { IdentityStep, SchedulingStep, ExperienceStep } from "./steps";
import { TicketTierStep } from "./TicketTierStep";
import { TableBookingStep } from "./TableBookingStep";
import { MediaStep } from "./MediaStep";
import { PromoterStep } from "./PromoterStep";
import { PublishConfirmationModal } from "./PublishConfirmationModal";
import { DetailedBreakdown } from "./components/DetailedBreakdown";
import { WizardNavigation, SaveStatus, WizardStep, StepConfig } from "./WizardNavigation";
import { EventCard, EventPage } from "@c1rcle/ui";

// Step Configuration
const STEPS: StepConfig[] = [
    { id: 'identity', label: 'Identity & Headline', shortLabel: 'Identity', icon: Sparkles, description: 'Event name, category, host and venue' },
    { id: 'scheduling', label: 'Dates & Times', shortLabel: 'Schedule', icon: Calendar, description: 'When the event takes place' },
    { id: 'experience', label: 'Lineup & Experience', shortLabel: 'Lineup', icon: Music, description: 'Artists, genres, dress code and restrictions' },
    { id: 'ticketing', label: 'Ticketing & Pricing', shortLabel: 'Tickets', icon: Ticket, description: 'Ticket tiers, pricing and capacity' },
    { id: 'tables', label: 'Tables & VIP', shortLabel: 'Tables', icon: Wine, description: 'Table packages and premium offerings' },
    { id: 'promoters', label: 'Sales & Distribution', shortLabel: 'Sales', icon: Percent, description: 'Promoter settings and commissions' },
    { id: 'media', label: 'Media & Presentation', shortLabel: 'Media', icon: ImageIcon, description: 'Poster, images and event copy' },
    { id: 'review', label: 'Review & Publish', shortLabel: 'Review', icon: CheckCircle2, description: 'Final review before publishing' },
];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(value);
};

export function CreateEventWizardV2({ role }: { role: 'venue' | 'host' }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile, user } = useDashboardAuth();

    // Helper for authenticated API calls
    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) {
            console.error("[WizardV2] authedFetch called without user");
            throw new Error("Not authenticated");
        }
        // Force refresh token to ensure it's valid
        const token = await user.getIdToken(true);
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${token}`,
            },
        });
    }, [user]);

    // State
    const [currentStep, setCurrentStep] = useState<WizardStep>('identity');
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
    const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
    const [isFullPagePreviewOpen, setIsFullPagePreviewOpen] = useState(false);
    const [showGuestlist, setShowGuestlist] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
    const [partnerships, setPartnerships] = useState<any[]>([]);
    const [drafts, setDrafts] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
    const [localRecoveryData, setLocalRecoveryData] = useState<any>(null);
    const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
    const [prefilledSlot, setPrefilledSlot] = useState<{
        venueId: string;
        venueName: string;
        date: string;
        startTime: string;
        endTime: string;
    } | null>(null);

    // Form Data
    const [formData, setFormData] = useState<any>(() => ({
        title: "",
        subtitle: "",
        summary: "",
        description: "",
        category: "Music",
        city: "Pune",
        startDate: "",
        startTime: "21:00",
        endTime: "03:00",
        doorsOpen: "",
        lastEntry: "",
        venueId: "",
        venueName: "",
        address: "",
        pincode: "",
        mapsLink: "",
        arrivalInstructions: "",
        capacity: 500,
        artists: [],
        genres: [],
        dressCode: "smart_casual",
        themeDescription: "",
        ageRestriction: "21+",
        tickets: [
            {
                id: 'ga',
                name: 'General Admission',
                entryType: 'general',
                price: 500,
                quantity: 400,
                minPerOrder: 1,
                maxPerOrder: 10,
                promoterEnabled: true
            }
        ],
        tables: [],
        tablesEnabled: false,
        promotersEnabled: true,
        commission: 15,
        commissionType: "percent",
        useDefaultCommission: true,
        buyerDiscountsEnabled: false,
        discount: 10,
        discountType: "percent",
        useDefaultDiscount: true,
        images: [],
        poster: "",
        lifecycle: 'draft',
        creatorRole: role,
        creatorId: "",
        draftMeta: {
            wizardVersion: "2.0",
            lastStep: "identity",
            completionPercent: 0,
            lastSavedAt: new Date().toISOString(),
            clientUpdatedAt: Date.now()
        }
    }));

    const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

    // Validation per step
    const stepValidation = useMemo(() => {
        const validation: Record<WizardStep, { isValid: boolean; issues: string[] }> = {
            identity: { isValid: true, issues: [] },
            scheduling: { isValid: true, issues: [] },
            experience: { isValid: true, issues: [] },
            ticketing: { isValid: true, issues: [] },
            tables: { isValid: true, issues: [] },
            promoters: { isValid: true, issues: [] },
            media: { isValid: true, issues: [] },
            review: { isValid: true, issues: [] }
        };

        // Identity validation
        if (!formData.title) {
            validation.identity.issues.push("Event title is required");
            validation.identity.isValid = false;
        }
        if (role === 'host' && !formData.venueId) {
            validation.identity.issues.push("Please select a venue partner");
            validation.identity.isValid = false;
        }

        // Scheduling validation
        if (!formData.startDate) {
            validation.scheduling.issues.push("Event date is required");
            validation.scheduling.isValid = false;
        }

        // Ticketing validation
        const totalTickets = formData.tickets?.reduce((sum: number, t: any) => sum + (Number(t.quantity) || 0), 0) || 0;
        if (totalTickets > formData.capacity) {
            validation.ticketing.issues.push(`Ticket quantity (${totalTickets}) exceeds capacity (${formData.capacity})`);
            validation.ticketing.isValid = false;
        }

        // Media validation (soft warning)
        if (!formData.poster && !formData.images?.length) {
            validation.media.issues.push("Adding a poster is recommended for better engagement");
        }

        return validation;
    }, [formData, role]);

    // Grand Total Calculation
    const grandTotal = useMemo(() => {
        const ticketRevenue = (formData.tickets || []).reduce((acc: number, tier: any) =>
            acc + (Number(tier.price) * Number(tier.quantity)), 0);
        const tableRevenue = (formData.tables || []).reduce((acc: number, table: any) =>
            acc + (Number(table.price) * Number(table.quantity)), 0);
        const ticketCapacity = (formData.tickets || []).reduce((acc: number, tier: any) =>
            acc + Number(tier.quantity), 0);
        const tableCapacity = (formData.tables || []).reduce((acc: number, table: any) =>
            acc + (Number(table.guestsPerTable || table.capacity || 0) * Number(table.quantity)), 0);

        return {
            value: ticketRevenue + tableRevenue,
            quantity: ticketCapacity + tableCapacity
        };
    }, [formData.tickets, formData.tables]);

    const updateFormData = useCallback((updates: any) => {
        setFormData((prev: any) => ({ ...prev, ...updates }));
    }, []);

    // Fetch partnerships for hosts
    useEffect(() => {
        if (role === 'host' && profile?.activeMembership?.partnerId) {
            const fetchPartnerships = async () => {
                try {
                    const res = await authedFetch(`/api/venue/partnerships?hostId=${profile.activeMembership.partnerId}&status=active`);
                    const data = await res.json();
                    setPartnerships(data.partnerships || []);
                } catch (err) {
                    console.error("Failed to fetch partnerships", err);
                }
            };
            fetchPartnerships();
        }
    }, [role, profile?.activeMembership?.partnerId, authedFetch]);

    // Hydrate from URL params (when coming from venue calendar selection)
    useEffect(() => {
        const venueId = searchParams.get('venue');
        const venueName = searchParams.get('venueName');
        const date = searchParams.get('date');
        const startTime = searchParams.get('startTime');
        const endTime = searchParams.get('endTime');

        if (venueId && date && startTime && endTime) {
            setPrefilledSlot({
                venueId,
                venueName: venueName || 'Partner Venue',
                date,
                startTime,
                endTime
            });

            // Pre-fill form data
            setFormData((prev: any) => ({
                ...prev,
                venueId,
                venueName: venueName || prev.venueName,
                startDate: date,
                startTime,
                endTime
            }));
        }
    }, [searchParams]);

    // 1. Load Local Recovery Snapshot (Crash recovery)
    useEffect(() => {
        if (!profile?.uid || isLoadingDraft) return;
        const currentId = searchParams.get('id') || 'new';
        const storageKey = `c1rcle_draft_event_v2_${profile.uid}_${currentId}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
            try {
                const localData = JSON.parse(stored);
                // If we don't have an ID in URL, we can just hydrate from local immediately if it's "new"
                if (currentId === 'new' && !formData.id && localData.title) {
                    setFormData((prev: any) => ({ ...prev, ...localData }));
                    return;
                }
                setLocalRecoveryData(localData);
            } catch (e) {
                console.error("Failed to parse local draft", e);
            }
        }
    }, [profile?.uid, searchParams, isLoadingDraft]);

    // 2. Fetch remote draft if ID is in URL
    useEffect(() => {
        const eventId = searchParams.get('id');
        if (eventId && eventId !== 'new' && eventId !== savedDraftId && !isLoadingDraft && !loadError) {
            const fetchDraft = async () => {
                setIsLoadingDraft(true);
                setLoadError(null);
                try {
                    console.log("[WizardV2] Fetching draft:", eventId);
                    const res = await authedFetch(`/api/events/${eventId}`);
                    if (!res.ok) throw new Error("Failed to load event draft.");
                    const data = await res.json();

                    if (data.event) {
                        const remote = data.event;
                        const remoteUpdated = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

                        // Compare with local recovery data if available
                        if (localRecoveryData && localRecoveryData.draftMeta?.clientUpdatedAt > remoteUpdated) {
                            // Local is newer! Show recovery option
                            console.log("[WizardV2] Local recovery data is newer");
                            setFormData(remote);
                            setSavedDraftId(remote.id);
                            setShowRecoveryBanner(true);
                        } else {
                            // Remote is newer or no local data
                            console.log("[WizardV2] Loading remote draft data");
                            setFormData(remote);
                            setSavedDraftId(remote.id);

                            // Restore progress if saved
                            if (remote.draftMeta?.lastStep) {
                                setCurrentStep(remote.draftMeta.lastStep as WizardStep);
                            }
                        }
                    }
                } catch (err: any) {
                    console.error("Failed to fetch remote draft:", err);
                    setLoadError(err.message || "Failed to load draft");
                } finally {
                    setIsLoadingDraft(false);
                }
            };
            fetchDraft();
        }
    }, [searchParams, savedDraftId, loadError, isLoadingDraft, localRecoveryData, authedFetch]);

    // 3. Fetch drafts list if no ID provided
    useEffect(() => {
        if (!searchParams.get('id') && profile?.activeMembership?.partnerId) {
            const fetchDrafts = async () => {
                try {
                    const res = await authedFetch(`/api/events?lifecycle=draft&creatorId=${profile.activeMembership.partnerId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setDrafts(data.events || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch drafts:", err);
                }
            };
            fetchDrafts();
        }
    }, [searchParams, profile?.activeMembership?.partnerId, authedFetch]);

    // Hydrate creatorId and Venue Info (if role is venue)
    useEffect(() => {
        if (profile?.activeMembership?.partnerId || profile?.uid) {
            const preferredId = profile.activeMembership?.partnerId || profile.uid;

            const updates: any = {};

            if (formData.creatorId !== preferredId) {
                updates.creatorId = preferredId;
            }

            // For venues, auto-fill the venue identity
            if (role === 'venue' && profile?.activeMembership?.partnerId) {
                const venueName = profile.activeMembership.partnerName || "Your Venue";
                if (formData.venueId !== preferredId || formData.venueName !== venueName) {
                    updates.venueId = preferredId;
                    updates.venueName = venueName;
                    updates.venue = venueName; // Legacy support
                }
            }

            if (Object.keys(updates).length > 0) {
                updateFormData(updates);
            }
        }
    }, [profile, role, formData.creatorId, formData.venueId, formData.venueName, updateFormData]);

    // Auto-save to localStorage
    useEffect(() => {
        if (!profile?.uid) return;
        const storageKey = `c1rcle_draft_event_v2_${profile.uid}_${savedDraftId || 'new'}`;
        const enrichedData = {
            ...formData,
            draftMeta: {
                ...formData.draftMeta,
                lastStep: currentStep,
                clientUpdatedAt: Date.now(),
                lastSavedAt: new Date().toISOString()
            }
        };
        localStorage.setItem(storageKey, JSON.stringify(enrichedData));
    }, [formData, savedDraftId, profile?.uid, currentStep]);

    // Remote auto-save (debounced)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if ((formData.title || formData.description) && formData.lifecycle === 'draft') {
                setSaveState('saving');
                try {
                    const payload = {
                        ...formData,
                        host: profile?.activeMembership?.partnerName || profile?.displayName || "C1RCLE Partner",
                        venue: formData.venue || formData.venueName || "TBD",
                        location: formData.venue || formData.venueName || formData.address || "TBD",
                        draftMeta: {
                            ...formData.draftMeta,
                            lastStep: currentStep,
                            clientUpdatedAt: Date.now(),
                            lastSavedAt: new Date().toISOString()
                        }
                    };

                    if (savedDraftId) {
                        const res = await authedFetch(`/api/events/${savedDraftId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                actor: {
                                    uid: profile?.uid,
                                    role: role,
                                    partnerId: profile?.activeMembership?.partnerId
                                },
                                updates: payload
                            }),
                        });
                        if (!res.ok) throw new Error("Update failed");
                    } else {
                        const res = await authedFetch('/api/events/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...payload,
                                creatorId: profile?.activeMembership?.partnerId || profile?.uid,
                                creatorRole: role,
                                lifecycle: 'draft'
                            }),
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.event?.id) {
                                setSavedDraftId(data.event.id);
                                const params = new URLSearchParams(searchParams.toString());
                                params.set('id', data.event.id);
                                router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
                            }
                        }
                    }
                    setSaveState('saved');
                } catch (e) {
                    console.error("Auto-save failed:", e);
                    setSaveState('failed');
                }
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [formData, savedDraftId, profile, role, router, currentStep, searchParams, authedFetch]);

    const validateCurrentStep = (): boolean => {
        const validation = stepValidation[currentStep];
        if (!validation.isValid) {
            const errors: Record<string, string> = {};
            validation.issues.forEach((issue, i) => {
                errors[`step_${i}`] = issue;
            });
            setValidationErrors(errors);
            return false;
        }
        setValidationErrors({});
        return true;
    };

    const nextStep = () => {
        if (!validateCurrentStep()) return;

        // Mark current step as completed
        if (!completedSteps.includes(currentStep)) {
            setCompletedSteps(prev => [...prev, currentStep]);
        }

        if (currentStepIndex < STEPS.length - 1) {
            setCurrentStep(STEPS[currentStepIndex + 1].id);
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(STEPS[currentStepIndex - 1].id);
        } else {
            router.back();
        }
    };

    const handleSubmit = async (isDraft: boolean = false) => {
        if (!isDraft && !validateCurrentStep()) return;
        setIsSubmitting(true);
        try {
            const endpoint = savedDraftId ? `/api/events/${savedDraftId}` : '/api/events/create';
            const method = savedDraftId ? 'PATCH' : 'POST';

            const hostId = profile?.activeMembership?.partnerId || profile?.uid;
            const hostName = profile?.activeMembership?.partnerName || profile?.displayName || "C1RCLE Host";

            const payload: any = {
                ...formData,
                venue: formData.venue || formData.venueName || "TBD",
                location: formData.venue || formData.venueName || formData.address || "TBD",
                host: hostName,
                hostName: hostName,
                hostId: role === 'host' ? hostId : formData.hostId,
                venueId: role === 'venue' ? (profile?.activeMembership?.partnerId) : formData.venueId,
                creatorId: profile?.activeMembership?.partnerId || profile?.uid,
                creatorRole: formData.creatorRole || role,
                lifecycle: isDraft ? 'draft' : (role === 'venue' ? 'scheduled' : 'submitted'),
                status: 'active',
                settings: { ...(formData.settings || {}), showGuestlist }
            };

            const res = await authedFetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(method === 'PATCH' ? {
                    actor: {
                        uid: profile?.uid,
                        role: role,
                        partnerId: profile?.activeMembership?.partnerId
                    },
                    updates: payload,
                    action: isDraft ? 'draft' : (role === 'venue' ? 'publish' : 'submit')
                } : payload),
            });

            if (res.ok) {
                const eventResult = await res.json();
                const eventId = eventResult.event?.id || savedDraftId;

                // For hosts: Create a slot request if this is a submission (not draft)
                if (role === 'host' && !isDraft && eventId && formData.venueId) {
                    try {
                        const slotRequestPayload = {
                            eventId,
                            hostId,
                            hostName,
                            venueId: formData.venueId,
                            venueName: formData.venueName || formData.venue || "Venue",
                            requestedDate: formData.startDate,
                            requestedStartTime: formData.startTime || "21:00",
                            requestedEndTime: formData.endTime || "04:00",
                            notes: formData.slotRequestNotes || "",
                            priority: "normal"
                        };

                        await authedFetch('/api/slots', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(slotRequestPayload)
                        });
                    } catch (slotErr) {
                        console.error("Failed to create slot request:", slotErr);
                        // Don't fail the whole submission if slot request fails
                    }
                }

                if (profile?.uid) {
                    const storageKey = `c1rcle_draft_event_v2_${profile.uid}_${savedDraftId || 'new'}`;
                    localStorage.removeItem(storageKey);
                }
                if (!isDraft) {
                    setIsSuccess(true);
                } else {
                    setSaveState('saved');
                }
            } else {
                const data = await res.json();
                alert(`Error: ${data.message || data.error || 'Failed to create event'}`);
            }
        } catch (err) {
            console.error("Submission failed", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingDraft) {
        return (
            <div className="min-h-screen bg-[var(--surface-base)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-body text-muted">Loading your draft...</p>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-screen bg-[var(--surface-base)] flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-semibold">Error Loading Draft</p>
                        <p className="text-sm opacity-90">{loadError}</p>
                    </div>
                    <button
                        onClick={() => router.push(role === 'venue' ? '/venue/events' : '/host/events')}
                        className="btn btn-primary w-full py-4"
                    >
                        Back to Events
                    </button>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[var(--surface-base)] flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full text-center"
                >
                    <div className="mb-8 relative inline-block">
                        <div className="absolute inset-0 bg-[var(--state-success-bg)] rounded-full scale-150 blur-2xl opacity-50" />
                        <div className="relative bg-[var(--state-success)] rounded-full p-6 shadow-xl">
                            <CheckCircle2 className="h-12 w-12 text-white" />
                        </div>
                    </div>
                    <h1 className="text-headline text-[var(--text-primary)] mb-4">
                        {role === 'venue' ? 'Event Published!' : 'Slot Request Submitted!'}
                    </h1>
                    <p className="text-body text-[var(--text-tertiary)] mb-8">
                        {role === 'venue'
                            ? "Your event is now live and ready for guests to discover."
                            : "Your slot request has been sent to the venue. You'll be notified once they respond."}
                    </p>
                    {role === 'host' && (
                        <div className="p-4 rounded-xl bg-[var(--surface-secondary)] mb-8">
                            <div className="flex items-center gap-3 text-left">
                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">{formData.venueName || 'Venue'}</p>
                                    <p className="text-xs text-[var(--text-tertiary)]">
                                        {formData.startDate} • {formData.startTime} - {formData.endTime}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="space-y-3">
                        <button
                            onClick={() => router.push(role === 'venue' ? '/venue/events' : '/host/events/requests')}
                            className="btn btn-primary w-full py-4 text-[15px]"
                        >
                            {role === 'venue' ? 'Go to Events' : 'View My Requests'}
                        </button>
                        <button
                            onClick={() => router.push(role === 'venue' ? '/venue' : '/host')}
                            className="btn btn-secondary w-full py-4 text-[15px]"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-[var(--surface-base)]">
                <div className="max-w-6xl mx-auto px-6 py-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-headline text-[var(--text-primary)]">Create Event</h1>
                            <p className="text-body-sm text-[var(--text-tertiary)]">Build something extraordinary</p>
                        </div>
                        <SaveStatus status={saveState} />
                    </div>

                    {/* Navigation */}
                    <WizardNavigation
                        steps={STEPS}
                        currentStep={currentStep}
                        currentStepIndex={currentStepIndex}
                        onStepClick={setCurrentStep}
                        stepValidation={stepValidation}
                        completedSteps={completedSteps}
                    />

                    {/* Main Layout */}
                    {drafts.length > 0 && !searchParams.get('id') && currentStep === 'identity' && !formData.title ? (
                        <div className="max-w-5xl mx-auto py-16 px-4">
                            <div className="text-center mb-16 space-y-4">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-indigo-50 text-indigo-600 mb-4 shadow-sm">
                                    <Sparkles className="w-8 h-8" />
                                </div>
                                <h2 className="text-[32px] font-black tracking-tight text-[var(--text-primary)] uppercase">Draft Sessions</h2>
                                <p className="text-[var(--text-tertiary)] text-sm font-medium tracking-wide uppercase opacity-60">Resume your creative sequence</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {drafts.map(draft => (
                                    <div
                                        key={draft.id}
                                        onClick={() => {
                                            const params = new URLSearchParams(searchParams.toString());
                                            params.set('id', draft.id);
                                            router.push(`${window.location.pathname}?${params.toString()}`);
                                        }}
                                        className="group relative overflow-hidden rounded-[32px] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] p-8 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl hover:border-indigo-500/30 active:scale-[0.98]"
                                    >
                                        <div className="flex flex-col h-full gap-6">
                                            <div className="flex items-start justify-between">
                                                <div className="w-14 h-14 rounded-2xl bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden border border-[var(--border-subtle)]">
                                                    {draft.poster || draft.image ? (
                                                        <img src={draft.poster || draft.image} className="w-full h-full object-cover" />
                                                    ) : <Music className="w-6 h-6 text-[var(--text-tertiary)]" />}
                                                </div>
                                                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">
                                                    Draft
                                                </span>
                                            </div>

                                            <div>
                                                <h3 className="text-xl font-bold text-[var(--text-primary)] leading-tight group-hover:text-indigo-600 transition-colors mb-2">
                                                    {draft.title || "Untitled Sequence"}
                                                </h3>
                                                <div className="flex items-center gap-2 text-[var(--text-tertiary)] opacity-60">
                                                    <Loader2 className="w-3 h-3" />
                                                    <p className="text-[11px] font-bold uppercase tracking-widest">
                                                        Edited {draft.updatedAt ? new Date(draft.updatedAt).toLocaleDateString() : 'Just now'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-4 mt-auto border-t border-[var(--border-subtle)] flex items-center justify-between text-indigo-500">
                                                <span className="text-[xs] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Resume Project</span>
                                                <ChevronRight className="w-5 h-5 translate-x-[-8px] group-hover:translate-x-0 transition-transform" />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div
                                    onClick={() => {
                                        const params = new URLSearchParams(searchParams.toString());
                                        params.set('id', 'new');
                                        router.push(`${window.location.pathname}?${params.toString()}`);
                                    }}
                                    className="group flex flex-col items-center justify-center gap-4 rounded-[32px] border-2 border-dashed border-[var(--border-strong)] p-12 cursor-pointer transition-all hover:bg-[var(--surface-secondary)] hover:border-indigo-500/50 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        <Plus className="w-8 h-8" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-[var(--text-primary)] group-hover:text-indigo-500 transition-colors uppercase tracking-widest text-xs">Initialize New</p>
                                        <p className="text-[10px] text-[var(--text-tertiary)] font-medium uppercase mt-1">From scratch</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-12">
                            {/* Form Area */}
                            <div className="flex-1">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentStep}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {/* Recovery Banner */}
                                        <AnimatePresence>
                                            {showRecoveryBanner && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mb-8 p-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-[24px] shadow-2xl shadow-indigo-500/20">
                                                        <div className="bg-[var(--surface-base)] rounded-[20px] p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                                                            <div className="flex items-center gap-5">
                                                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                                                    <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[13px] font-black uppercase tracking-wider text-[var(--text-primary)]">Sequence Recovery Available</p>
                                                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1 opacity-60">High-fidelity session state detected</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        if (localRecoveryData) {
                                                                            setFormData(localRecoveryData);
                                                                            setShowRecoveryBanner(false);
                                                                        }
                                                                    }}
                                                                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-500/30"
                                                                >
                                                                    Restore Snapshot
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowRecoveryBanner(false)}
                                                                    className="px-6 py-3 bg-[var(--surface-secondary)] text-[var(--text-tertiary)] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[var(--surface-tertiary)] transition-all"
                                                                >
                                                                    Ignore
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {currentStep === 'identity' && (
                                            <IdentityStep
                                                formData={formData}
                                                updateFormData={updateFormData}
                                                validationErrors={validationErrors}
                                                role={role}
                                                partnerships={partnerships}
                                                profile={profile}
                                            />
                                        )}

                                        {currentStep === 'scheduling' && (
                                            <SchedulingStep
                                                formData={formData}
                                                updateFormData={updateFormData}
                                                validationErrors={validationErrors}
                                                role={role}
                                                profile={profile}
                                            />
                                        )}

                                        {currentStep === 'experience' && (
                                            <ExperienceStep
                                                formData={formData}
                                                updateFormData={updateFormData}
                                                validationErrors={validationErrors}
                                            />
                                        )}

                                        {currentStep === 'ticketing' && (
                                            <TicketTierStep
                                                formData={formData}
                                                updateFormData={updateFormData}
                                                validationErrors={validationErrors}
                                            />
                                        )}

                                        {currentStep === 'tables' && (
                                            <TableBookingStep
                                                formData={formData}
                                                updateFormData={updateFormData}
                                                validationErrors={validationErrors}
                                            />
                                        )}

                                        {currentStep === 'promoters' && (
                                            <PromoterStep
                                                formData={formData}
                                                updateFormData={updateFormData}
                                            />
                                        )}

                                        {currentStep === 'media' && (
                                            <MediaStep
                                                formData={formData}
                                                updateFormData={updateFormData}
                                            />
                                        )}

                                        {currentStep === 'review' && (
                                            <div className="space-y-8">
                                                {/* Balance Sheet - UNCHANGED */}
                                                <DetailedBreakdown formData={formData} />
                                            </div>
                                        )}

                                        {/* Navigation Footer */}
                                        <div className="flex items-center justify-between mt-12 pt-8 border-t border-[var(--border-subtle)]">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={prevStep}
                                                    className="btn btn-secondary flex items-center gap-2"
                                                >
                                                    <ChevronLeft className="w-4 h-4" /> Back
                                                </button>
                                                <button
                                                    onClick={() => handleSubmit(true)}
                                                    className="text-[15px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors font-medium"
                                                >
                                                    Save Draft
                                                </button>
                                            </div>

                                            {currentStep === 'review' ? (
                                                <button
                                                    disabled={isSubmitting}
                                                    onClick={() => setShowPublishModal(true)}
                                                    className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    Continue <ChevronRight className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={nextStep}
                                                    className="btn btn-primary flex items-center gap-2"
                                                >
                                                    Continue <ChevronRight className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Preview Sidebar */}
                            <div className="w-full lg:w-[360px] lg:sticky lg:top-8 self-start space-y-6">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-label">Live Preview</span>
                                    <SaveStatus status={saveState} />
                                </div>

                                <div className="flex justify-center">
                                    <div
                                        className="w-[320px] h-[420px] rounded-[32px] overflow-hidden shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform"
                                        onClick={() => setIsFullPagePreviewOpen(true)}
                                    >
                                        <EventCard
                                            event={formData}
                                            isPreview={true}
                                            device="desktop"
                                            height="h-full"
                                        />
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="px-2 space-y-3">
                                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                                        <span className="text-caption text-[var(--text-tertiary)]">Inventory Value</span>
                                        <span className="text-body font-bold text-[var(--text-primary)]">{formatCurrency(grandTotal.value)}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                                        <span className="text-caption text-[var(--text-tertiary)]">Total Capacity</span>
                                        <span className="text-body font-bold text-[var(--text-primary)]">{grandTotal.quantity}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-caption">Ticket Tiers</span>
                                        <span className="text-body font-bold">{formData.tickets?.length || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Full Page Preview Modal */}
            <AnimatePresence>
                {isFullPagePreviewOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black"
                    >
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900">
                                <button
                                    onClick={() => setIsFullPagePreviewOpen(false)}
                                    className="flex items-center gap-2 text-white hover:text-stone-300"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    <span className="text-[11px] font-bold uppercase">Back to Wizard</span>
                                </button>
                                <span className="text-[11px] font-bold uppercase text-white/40">Preview Mode</span>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <EventPage
                                    event={{
                                        ...formData,
                                        id: "preview-id",
                                        host: profile?.activeMembership?.partnerName || "Host",
                                        settings: { showGuestlist }
                                    }}
                                    host={{
                                        name: profile?.activeMembership?.partnerName || "Host",
                                        avatar: "/events/holi-edit.svg",
                                        followers: 0,
                                        location: formData.city || "India",
                                        bio: "Preview mode"
                                    }}
                                    isPreview={true}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Publish Confirmation Modal */}
            <PublishConfirmationModal
                isOpen={showPublishModal}
                onClose={() => setShowPublishModal(false)}
                onConfirm={() => handleSubmit(false)}
                isSubmitting={isSubmitting}
                formData={formData}
                role={role}
            />
        </>
    );
}
