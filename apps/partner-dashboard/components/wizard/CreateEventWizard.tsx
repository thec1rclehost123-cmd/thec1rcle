"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar,
    Clock,
    MapPin,
    ShieldCheck,
    Users,
    Ticket,
    Zap,
    Image as ImageIcon,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    AlertCircle,
    Building2,
    ArrowRight,
    Check,
    Plus,
    X,
    Upload,
    Loader2
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { MediaStep } from "./MediaStep";
import { VenueStep } from "./VenueStep";
import { formatEventDate } from "@c1rcle/core/time";
import { TicketTierStep } from "./TicketTierStep";
import { PromoterStep } from "./PromoterStep";
import { TableBookingStep } from "./TableBookingStep";
import { PublishConfirmationModal } from "./PublishConfirmationModal";
import { EventCard, EventPage } from "@c1rcle/ui";
import { useDebounce } from "@/lib/hooks/useDebounce";



type WizardStep = 'basics' | 'venue' | 'capacity' | 'ticketing' | 'tables' | 'promoters' | 'media' | 'review';

const STEPS: { id: WizardStep; label: string }[] = [
    { id: 'basics', label: 'Details' },
    { id: 'venue', label: 'Venue' },
    { id: 'capacity', label: 'Capacity' },
    { id: 'ticketing', label: 'Tickets' },
    { id: 'tables', label: 'Tables' },
    { id: 'promoters', label: 'Sales' },
    { id: 'media', label: 'Media' },
    { id: 'review', label: 'Review' },
];

// Apple-style Input Component
function AppleInput({
    label,
    error,
    className = "",
    ...props
}: {
    label?: string;
    error?: string;
    className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-[13px] font-medium text-[#86868b]">
                    {label}
                </label>
            )}
            <input
                className={`w-full apple-input ${error ? 'apple-input-error' : ''} ${className}`}
                {...props}
            />
            {error && (
                <p className="text-[13px] text-[#ff3b30] font-medium">
                    {error}
                </p>
            )}
        </div>
    );
}

// Apple-style Select Component
function AppleSelect({
    label,
    options,
    value,
    onChange,
}: {
    label?: string;
    options: { label: string; value: string }[];
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-[13px] font-medium text-[#86868b]">
                    {label}
                </label>
            )}
            <select
                value={value}
                onChange={onChange}
                className="w-full apple-input appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2386868b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_16px_center]"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

// Apple-style TextArea Component
function AppleTextArea({
    label,
    className = "",
    ...props
}: {
    label?: string;
    className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-[13px] font-medium text-[#86868b]">
                    {label}
                </label>
            )}
            <textarea
                className={`w-full apple-input resize-none ${className}`}
                {...props}
            />
        </div>
    );
}

// formatDate removed, using formatEventDate from core

// Minimal Preview Card - Now using shared EventCard
function PreviewCard({ formData, device, showDemoHover }: { formData: any, device: string, showDemoHover: boolean }) {
    return (
        <div className={`p-4 rounded-3xl border border-[rgba(0,0,0,0.06)] bg-white shadow-sm overflow-hidden transition-all dark:bg-[#030303] dark:border-white/10 ${device === 'mobile' ? 'max-w-[360px] mx-auto' : 'w-full'}`}>
            <div className="dark">
                <EventCard
                    event={formData}
                    isPreview={true}
                    showDemoHover={showDemoHover}
                    device={device}
                    height={device === 'mobile' ? "h-[420px]" : "h-[420px]"}
                />
            </div>
        </div>
    );
}

