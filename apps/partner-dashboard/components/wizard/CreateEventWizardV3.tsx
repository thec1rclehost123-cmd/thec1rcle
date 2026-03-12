"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Loader2, Eye, Check, AlertCircle } from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useRouter, useSearchParams } from "next/navigation";

import { WizardStepNav, WizardStepV3 } from "./WizardStepNav";
import { WizardRightRail } from "./WizardRightRail";
import { FoundationStepV3 } from "./steps/FoundationStepV3";
import { ScheduleStepV3 } from "./steps/ScheduleStepV3";
import { CapacityStepV3 } from "./steps/CapacityStepV3";
import { RevenueStepV3 } from "./steps/RevenueStepV3";
import { MediaStepV3 } from "./steps/MediaStepV3";
import { ReviewStepV3 } from "./steps/ReviewStepV3";

// ─── Revenue engine (extracted from DetailedBreakdown logic) ──────────────────

function computeRevenue(formData: any) {
    let ticketRevenue = 0, tableRevenue = 0, coverRevenue = 0;
    let promoterPool = 0, discounts = 0;

    const promotersEnabled = formData.promotersEnabled === true;
    const buyerDiscountsEnabled = formData.buyerDiscountsEnabled === true;

    for (const tier of formData.tickets || []) {
        const price = Number(tier.price) || 0;
        const qty = Number(tier.quantity) || 0;
        const value = price * qty;
        ticketRevenue += value;

        if (promotersEnabled && price > 0) {
            const commRate = tier.overrideCommission ? (Number(tier.promoterCommission) || 0) : (Number(formData.commission) || 15);
            const commType = tier.overrideCommission ? (tier.promoterCommissionType || 'percent') : (formData.commissionType || 'percent');
            promoterPool += commType === 'percent' ? (value * commRate / 100) : (commRate * qty);

            if (buyerDiscountsEnabled && tier.promoterEnabled) {
                const discRate = tier.overrideDiscount ? (Number(tier.promoterDiscount) || 0) : (Number(formData.discount) || 10);
                const discType = tier.overrideDiscount ? (tier.promoterDiscountType || 'percent') : (formData.discountType || 'percent');
                discounts += discType === 'percent' ? (value * discRate / 100) : (discRate * qty);
            }
        }
    }

    for (const tbl of formData.tables || []) {
        const price = Number(tbl.price) || 0;
        const qty = Number(tbl.quantity) || 0;
        tableRevenue += price * qty;
    }

    if (formData.walkInEnabled) {
        const walkInCap = Number(formData.walkInAllocation) || 0;
        const coverPrice = Number(formData.coverPrice || formData.walkInCoverPrice) || 0;
        coverRevenue += coverPrice * walkInCap;
    }

    const gross = ticketRevenue + tableRevenue + coverRevenue;
    const net = gross - promoterPool - discounts;
    return { gross, net, promoterPool, discounts, ticketRevenue, tableRevenue, coverRevenue };
}

// ─── Capacity engine ────────────────────────────────────────────────────────────

function computeCapacity(formData: any) {
    const total = Number(formData.capacity) || 0;
    const ticketAlloc = Number(formData.ticketAllocation) || 0;
    const guestListAlloc = Number(formData.guestListAllocation) || 0;
    const walkInAlloc = Number(formData.walkInAllocation) || 0;
    const tableAlloc = Number(formData.tableAllocation) || 0;
    const staffHold = Number(formData.staffHold) || 0;

    const allocated = ticketAlloc + guestListAlloc + walkInAlloc + tableAlloc + staffHold;
    const unallocated = Math.max(0, total - allocated);

    return { total, ticketAlloc, guestListAlloc, walkInAlloc, tableAlloc, staffHold, unallocated, allocated };
}

// ─── Step validation ────────────────────────────────────────────────────────────

