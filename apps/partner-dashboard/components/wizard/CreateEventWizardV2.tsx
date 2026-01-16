"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Calendar, Music, Ticket, Wine, Percent,
    Image as ImageIcon, CheckCircle2, ChevronRight, ChevronLeft,
    AlertCircle, Loader2, MapPin
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
    const { profile } = useDashboardAuth();

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
                    const res = await fetch(`/api/venue/partnerships?hostId=${profile.activeMembership.partnerId}&status=active`);
                    const data = await res.json();
                    setPartnerships(data.partnerships || []);
                } catch (err) {
                    console.error("Failed to fetch partnerships", err);
                }
            };
            fetchPartnerships();
        }
    }, [role, profile?.activeMembership?.partnerId]);

    // Hydrate creatorId
    useEffect(() => {
        if (profile?.activeMembership?.partnerId || profile?.uid) {
            const preferredId = profile.activeMembership?.partnerId || profile.uid;
            if (formData.creatorId !== preferredId) {
                updateFormData({ creatorId: preferredId });
            }
        }
    }, [profile, formData.creatorId, updateFormData]);

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
                        const res = await fetch(`/api/events/${savedDraftId}`, {
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
                        const res = await fetch('/api/events/create', {
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
    }, [formData, savedDraftId, profile, role, router, currentStep, searchParams]);

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

            const payload: any = {
                ...formData,
                venue: formData.venue || formData.venueName || "TBD",
                location: formData.venue || formData.venueName || formData.address || "TBD",
                host: profile?.activeMembership?.partnerName || profile?.displayName || "C1RCLE Partner",
                hostId: role === 'host' ? (profile?.activeMembership?.partnerId || profile?.uid) : formData.hostId,
                venueId: role === 'venue' ? (profile?.activeMembership?.partnerId) : formData.venueId,
                creatorId: profile?.activeMembership?.partnerId || profile?.uid,
                creatorRole: formData.creatorRole || role,
                lifecycle: isDraft ? 'draft' : (role === 'venue' ? 'scheduled' : 'submitted'),
                status: 'active',
                settings: { ...(formData.settings || {}), showGuestlist }
            };

            const res = await fetch(endpoint, {
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

    // Loading State
    if (isLoadingDraft) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-body text-muted">Loading your draft...</p>
                </div>
            </div>
        );
    }

    // Success State
    if (isSuccess) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full text-center"
                >
                    <div className="mb-8 relative inline-block">
                        <div className="absolute inset-0 bg-indigo-100 rounded-full scale-150 blur-2xl opacity-50" />
                        <div className="relative bg-indigo-600 rounded-full p-6 shadow-xl shadow-indigo-200">
                            <CheckCircle2 className="h-12 w-12 text-white" />
                        </div>
                    </div>
                    <h1 className="text-display mb-4">Event {role === 'venue' ? 'Published' : 'Submitted'}!</h1>
                    <p className="text-body text-muted mb-12">
                        {role === 'venue'
                            ? "Your event is now live and ready for guests to discover."
                            : "Your event has been submitted to the venue for review."}
                    </p>
                    <button
                        onClick={() => router.push(role === 'venue' ? '/venue/events' : '/host/events')}
                        className="btn btn-primary w-full py-4 text-[15px]"
                    >
                        Go to Dashboard
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-white">
                <div className="max-w-6xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-display">Create Event</h1>
                            <p className="text-body text-muted">Build something extraordinary</p>
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
                                    <div className="flex items-center justify-between mt-12 pt-8 border-t border-[rgba(0,0,0,0.06)]">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={prevStep}
                                                className="btn btn-secondary flex items-center gap-2"
                                            >
                                                <ChevronLeft className="w-4 h-4" /> Back
                                            </button>
                                            <button
                                                onClick={() => handleSubmit(true)}
                                                className="text-[15px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
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
                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                    <span className="text-caption">Inventory Value</span>
                                    <span className="text-body font-bold">{formatCurrency(grandTotal.value)}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                    <span className="text-caption">Total Capacity</span>
                                    <span className="text-body font-bold">{grandTotal.quantity}</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-caption">Ticket Tiers</span>
                                    <span className="text-body font-bold">{formData.tickets?.length || 0}</span>
                                </div>
                            </div>
                        </div>
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
            </div>
        </>
    );
}