// Stats Card
function StatsCard({ formData }: { formData: any }) {
    const inventoryValue = formData.tickets?.reduce((acc: number, t: any) => acc + (Number(t.price) * Number(t.quantity) || 0), 0) || 0;
    const totalTickets = formData.tickets?.reduce((sum: number, t: any) => sum + (Number(t.quantity) || 0), 0) || 0;

    return (
        <div className="apple-glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#86868b]">Inventory Value</span>
                <span className="text-[17px] font-semibold text-[#1d1d1f]">₹{inventoryValue.toLocaleString()}</span>
            </div>
            <div className="apple-divider" />
            <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#86868b]">Total Capacity</span>
                <span className="text-[17px] font-semibold text-[#1d1d1f]">{formData.capacity || 0}</span>
            </div>
            <div className="apple-divider" />
            <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#86868b]">Ticket Tiers</span>
                <span className="text-[17px] font-semibold text-[#1d1d1f]">{formData.tickets?.length || 0}</span>
            </div>
        </div>
    );
}

export function CreateEventWizard({ role }: { role: 'club' | 'host' }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useDashboardAuth();
    const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [showDemoHover, setShowDemoHover] = useState(false);
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
    const [savedDraftId, setSavedDraftId] = useState<string | null>(searchParams.get('id'));
    const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
    const [isFullPagePreviewOpen, setIsFullPagePreviewOpen] = useState(false);
    const [showGuestlist, setShowGuestlist] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [createdEventId, setCreatedEventId] = useState<string | null>(null);

    // Initialize form data
    const [formData, setFormData] = useState<any>(() => {
        const defaultData = {
            title: "",
            summary: "",
            description: "",
            category: "Music",
            city: "Pune",
            startDate: "",
            startTime: "21:00",
            endTime: "03:00",
            venueId: "",
            venueName: "",
            address: "",
            pincode: "",
            mapsLink: "",
            capacity: 500,
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
            promotersEnabled: true,
            commission: 15,
            commissionType: "percent",
            images: [],
            lifecycle: 'draft',
            creatorRole: role,
            creatorId: "",
        };

        return defaultData;
    });

    const [partnerships, setPartnerships] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const isReviewMode = role === 'club' && formData.creatorRole === 'host';
    const isLocked = (role === 'host' && (formData.lifecycle === 'submitted' || formData.lifecycle === 'scheduled' || formData.lifecycle === 'live')) || (isReviewMode && searchParams.get('mode') === 'review');

    // Fetch remote draft if ID is in URL
    useEffect(() => {
        const eventId = searchParams.get('id');
        // Only fetch if we have an ID, we're not currently loading, 
        // we haven't already loaded this ID, and there's no error for it
        if (eventId && !isLoadingDraft && formData.id !== eventId && !loadError) {
            const fetchDraft = async () => {
                setIsLoadingDraft(true);
                try {
                    const res = await fetch(`/api/events/${eventId}`);
                    if (!res.ok) throw new Error("Failed to load event draft.");
                    const data = await res.json();
                    if (data.event) {
                        setFormData((prev: any) => ({ ...prev, ...data.event }));
                        setSavedDraftId(data.event.id);
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
    }, [searchParams, formData.id, loadError]);

    useEffect(() => {
        if (!profile?.activeMembership) return;

        // Skip auto-fill if we are loading an existing event
        if (searchParams.get('id')) return;

        if (role === 'host') {
            fetchPartnerships();

            // Handle pre-populated venue from URL
            const venueIdParam = searchParams.get('venue');
            if (venueIdParam && partnerships.length > 0) {
                const preselected = partnerships.find(p => p.clubId === venueIdParam);
                if (preselected && formData.venueId !== preselected.clubId) {
                    setFormData((prev: any) => ({
                        ...prev,
                        venueId: preselected.clubId,
                        venueName: preselected.clubName
                    }));
                    setCurrentStep('venue'); // Jump to venue step to confirm
                }
            }
        } else {
            // Club role: Always force their own venue
            const clubId = profile.activeMembership.partnerId;
            const clubName = profile.activeMembership.partnerName || "Your Venue";

            if (formData.venueId !== clubId || formData.clubId !== clubId) {
                setFormData((prev: any) => ({
                    ...prev,
                    venueId: clubId,
                    venueName: clubName,
                    clubId: clubId
                }));
            }
        }
    }, [role, profile, searchParams, partnerships.length, formData.venueId, formData.clubId]);

    const fetchPartnerships = async () => {
        try {
            const res = await fetch(`/api/club/partnerships?hostId=${profile?.activeMembership?.partnerId}&status=active`);
            const data = await res.json();
            setPartnerships(data.partnerships || []);
        } catch (err) {
            console.error("Failed to fetch partnerships", err);
        }
    };

    const updateFormData = useCallback((updates: any) => {
        setFormData((prev: any) => ({ ...prev, ...updates }));
    }, []);

    const validateStep = () => {
        const errors: Record<string, string> = {};
        if (currentStep === 'basics') {
            if (!formData.title) errors.title = "Please enter an event title";
            if (!formData.startDate) errors.startDate = "Please select a date";
        }
        if (currentStep === 'venue') {
            if (!formData.venueId) errors.venueId = "Please select a venue";
        }
        if (currentStep === 'ticketing') {
            const totalTickets = formData.tickets.reduce((sum: number, t: any) => sum + (Number(t.quantity) || 0), 0);
            if (totalTickets > formData.capacity) {
                errors.tickets = `Total tickets (${totalTickets}) exceeds capacity (${formData.capacity})`;
            }
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

    const nextStep = () => {
        if (!validateStep()) return;
        if (currentStepIndex < STEPS.length - 1) {
            setCurrentStep(STEPS[currentStepIndex + 1].id);
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(STEPS[currentStepIndex - 1].id);
        }
    };

    // Hydrate creatorId once profile loads
    useEffect(() => {
        if (profile?.activeMembership?.partnerId || profile?.uid) {
            const preferredId = profile.activeMembership?.partnerId || profile.uid;
            if (formData.creatorId !== preferredId) {
                setFormData((prev: any) => ({
                    ...prev,
                    creatorId: preferredId
                }));
            }
        }
    }, [profile, formData.creatorId]);

    // Namespaced auto-save to localStorage (for crash recovery)
    useEffect(() => {
        if (!profile?.uid) return;
        const storageKey = `c1rcle_draft_event_${profile.uid}_${savedDraftId || 'new'}`;
        localStorage.setItem(storageKey, JSON.stringify(formData));
    }, [formData, savedDraftId, profile?.uid]);

    // Debounced remote auto-save
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Only auto-save if we have at least a title or description
            if (formData.title || formData.description) {
                setSaveState('saving');
                try {
                    if (savedDraftId) {
                        // Update existing draft
                        const res = await fetch(`/api/events/${savedDraftId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                actor: {
                                    uid: profile?.uid,
                                    role: role
                                },
                                updates: {
                                    ...formData,
                                    host: profile?.activeMembership?.partnerName || profile?.displayName || "C1RCLE Partner",
                                    location: formData.venueName || formData.address || "TBD",
                                }
                            }),
                        });
                        if (!res.ok) throw new Error("Update failed");
                        setSaveState('saved');
                    } else {
                        // Create initial draft
                        const res = await fetch('/api/events/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...formData,
                                host: profile?.activeMembership?.partnerName || profile?.displayName || "C1RCLE Partner",
                                location: formData.venueName || formData.address || "TBD",
                                creatorId: profile?.activeMembership?.partnerId || profile?.uid,
                                creatorRole: role,
                                lifecycle: 'draft'
                            }),
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.event?.id) {
                                setSavedDraftId(data.event.id);
                                setSaveState('saved');
                                // Sync ID with URL so refresh works
                                const currentPath = window.location.pathname;
                                router.replace(`${currentPath}?id=${data.event.id}`, { scroll: false });
                            }
                        } else {
                            const errorData = await res.json();
                            console.error("Draft creation failed:", errorData);
                            throw new Error("Creation failed");
                        }
                    }
                } catch (e) {
                    console.error("Auto-save failed:", e);
                    setSaveState('failed');
                }
            }
        }, 2000); // 2s debounce for background saving
        return () => clearTimeout(timer);
    }, [formData, savedDraftId, profile, role]);


    const handleSubmit = async (isDraft: boolean = false) => {
        if (!isDraft && !validateStep()) return;
        setIsSubmitting(true);
        try {
            const endpoint = savedDraftId ? `/api/events/${savedDraftId}` : '/api/events/create';
            const method = savedDraftId ? 'PATCH' : 'POST';

            const payload: any = {
                ...formData,
                venue: formData.venueName || "TBD",
                location: formData.venueName || formData.address || "TBD",
                host: profile?.activeMembership?.partnerName || profile?.displayName || "C1RCLE Partner",
                hostId: role === 'host' ? (profile?.activeMembership?.partnerId || profile?.uid) : formData.hostId,
                venueId: role === 'club' ? (profile?.activeMembership?.partnerId) : formData.venueId,
                clubId: role === 'club' ? (profile?.activeMembership?.partnerId) : formData.venueId,
                creatorId: profile?.activeMembership?.partnerId || profile?.uid,
                creatorRole: formData.creatorRole || role,
                lifecycle: isDraft ? 'draft' : (role === 'club' ? (formData.creatorRole === 'host' ? 'approved' : 'scheduled') : 'submitted'),
                status: 'active',
                settings: {
                    ...(formData.settings || {}),
                    showGuestlist
                }
            };

            const res = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(method === 'PATCH' ? {
                    actor: { uid: profile?.uid, role: role },
                    updates: payload,
                    action: isDraft ? 'draft' : (role === 'club' ? 'publish' : 'submit')
                } : payload),
            });

            if (res.ok) {
                // Clear namespaced recovery storage
                if (profile?.uid) {
                    const storageKey = `c1rcle_draft_event_${profile.uid}_${savedDraftId || 'new'}`;
                    localStorage.removeItem(storageKey);
                }
                if (isDraft) {
                    const data = await res.json();
                    if (data.event?.id) setSavedDraftId(data.event.id);
                    setFormData((prev: any) => ({ ...prev, lifecycle: 'draft' }));
                    setSaveState('saved');
                    return;
                }
                const data = await res.json();
                setCreatedEventId(data.event?.id || savedDraftId);
                setIsSuccess(true);
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
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="apple-subhead">Loading your draft...</p>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-[400px] flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-semibold">Error Loading Draft</p>
                        <p className="text-sm opacity-90">{loadError}</p>
                    </div>
                    <button
                        onClick={() => window.location.href = role === 'club' ? '/club/events' : '/host/events'}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                    >
                        Back to Events
                    </button>
                    <button
                        onClick={() => {
                            setLoadError(null);
                            // This will trigger the fetch effect again
                        }}
                        className="w-full py-4 bg-white text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all mt-2"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

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

                    <h1 className="apple-headline mb-4">Event {role === 'club' ? 'Published' : 'Submitted'}!</h1>
                    <p className="apple-subhead mb-12">
                        {role === 'club'
                            ? "Your event is now live and ready for guests to discover."
                            : "Your event has been submitted to the venue for review. You'll be notified once it's approved."}
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={() => router.push(role === 'club' ? '/club/events' : '/host/events')}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                        >
                            Go to Dashboard
                        </button>
                        <button
                            onClick={() => window.open(role === 'club' ? `/club/events` : `/host/events`, '_self')}
                            className="w-full py-4 bg-white text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                        >
                            Finish
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-12">

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="apple-headline mb-3">Create Event</h1>
                    <p className="apple-subhead">Build something extraordinary.</p>
                </div>

                {/* Step Indicator - Minimal dots */}
                <div className="flex items-center justify-center gap-2 mb-16">
                    {STEPS.map((step, index) => (
                        <button
                            key={step.id}
                            onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                            disabled={index > currentStepIndex}
                            className={`apple-step-dot ${index === currentStepIndex
                                ? 'apple-step-dot-active'
                                : index < currentStepIndex
                                    ? 'apple-step-dot-complete'
                                    : ''
                                }`}
                            title={step.label}
                        />
                    ))}
                </div>

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
                                className={isLocked ? "pointer-events-none opacity-60" : ""}
                            >
                                {/* Step Header */}
                                <div className="mb-8">
                                    <p className="apple-caption mb-2">Step {currentStepIndex + 1} of {STEPS.length}</p>
                                    <h2 className="apple-title">{STEPS[currentStepIndex].label}</h2>
                                    {isLocked && (role === 'host') && (
                                        <div className="mt-2 p-3 bg-blue-50 text-blue-600 rounded-xl flex items-center gap-2 text-[13px] font-medium">
                                            <ShieldCheck className="w-4 h-4" />
                                            This event is currently locked and cannot be edited.
                                        </div>
                                    )}
                                    {isReviewMode && (
                                        <div className="mt-2 p-3 bg-amber-50 text-amber-600 rounded-xl flex items-center gap-2 text-[13px] font-medium">
                                            <ShieldCheck className="w-4 h-4" />
                                            Review Mode: You are viewing a host's submission. You cannot edit their content.
                                        </div>
                                    )}
                                    {role === 'club' && formData.creatorRole === 'host' && formData.lifecycle === 'submitted' && (
                                        <div className="mt-2 p-3 bg-amber-50 text-amber-600 rounded-xl flex items-center gap-2 text-[13px] font-medium">
                                            <Zap className="w-4 h-4" />
                                            Reviewing host submission: You can make adjustments and publish when ready.
                                        </div>
                                    )}
                                    {role === 'host' && formData.lifecycle === 'denied' && (
                                        <div className="mt-2 p-3 bg-red-50 text-red-600 rounded-xl space-y-1">
                                            <div className="flex items-center gap-2 text-[13px] font-bold">
                                                <AlertCircle className="w-4 h-4" />
                                                This event was not approved
                                            </div>
                                            {formData.rejectionReason && (
                                                <p className="text-[12px] opacity-90 pl-6">
                                                    Reason: {formData.rejectionReason}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Step: Basics */}
                                {currentStep === 'basics' && (
                                    <div className="space-y-6">
                                        <AppleInput
                                            label="Event Title"
                                            placeholder="Give your event a name"
                                            value={formData.title}
                                            onChange={(e) => updateFormData({ title: e.target.value })}
                                            error={validationErrors.title}
                                        />

                                        <AppleTextArea
                                            label="Description"
                                            placeholder="Tell people what your event is about"
                                            rows={4}
                                            value={formData.description}
                                            onChange={(e) => updateFormData({ description: e.target.value })}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <AppleSelect
                                                label="Category"
                                                options={['Music', 'Art', 'Fashion', 'Tech', 'Food & Drink'].map(c => ({ label: c, value: c }))}
                                                value={formData.category}
                                                onChange={(e) => updateFormData({ category: e.target.value })}
                                            />
                                            <AppleSelect
                                                label="City"
                                                options={['Pune', 'Mumbai', 'Goa', 'Bengaluru', 'Delhi'].map(c => ({ label: c, value: c }))}
                                                value={formData.city}
                                                onChange={(e) => updateFormData({ city: e.target.value })}
                                            />
                                        </div>

                                        {/* Address Section */}
                                        <div className="p-5 rounded-2xl bg-[#f5f5f7] space-y-4">
                                            <p className="text-[13px] font-medium text-[#86868b]">Event Location</p>
                                            <AppleInput
                                                label="Venue Name"
                                                placeholder="e.g., XYZ Club, ABC Convention Center"
                                                value={formData.venueName}
                                                onChange={(e) => updateFormData({ venueName: e.target.value })}
                                            />
                                            <AppleInput
                                                label="Full Address"
                                                placeholder="Street address, landmark, area"
                                                value={formData.address}
                                                onChange={(e) => updateFormData({ address: e.target.value })}
                                            />
                                            <div className="grid grid-cols-2 gap-4">
                                                <AppleInput
                                                    label="Pincode"
                                                    placeholder="411001"
                                                    value={formData.pincode}
                                                    onChange={(e) => updateFormData({ pincode: e.target.value })}
                                                />
                                                <AppleInput
                                                    label="Google Maps Link (Optional)"
                                                    placeholder="https://maps.google.com/..."
                                                    value={formData.mapsLink}
                                                    onChange={(e) => updateFormData({ mapsLink: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <AppleInput
                                            label="Date"
                                            type="date"
                                            value={formData.startDate}
                                            onChange={(e) => updateFormData({ startDate: e.target.value })}
                                            error={validationErrors.startDate}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <AppleInput
                                                label="Start Time"
                                                type="time"
                                                value={formData.startTime}
                                                onChange={(e) => updateFormData({ startTime: e.target.value })}
                                            />
                                            <AppleInput
                                                label="End Time"
                                                type="time"
                                                value={formData.endTime}
                                                onChange={(e) => updateFormData({ endTime: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Step: Venue */}
                                {currentStep === 'venue' && (
                                    <VenueStep
                                        role={role}
                                        formData={formData}
                                        updateFormData={updateFormData}
                                        partnerships={partnerships}
                                        profile={profile}
                                        validationErrors={validationErrors}
                                    />
                                )}

                                {/* Step: Capacity */}
                                {currentStep === 'capacity' && (
                                    <div className="space-y-6">
                                        <AppleInput
                                            label="Maximum Capacity"
                                            type="number"
                                            value={formData.capacity}
                                            onChange={(e) => updateFormData({ capacity: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                        />

                                        <div className="p-5 rounded-2xl bg-[#f5f5f7]">
                                            <p className="text-[13px] text-[#86868b] mb-4">Safety Features</p>
                                            <div className="space-y-3">
                                                {['Security personnel', 'Medical support', 'Entry verification'].map((item) => (
                                                    <div key={item} className="flex items-center gap-3">
                                                        <div className="w-5 h-5 rounded-full bg-[#34c759] flex items-center justify-center">
                                                            <Check className="w-3 h-3 text-white" />
                                                        </div>
                                                        <span className="text-[15px] text-[#1d1d1f]">{item}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step: Ticketing */}
                                {currentStep === 'ticketing' && (
                                    <TicketTierStep
                                        formData={formData}
                                        updateFormData={updateFormData}
                                        validationErrors={validationErrors}
                                    />
                                )}

                                {/* Step: Table Bookings */}
                                {currentStep === 'tables' && (
                                    <TableBookingStep
                                        formData={formData}
                                        updateFormData={updateFormData}
                                        validationErrors={validationErrors}
                                    />
                                )}

                                {/* Step: Promoters */}
                                {currentStep === 'promoters' && (
                                    <PromoterStep
                                        formData={formData}
                                        updateFormData={updateFormData}
                                    />
                                )}

                                {/* Step: Media */}
                                {currentStep === 'media' && (
                                    <MediaStep formData={formData} updateFormData={updateFormData} />
                                )}

                                {/* Step: Review */}
                                {currentStep === 'review' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Event Info */}
                                            <div className="space-y-4">
                                                <div className="p-5 rounded-2xl bg-[#f5f5f7]">
                                                    <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-4">{formData.title || "Untitled"}</h3>
                                                    <div className="space-y-2 text-[15px]">
                                                        <div className="flex items-center gap-3 text-[#6e6e73]">
                                                            <Calendar className="w-4 h-4" />
                                                            <span>{formatEventDate(formData.startDate)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[#6e6e73]">
                                                            <Clock className="w-4 h-4" />
                                                            <span>{formData.startTime} - {formData.endTime}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[#6e6e73]">
                                                            <MapPin className="w-4 h-4" />
                                                            <span>{formData.venueName || "No venue"}, {formData.city}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-5 rounded-2xl border border-[rgba(0,0,0,0.06)]">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        {role === 'host' ? (
                                                            <AlertCircle className="w-5 h-5 text-[#ff9500]" />
                                                        ) : (
                                                            <CheckCircle2 className="w-5 h-5 text-[#34c759]" />
                                                        )}
                                                        <span className="font-medium text-[#1d1d1f]">
                                                            {role === 'host' ? 'Requires Approval' : 'Ready to Publish'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[13px] text-[#86868b]">
                                                        {role === 'host'
                                                            ? 'Your event will be sent to the venue for approval.'
                                                            : 'Your event will be published immediately.'
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Image Preview */}
                                            <div className="aspect-[4/3] rounded-2xl bg-[#f5f5f7] overflow-hidden">
                                                {formData.image ? (
                                                    <img src={formData.image} alt="Event" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <ImageIcon className="w-8 h-8 text-[#86868b]" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Navigation */}
                                <div className="flex items-center justify-between mt-12 pt-8 border-t border-[rgba(0,0,0,0.06)]">
                                    {isLocked ? (
                                        <button
                                            onClick={() => handleSubmit(true)} // Moving back to draft
                                            disabled={isSubmitting}
                                            className="apple-btn-secondary text-red-500 border-red-100 bg-red-50 flex items-center gap-2"
                                        >
                                            Withdraw Submission
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-4">
                                            {currentStep !== 'basics' && (
                                                <button
                                                    onClick={prevStep}
                                                    className="apple-btn-secondary flex items-center gap-2"
                                                >
                                                    <ChevronLeft className="w-4 h-4" /> Back
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleSubmit(true)}
                                                className="text-[15px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                                            >
                                                Save Draft
                                            </button>
                                        </div>
                                    )}

                                    {!isLocked && (
                                        currentStep === 'review' ? (
                                            <button
                                                disabled={isSubmitting}
                                                onClick={() => setShowPublishModal(true)}
                                                className="apple-btn-blue flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {role === 'host' ? 'Submit for Approval' : 'Publish Event'}
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={nextStep}
                                                className="apple-btn-primary flex items-center gap-2"
                                            >
                                                Continue <ChevronRight className="w-4 h-4" />
                                            </button>
                                        )
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Preview Sidebar */}
                    <div className="w-full lg:w-[360px] lg:sticky lg:top-8 self-start space-y-6">
                        {/* Preview Header Controls */}
                        <div className="flex flex-col gap-4 p-5 rounded-2xl bg-[#f5f5f7] border border-[rgba(0,0,0,0.06)]">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[13px] font-bold uppercase tracking-wider text-[#86868b]">Live Preview</h4>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${saveState === 'saving' ? 'bg-blue-100 text-blue-600' :
                                        saveState === 'failed' ? 'bg-red-100 text-red-600' :
                                            'bg-green-100 text-green-600'
                                        }`}>
                                        {saveState === 'saving' ? 'Saving...' :
                                            saveState === 'failed' ? 'Save Failed' :
                                                'Saved'}
                                    </span>
                                    <div className={`w-2 h-2 rounded-full ${saveState === 'saving' ? 'bg-blue-500 animate-pulse' :
                                        saveState === 'failed' ? 'bg-red-500' :
                                            'bg-green-500'
                                        }`} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex bg-white rounded-lg p-1 border border-[rgba(0,0,0,0.04)] shadow-sm">
                                    <button
                                        onClick={() => setDevice('desktop')}
                                        className={`p-1.5 rounded-md transition-all ${device === 'desktop' ? 'bg-[#1d1d1f] text-white shadow-md' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                                    >
                                        <Building2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDevice('mobile')}
                                        className={`p-1.5 rounded-md transition-all ${device === 'mobile' ? 'bg-[#1d1d1f] text-white shadow-md' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                                    >
                                        <Zap className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex-1 flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowDemoHover(!showDemoHover)}
                                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${showDemoHover
                                            ? 'bg-orange-500 text-white border-orange-600'
                                            : 'bg-white text-[#1d1d1f] border-[rgba(0,0,0,0.06)] hover:bg-white/80'
                                            }`}
                                    >
                                        QA Hover
                                    </button>
                                </div>
                            </div>
                        </div>

                        <PreviewCard formData={formData} device={device} showDemoHover={showDemoHover} />

                        {/* Full Page Preview Button */}
                        <button
                            onClick={() => setIsFullPagePreviewOpen(true)}
                            className="w-full py-3.5 rounded-xl bg-[#1d1d1f] text-white font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-[#0a0a0a] transition-colors shadow-lg"
                        >
                            <Sparkles className="w-4 h-4" />
                            Full Page Preview
                        </button>

                        <StatsCard formData={formData} />

                        {/* Guestlist Toggle */}
                        <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-[rgba(0,0,0,0.06)]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[14px] font-semibold text-[#1d1d1f]">Guestlist Visibility</p>
                                    <p className="text-[12px] text-[#86868b] mt-0.5">
                                        {showGuestlist ? "Confirmed attendees visible on page" : "Only interested list shown"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowGuestlist(!showGuestlist)}
                                    className={`w-12 h-7 rounded-full transition-colors relative ${showGuestlist ? 'bg-[#34c759]' : 'bg-[#e5e5ea]'}`}
                                >
                                    <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${showGuestlist ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Preview Trigger */}
            <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <button
                    onClick={() => setIsMobilePreviewOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#1d1d1f] text-white font-bold text-[14px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:scale-105 transition-transform"
                >
                    <ImageIcon className="w-4 h-4" />
                    Preview Card
                </button>
            </div>

            {/* Mobile Preview Drawer */}
            <AnimatePresence>
                {isMobilePreviewOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobilePreviewOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-x-0 bottom-0 max-h-[90vh] bg-[#f5f5f7] rounded-t-[40px] z-[70] lg:hidden overflow-y-auto"
                        >
                            <div className="sticky top-0 bg-[#f5f5f7]/80 backdrop-blur-md pt-2 pb-4 flex flex-col items-center">
                                <div className="w-12 h-1.5 rounded-full bg-[rgba(0,0,0,0.1)] mb-4" />
                                <div className="flex items-center justify-between w-full px-8">
                                    <h3 className="text-[17px] font-bold text-[#1d1d1f]">Event Preview</h3>
                                    <button
                                        onClick={() => setIsMobilePreviewOpen(false)}
                                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm"
                                    >
                                        <X className="w-4 h-4 text-[#86868b]" />
                                    </button>
                                </div>
                            </div>
                            <div className="px-6 pb-12 space-y-6">
                                <div className="flex justify-center">
                                    <div className="w-full max-w-[340px]">
                                        <div className="dark">
                                            <EventCard
                                                event={formData}
                                                isPreview={true}
                                                device="mobile"
                                                height="h-[440px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <StatsCard formData={formData} />
                                <button
                                    onClick={() => setIsMobilePreviewOpen(false)}
                                    className="w-full py-4 rounded-2xl bg-[#1d1d1f] text-white font-bold"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

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
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900 shadow-xl">
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Published Event Preview</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Draft Mode</span>
                                    <button
                                        onClick={() => setIsFullPagePreviewOpen(false)}
                                        className="rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-white/20 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                            {/* Preview Content */}
                            <div className="flex-1 overflow-y-auto">
                                <EventPage
                                    event={{
                                        ...formData,
                                        id: "preview-id",
                                        host: profile?.activeMembership?.partnerName || profile?.displayName || "Host Name",
                                        settings: {
                                            showGuestlist
                                        }
                                    }}
                                    host={{
                                        name: profile?.activeMembership?.partnerName || profile?.displayName || "Host Name",
                                        avatar: (profile as any)?.photoURL || "/events/holi-edit.svg",
                                        followers: 0,
                                        location: formData.city || "India",
                                        bio: "Preview of how your host profile appears to users."
                                    }}
                                    isPreview={true}
                                />
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-zinc-900/80 border-t border-white/5 text-center">
                                <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.2em]">
                                    This is a preview • Actions are disabled
                                </p>
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
        </div >
    );
}