function computeStepIssues(formData: any, role: string): Record<WizardStepV3, string[]> {
    const cap = computeCapacity(formData);

    return {
        foundation: [
            !formData.title && 'Event name is required',
            !formData.eventType && 'Select an event type',
            (role === 'host' && !formData.venueId) && 'Select a venue partner',
        ].filter(Boolean) as string[],

        schedule: [
            !formData.startDate && 'Event date is required',
        ].filter(Boolean) as string[],

        capacity: [
            cap.total > 0 && cap.allocated > cap.total && `Allocation exceeds capacity by ${cap.allocated - cap.total}`,
        ].filter(Boolean) as string[],

        revenue: [
            formData.tablesEnabled && formData.tables?.length === 0 && 'Tables enabled but no packages created',
        ].filter(Boolean) as string[],

        media: [],
        review: [],
    };
}

// ─── Step config ────────────────────────────────────────────────────────────────

const STEPS: WizardStepV3[] = ['foundation', 'schedule', 'capacity', 'revenue', 'media', 'review'];

const STEP_LABELS: Record<WizardStepV3, string> = {
    foundation: 'Foundation',
    schedule:   'Schedule',
    capacity:   'Capacity & Entry',
    revenue:    'Revenue Design',
    media:      'Media & Experience',
    review:     'Review & Publish',
};

const STEP_SUBTITLES: Record<WizardStepV3, string> = {
    foundation: 'Define what this event is',
    schedule:   'When it happens',
    capacity:   'Who comes in and how',
    revenue:    'How the night makes money',
    media:      'What guests see',
    review:     'Final check before launch',
};

// ─── Save status indicator ──────────────────────────────────────────────────────

function SaveStatus({ status }: { status: 'saved' | 'saving' | 'failed' | 'idle' }) {
    if (status === 'idle') return null;
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
            status === 'saving' ? 'border-white/[0.08] bg-white/[0.03]' :
            status === 'saved'  ? 'border-emerald-500/20 bg-emerald-500/[0.07]' :
                                  'border-red-500/20 bg-red-500/[0.07]'
        }`}>
            {status === 'saving' && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
            {status === 'saved'  && <Check className="w-3 h-3 text-emerald-400" />}
            {status === 'failed' && <AlertCircle className="w-3 h-3 text-red-400" />}
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
                status === 'saving' ? 'text-white/40' : status === 'saved' ? 'text-emerald-400' : 'text-red-400'
            }`}>
                {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed'}
            </span>
        </div>
    );
}

// ─── Main Wizard Component ──────────────────────────────────────────────────────

interface CreateEventWizardV3Props {
    role: 'venue' | 'host';
}

export function CreateEventWizardV3({ role }: CreateEventWizardV3Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile, user } = useDashboardAuth();

    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        const token = await user.getIdToken(true);
        return fetch(url, { ...options, headers: { ...options.headers, "Authorization": `Bearer ${token}` } });
    }, [user]);

    // ─── Core state ─────────────────────────────────────────────────────────────

    const [currentStep, setCurrentStep] = useState<WizardStepV3>('foundation');
    const [completedSteps, setCompletedSteps] = useState<WizardStepV3[]>([]);
    const [unlockedUpTo, setUnlockedUpTo] = useState(0);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
    const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
    const [partnerships, setPartnerships] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // ─── Form data ───────────────────────────────────────────────────────────────

    const [formData, setFormData] = useState<any>(() => ({
        // V3 new fields
        eventType: '',
        privacyMode: 'public',
        guestListEnabled: false,
        guestListCap: '',
        guestListCapPerPromoter: '',
        guestListAutoApprove: true,
        ticketAllocation: '',
        guestListAllocation: '',
        walkInAllocation: '',
        tableAllocation: '',
        staffHold: '',
        walkInEnabled: false,
        walkInCoverPrice: '',
        coverPrice: '',
        coverEnabled: false,
        highlights: [],
        vibes: [],
        recurrence: 'none',
        recurrenceEndType: 'count',
        recurrenceCount: 4,
        recurrenceEndDate: '',
        seriesEditScope: 'this',
        isOvernight: false,
        dynamicPricingEnabled: false,
        ticketSalesEnd: '',
        guestListClose: '',
        ageVerificationRequired: false,
        reentryAllowed: true,
        scanMode: 'both',

        // V2 preserved fields
        title: '',
        subtitle: '',
        summary: '',
        description: '',
        category: 'Music',
        city: 'Pune',
        startDate: '',
        startTime: '21:00',
        endTime: '03:00',
        doorsOpen: '',
        lastEntry: '',
        venueId: '',
        venueName: '',
        address: '',
        pincode: '',
        mapsLink: '',
        arrivalInstructions: '',
        capacity: 500,
        artists: [],
        genres: [],
        dressCode: 'smart_casual',
        themeDescription: '',
        ageRestriction: '21+',
        tickets: [
            { id: 'ga', name: 'General Admission', entryType: 'general', price: 500, quantity: 400, minPerOrder: 1, maxPerOrder: 10, promoterEnabled: true }
        ],
        tables: [],
        tablesEnabled: false,
        promotersEnabled: true,
        commission: 15,
        commissionType: 'percent',
        useDefaultCommission: true,
        buyerDiscountsEnabled: false,
        discount: 10,
        discountType: 'percent',
        useDefaultDiscount: true,
        images: [],
        poster: '',
        lifecycle: 'draft',
        creatorRole: role,
        creatorId: '',
        draftMeta: {
            wizardVersion: '3.0',
            lastStep: 'foundation',
            completionPercent: 0,
            lastSavedAt: new Date().toISOString(),
            clientUpdatedAt: Date.now()
        }
    }));

    const updateFormData = useCallback((updates: any) => {
        setFormData((prev: any) => ({ ...prev, ...updates }));
    }, []);

    // ─── Derived state ────────────────────────────────────────────────────────────

    const currentStepIndex = STEPS.indexOf(currentStep);
    const stepIssues = useMemo(() => computeStepIssues(formData, role), [formData, role]);
    const revenue = useMemo(() => computeRevenue(formData), [formData]);
    const capacity = useMemo(() => computeCapacity(formData), [formData]);

    // ─── Prefill from URL params (from venue calendar) ─────────────────────────

    useEffect(() => {
        const venueId = searchParams.get('venue');
        const venueName = searchParams.get('venueName');
        const date = searchParams.get('date');
        const startTime = searchParams.get('startTime');
        const endTime = searchParams.get('endTime');
        if (venueId && date && startTime && endTime) {
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

    // ─── Load draft from Firestore via URL id param ─────────────────────────────

    useEffect(() => {
        const eventId = searchParams.get('id');
        if (eventId && eventId !== 'new' && eventId !== savedDraftId && !isLoadingDraft) {
            const fetchDraft = async () => {
                setIsLoadingDraft(true);
                try {
                    const res = await authedFetch(`/api/events/${eventId}`);
                    if (!res.ok) return;
                    const data = await res.json();
                    if (data.event) {
                        setFormData((prev: any) => ({ ...prev, ...data.event }));
                        setSavedDraftId(eventId);
                    }
                } catch (err) {
                    console.error("[WizardV3] Failed to load draft", err);
                } finally {
                    setIsLoadingDraft(false);
                }
            };
            fetchDraft();
        }
    }, [searchParams, savedDraftId, isLoadingDraft, authedFetch]);

    // ─── localStorage crash recovery ─────────────────────────────────────────────

    useEffect(() => {
        if (!profile?.uid || isLoadingDraft) return;
        const currentId = searchParams.get('id') || 'new';
        const storageKey = `c1rcle_draft_event_v3_${profile.uid}_${currentId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored && currentId === 'new') {
            try {
                const localData = JSON.parse(stored);
                if (localData.title) setFormData((prev: any) => ({ ...prev, ...localData }));
            } catch (e) {
                // ignore parse errors
            }
        }
    }, [profile?.uid, searchParams, isLoadingDraft]);

    // ─── localStorage autosave ────────────────────────────────────────────────────

    useEffect(() => {
        if (!profile?.uid) return;
        const currentId = searchParams.get('id') || 'new';
        const storageKey = `c1rcle_draft_event_v3_${profile.uid}_${currentId}`;
        localStorage.setItem(storageKey, JSON.stringify({
            ...formData,
            draftMeta: { ...formData.draftMeta, lastStep: currentStep, clientUpdatedAt: Date.now() }
        }));
    }, [formData, profile?.uid, currentStep, searchParams]);

    // ─── Remote autosave (3s debounce) ────────────────────────────────────────────

    useEffect(() => {
        if (!formData.title && !formData.description) return;
        const timer = setTimeout(async () => {
            setSaveState('saving');
            try {
                const method = savedDraftId ? 'PATCH' : 'POST';
                const url = savedDraftId ? `/api/events/${savedDraftId}` : '/api/events/create';
                const res = await authedFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...formData,
                        lifecycle: 'draft',
                        creatorId: profile?.activeMembership?.partnerId || profile?.uid,
                        hostData: role === 'host' ? {
                            id: profile?.activeMembership?.partnerId,
                            name: profile?.activeMembership?.partnerName || profile?.displayName,
                        } : null,
                        venueData: role === 'venue' ? {
                            id: profile?.activeMembership?.partnerId,
                            name: profile?.activeMembership?.partnerName,
                        } : null,
                        draftMeta: {
                            wizardVersion: '3.0',
                            lastStep: currentStep,
                            completionPercent: Math.round(((currentStepIndex + 1) / STEPS.length) * 100),
                            lastSavedAt: new Date().toISOString(),
                            clientUpdatedAt: Date.now()
                        }
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    setSaveState('saved');
                    if (!savedDraftId && data.event?.id) {
                        setSavedDraftId(data.event.id);
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.set('id', data.event.id);
                        window.history.replaceState({}, '', newUrl.toString());
                    }
                } else {
                    setSaveState('failed');
                }
            } catch {
                setSaveState('failed');
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [formData, savedDraftId, authedFetch, profile, currentStep, currentStepIndex, role]);

    // ─── Fetch partnerships for hosts ─────────────────────────────────────────────

    useEffect(() => {
        if (role === 'host' && profile?.activeMembership?.partnerId) {
            authedFetch(`/api/venue/partnerships?hostId=${profile.activeMembership.partnerId}&status=active`)
                .then(r => r.json())
                .then(d => setPartnerships(d.partnerships || []))
                .catch(err => console.error('[WizardV3] partnerships', err));
        }
    }, [role, profile?.activeMembership?.partnerId, authedFetch]);

    // ─── Navigation ───────────────────────────────────────────────────────────────

    const validateStep = (step: WizardStepV3): boolean => {
        const issues = stepIssues[step];
        if (issues.length > 0) {
            const errors: Record<string, string> = {};
            issues.forEach((issue, i) => { errors[`step_${step}_${i}`] = issue; });
            setValidationErrors(errors);
            return false;
        }
        setValidationErrors({});
        return true;
    };

    const goToStep = (step: WizardStepV3) => {
        setCurrentStep(step);
        const idx = STEPS.indexOf(step);
        setUnlockedUpTo(prev => Math.max(prev, idx));
    };

    const nextStep = () => {
        if (!validateStep(currentStep)) return;
        if (!completedSteps.includes(currentStep)) {
            setCompletedSteps(prev => [...prev, currentStep]);
        }
        if (currentStepIndex < STEPS.length - 1) {
            goToStep(STEPS[currentStepIndex + 1]);
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) {
            goToStep(STEPS[currentStepIndex - 1]);
        } else {
            router.back();
        }
    };

    // ─── Publish ──────────────────────────────────────────────────────────────────

    const handlePublish = useCallback(async (action: 'draft' | 'publish' | 'schedule') => {
        if (action === 'publish') {
            const allIssues = Object.values(stepIssues).flat();
            if (allIssues.filter(Boolean).length > 0) return;
        }

        setIsSubmitting(true);
        try {
            const lifecycle = action === 'draft' ? 'draft' : (role === 'host' ? 'submitted' : 'scheduled');
            const method = savedDraftId ? 'PATCH' : 'POST';
            const url = savedDraftId ? `/api/events/${savedDraftId}` : '/api/events/create';

            const res = await authedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    lifecycle,
                    creatorId: profile?.activeMembership?.partnerId || profile?.uid,
                    hostData: role === 'host' ? {
                        id: profile?.activeMembership?.partnerId,
                        name: profile?.activeMembership?.partnerName || profile?.displayName,
                    } : null,
                    venueData: role === 'venue' ? {
                        id: profile?.activeMembership?.partnerId,
                        name: profile?.activeMembership?.partnerName,
                    } : null,
                })
            });

            if (!res.ok) throw new Error('Publish failed');
            const data = await res.json();
            const eventId = data.event?.id || savedDraftId;

            // For hosts: auto-create slot request
            if (role === 'host' && action !== 'draft' && eventId && formData.venueId) {
                await authedFetch('/api/slots', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventId,
                        hostId: profile?.activeMembership?.partnerId,
                        hostName: profile?.activeMembership?.partnerName || profile?.displayName,
                        venueId: formData.venueId,
                        venueName: formData.venueName,
                        requestedDate: formData.startDate,
                        requestedStartTime: formData.startTime,
                        requestedEndTime: formData.endTime,
                    })
                });
            }

            // Clear local storage
            const storageKey = `c1rcle_draft_event_v3_${profile?.uid}_${savedDraftId || 'new'}`;
            localStorage.removeItem(storageKey);

            router.push(role === 'venue' ? '/venue/events' : '/host/events');
        } catch (err) {
            console.error('[WizardV3] Publish error', err);
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, savedDraftId, role, profile, authedFetch, stepIssues, router]);

    // ─── Loading state ────────────────────────────────────────────────────────────

    if (isLoadingDraft) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/30" />
            </div>
        );
    }

    // ─── Render ────────────────────────────────────────────────────────────────────

    const currentIssues = stepIssues[currentStep];
    const isLastStep = currentStepIndex === STEPS.length - 1;
    const canPublish = Object.values(stepIssues).every(issues => issues.length === 0);

    return (
        <div className="min-h-screen bg-[var(--surface-base)]">
            {/* ─── Top bar ──────────────────────────────────────────────────────── */}
            <div className="sticky top-0 z-20 bg-[var(--surface-base)]/95 backdrop-blur-xl border-b border-white/[0.06]">
                <div className="max-w-[1400px] mx-auto px-6">
                    <div className="flex items-center justify-between h-16">
                        {/* Left: back + title */}
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div>
                                <h1 className="text-[14px] font-bold text-white">Create Event</h1>
                                <p className="text-[10px] text-white/30">Build something extraordinary</p>
                            </div>
                        </div>

                        {/* Right: save status + preview */}
                        <div className="flex items-center gap-3">
                            <SaveStatus status={saveState} />
                            {savedDraftId && (
                                <a
                                    href={`/events/${savedDraftId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[10px] font-semibold text-white/45 hover:text-white/70 hover:border-white/[0.12] transition-all"
                                >
                                    <Eye className="w-3 h-3" />
                                    Preview
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Step navigation — below the top bar inside the sticky container */}
                    <div className="pb-4">
                        <WizardStepNav
                            currentStep={currentStep}
                            completedSteps={completedSteps}
                            stepIssues={stepIssues}
                            onStepClick={goToStep}
                            unlockedUpTo={unlockedUpTo}
                        />
                    </div>
                </div>
            </div>

            {/* ─── Body: two-column layout ──────────────────────────────────────── */}
            <div className="max-w-[1400px] mx-auto px-6 py-8">
                <div className="flex gap-8 items-start">

                    {/* ── Left: primary workspace ──────────────────────────────── */}
                    <div className="flex-[2] min-w-0 space-y-6">

                        {/* Step header */}
                        <div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <h2 className="text-[22px] font-bold text-white tracking-tight">
                                        {STEP_LABELS[currentStep]}
                                    </h2>
                                    <p className="text-[12px] text-white/35 mt-1">
                                        {STEP_SUBTITLES[currentStep]}
                                    </p>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Validation issues banner */}
                        <AnimatePresence>
                            {currentIssues.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                    className="rounded-xl bg-red-500/[0.07] border border-red-500/25 p-4"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[11px] font-bold text-red-300 uppercase tracking-widest mb-1.5">Complete the following</p>
                                            <ul className="space-y-1">
                                                {currentIssues.map((issue, i) => (
                                                    <li key={i} className="text-[11px] text-red-300/80 font-medium">• {issue}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── Step content ─────────────────────────────────────── */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                {currentStep === 'foundation' && (
                                    <FoundationStepV3
                                        formData={formData}
                                        updateFormData={updateFormData}
                                        validationErrors={validationErrors}
                                        role={role}
                                        partnerships={partnerships}
                                        profile={profile}
                                    />
                                )}
                                {currentStep === 'schedule' && (
                                    <ScheduleStepV3
                                        formData={formData}
                                        updateFormData={updateFormData}
                                        validationErrors={validationErrors}
                                    />
                                )}
                                {currentStep === 'capacity' && (
                                    <CapacityStepV3
                                        formData={formData}
                                        updateFormData={updateFormData}
                                        validationErrors={validationErrors}
                                    />
                                )}
                                {currentStep === 'revenue' && (
                                    <RevenueStepV3
                                        formData={formData}
                                        updateFormData={updateFormData}
                                        validationErrors={validationErrors}
                                    />
                                )}
                                {currentStep === 'media' && (
                                    <MediaStepV3
                                        formData={formData}
                                        updateFormData={updateFormData}
                                    />
                                )}
                                {currentStep === 'review' && (
                                    <ReviewStepV3
                                        formData={formData}
                                        revenue={revenue}
                                        capacity={capacity}
                                        onStepJump={goToStep}
                                        onPublish={handlePublish}
                                        isSubmitting={isSubmitting}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* ── Navigation buttons ───────────────────────────────── */}
                        {!isLastStep && (
                            <div className="flex items-center justify-between pt-6 border-t border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={prevStep}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[12px] font-semibold text-white/50 hover:text-white/80 hover:border-white/[0.14] transition-all"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    {currentStepIndex === 0 ? 'Cancel' : 'Back'}
                                </button>
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#F44A22] text-[12px] font-bold text-white hover:bg-[#e0421e] transition-all shadow-lg shadow-[#F44A22]/20"
                                >
                                    Continue to {STEP_LABELS[STEPS[currentStepIndex + 1]]}
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {/* Back button on review step */}
                        {isLastStep && (
                            <div className="pt-6 border-t border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={prevStep}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[12px] font-semibold text-white/50 hover:text-white/80 hover:border-white/[0.14] transition-all"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    Back to Media
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Right: contextual rail ───────────────────────────────── */}
                    <div className="flex-[1] min-w-[280px] max-w-[360px] hidden lg:block">
                        <div className="sticky top-[140px]">
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 overflow-hidden">
                                <WizardRightRail
                                    formData={formData}
                                    currentStep={currentStep}
                                    revenue={revenue}
                                    capacity={capacity}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
