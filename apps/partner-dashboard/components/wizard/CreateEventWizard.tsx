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
    Loader2,
    Smartphone,
    Monitor,
    Wine,
    Percent,
    Maximize2
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



type WizardStep = 'basics' | 'venue' | 'ticketing' | 'tables' | 'promoters' | 'media' | 'review';

const STEPS: { id: WizardStep; label: string; icon: any }[] = [
    { id: 'basics', label: 'Details', icon: Sparkles },
    { id: 'venue', label: 'Venue', icon: Building2 },
    { id: 'ticketing', label: 'Tickets', icon: Ticket },
    { id: 'tables', label: 'Tables', icon: Wine },
    { id: 'promoters', label: 'Sales', icon: Percent },
    { id: 'media', label: 'Media', icon: ImageIcon },
    { id: 'review', label: 'Review', icon: CheckCircle2 },
];

// Design System Input Component (Apple Pro)
function AppleInput({
    label,
    error,
    className = "",
    icon: Icon,
    prefix,
    suffix,
    ...props
}: {
    label?: string;
    error?: string;
    className?: string;
    icon?: any;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label className="text-label ml-1">
                    {label}
                </label>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-[#4f46e5]">
                        <Icon className="w-4 h-4" />
                    </div>
                )}
                {prefix && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                        {prefix}
                    </div>
                )}
                <input
                    className={`input ${error ? 'input-error' : ''} ${Icon || prefix ? 'pl-11' : 'pl-4'} ${suffix ? 'pr-12' : 'pr-4'} ${className}`}
                    {...props}
                />
                {suffix && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {suffix}
                    </div>
                )}
            </div>
            {error && (
                <p className="text-[12px] text-red-600 font-medium ml-1 animate-slide-up">
                    {error}
                </p>
            )}
        </div>
    );
}


// Design System Select Component
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
        <div className="space-y-1.5">
            {label && (
                <label className="text-label ml-1">
                    {label}
                </label>
            )}
            <select
                value={value}
                onChange={onChange}
                className="input appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a8a29e%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_16px_center]"
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

// Design System TextArea Component
function AppleTextArea({
    label,
    className = "",
    ...props
}: {
    label?: string;
    className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label className="text-label ml-1">
                    {label}
                </label>
            )}
            <textarea
                className={`input min-h-[100px] resize-none ${className}`}
                {...props}
            />
        </div>
    );
}

// formatDate removed, using formatEventDate from core

// Device Frame for Preview
function DeviceFrame({ children, device }: { children: React.ReactNode; device: 'mobile' | 'desktop' }) {
    if (device === 'mobile') {
        return (
            <div className="relative mx-auto w-[320px] h-[640px] bg-[#1d1d1f] rounded-[50px] border-[8px] border-[#1d1d1f] shadow-[0_0_0_2px_rgba(255,255,255,0.1),0_40px_100px_rgba(0,0,0,0.4)] overflow-hidden scale-[0.85] origin-top">
                {/* Dynamic Island Placeholder */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-50" />
                <div className="h-full w-full bg-white dark:bg-black overflow-y-auto no-scrollbar">
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full aspect-video bg-[#1d1d1f] rounded-2xl border-[1px] border-white/10 shadow-2xl overflow-hidden">
            {/* Browser Header */}
            <div className="h-8 bg-[#2c2c2e] flex items-center px-4 gap-1.5 border-b border-black/20">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                <div className="ml-4 h-5 px-3 bg-black/20 rounded flex items-center">
                    <span className="text-[10px] text-white/40 tracking-tight font-medium">thec1rcle.host/event/preview</span>
                </div>
            </div>
            <div className="h-[calc(100%-32px)] w-full bg-white dark:bg-black overflow-y-auto no-scrollbar scale-[0.9] origin-top">
                {children}
            </div>
        </div>
    );
}

// Minimal Preview Card - Now using shared EventCard with Frame
function PreviewCard({ formData, device, showDemoHover, previewAs }: { formData: any, device: 'mobile' | 'desktop', showDemoHover: boolean, previewAs: 'guest' | 'promoter' }) {
    return (
        <DeviceFrame device={device}>
            <div className="p-4 pt-10">
                <EventCard
                    event={formData}
                    isPreview={true}
                    showDemoHover={showDemoHover}
                    device={device}
                    height={device === 'mobile' ? "h-[420px]" : "h-[420px]"}
                />

                {previewAs === 'promoter' && (
                    <div className="mt-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">Promoter Insights</p>
                        <div className="flex justify-between items-center">
                            <span className="text-body-sm font-medium text-indigo-900">Est. Commission</span>
                            <span className="text-body font-bold text-indigo-900">
                                ₹{Math.round((formData.tickets?.[0]?.price || 0) * (formData.commission / 100) || 0)}
                            </span>
                        </div>
                    </div>
                )}

                <div className="mt-8 space-y-6 px-2 text-left">
                    <div className="space-y-2">
                        <h1 className="text-headline dark:text-white leading-tight">{formData.title || "Project Narrative"}</h1>
                        <p className="text-label text-[#4f46e5]">
                            {formatEventDate(formData.startDate)} • {formData.startTime}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 py-4 border-y border-subtle">
                        <div className="w-10 h-10 rounded-full surface-secondary border border-default" />
                        <div>
                            <p className="text-label text-muted">Hosted at</p>
                            <p className="text-body-sm font-bold text-primary dark:text-white">{formData.venueName || "Venue Unspecified"}</p>
                        </div>
                    </div>

                    <p className="text-body-sm text-secondary dark:text-stone-400">
                        {formData.description || "Synthesizing event description..."}
                    </p>

                    <button className="btn btn-primary w-full py-6 text-[12px] uppercase tracking-widest">
                        {formData.isRSVP ? 'Register for Access' : 'Purchase Admissions'}
                    </button>
                </div>

                <div className="text-center pb-12 mt-10">
                    <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest leading-relaxed">
                        End-to-End Encryption Enabled<br />Verified Original Production
                    </p>
                </div>
            </div>
        </DeviceFrame>
    );
}



// Draft Card for Resume List
function DraftCard({ draft, onResume, onDelete }: { draft: any, onResume: (id: string) => void, onDelete: (id: string) => void }) {
    return (
        <div className="card p-4 flex items-center justify-between group hover:border-indigo-200 hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl surface-secondary border border-default flex items-center justify-center overflow-hidden">
                    {draft.poster ? (
                        <img src={draft.poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                    )}
                </div>
                <div>
                    <h3 className="text-body font-bold text-primary truncate max-w-[200px]">
                        {draft.title || "Untitled Project"}
                    </h3>
                    <p className="text-[11px] text-muted font-medium uppercase tracking-tight">
                        Edited {new Date(draft.updatedAt).toLocaleDateString()} • Step {draft.draftMeta?.lastStep || '1'}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button
                    onClick={() => onDelete(draft.id)}
                    className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onResume(draft.id)}
                    className="btn btn-primary h-9 px-4 text-[12px]"
                >
                    Resume
                </button>
            </div>
        </div>
    );
}

// Drafts Landing View
function DraftsLanding({ drafts, onResume, onStartFresh, onDelete }: { drafts: any[], onResume: (id: string) => void, onStartFresh: () => void, onDelete: (id: string) => void }) {
    return (
        <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="text-center mb-16">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 mb-8 shadow-sm">
                    <Sparkles className="w-10 h-10" />
                </div>
                <h1 className="text-display mb-4">Project Workspace</h1>
                <p className="text-body text-muted max-w-md mx-auto">Select an existing draft to continue editing or initialize a new event sequence.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Recent Drafts */}
                <div className="space-y-6">
                    <h2 className="text-label pl-1">Recent Iterations</h2>
                    <div className="space-y-4">
                        {drafts.slice(0, 3).map(draft => (
                            <DraftCard
                                key={draft.id}
                                draft={draft}
                                onResume={onResume}
                                onDelete={onDelete}
                            />
                        ))}
                        {drafts.length > 3 && (
                            <button className="w-full py-6 border border-dashed border-default rounded-2xl text-label hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" />
                                Review {drafts.length} total drafts
                            </button>
                        )}
                    </div>
                </div>

                {/* Start Fresh */}
                <div className="space-y-6">
                    <h2 className="text-label pl-1">New Deployment</h2>
                    <div
                        onClick={onStartFresh}
                        className="h-[216px] card-elevated border-2 border-dashed border-stone-200 hover:border-indigo-400 hover:bg-stone-50/50 transition-all cursor-pointer flex flex-col items-center justify-center group"
                    >
                        <div className="w-14 h-14 rounded-full surface-secondary group-hover:bg-indigo-50 flex items-center justify-center transition-colors mb-4 border border-default">
                            <Plus className="w-7 h-7 text-stone-400 group-hover:text-indigo-600" />
                        </div>
                        <p className="text-headline-sm">Initialize Fresh</p>
                        <p className="text-body-sm text-muted">Create a new event from scratch</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CreateEventWizard({ role }: { role: 'venue' | 'host' }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useDashboardAuth();
    const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [showDemoHover, setShowDemoHover] = useState(false);
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
    const [previewAs, setPreviewAs] = useState<'guest' | 'promoter'>('guest');
    const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
    const [isFullPagePreviewOpen, setIsFullPagePreviewOpen] = useState(false);
    const [showGuestlist, setShowGuestlist] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
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
            draftMeta: {
                wizardVersion: "1.0",
                lastStep: "basics",
                completionPercent: 0,
                lastSavedAt: new Date().toISOString(),
                clientUpdatedAt: Date.now()
            }
        };

        return defaultData;
    });

    const [partnerships, setPartnerships] = useState<any[]>([]);
    const [drafts, setDrafts] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const isReviewMode = role === 'venue' && formData.creatorRole === 'host';
    const isLocked = (role === 'host' && (formData.lifecycle === 'submitted' || formData.lifecycle === 'scheduled' || formData.lifecycle === 'live')) || (isReviewMode && searchParams.get('mode') === 'review');

    // Load Local Recovery Snapshot
    useEffect(() => {
        if (!profile?.uid || isLoadingDraft) return;
        const currentId = searchParams.get('id') || 'new';
        const storageKey = `c1rcle_draft_event_${profile.uid}_${currentId}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
            try {
                const localData = JSON.parse(stored);
                // If we don't have an ID in URL, we can just hydrate from local immediately if it's "new"
                if (currentId === 'new' && !formData.id && localData.title) {
                    setFormData((prev: any) => ({ ...prev, ...localData }));
                    return;
                }

                // If we have an ID, we'll wait for remote load to compare
                setLocalRecoveryData(localData);
            } catch (e) {
                console.error("Failed to parse local draft", e);
            }
        }
    }, [profile?.uid, searchParams, isLoadingDraft]);

    const [localRecoveryData, setLocalRecoveryData] = useState<any>(null);
    const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);

    // Fetch drafts list if no ID provided
    useEffect(() => {
        if (!searchParams.get('id') && profile?.activeMembership?.partnerId) {
            const fetchDrafts = async () => {
                setIsLoadingDrafts(true);
                try {
                    const res = await fetch(`/api/events?lifecycle=draft&creatorId=${profile.activeMembership.partnerId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setDrafts(data.events || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch drafts:", err);
                } finally {
                    setIsLoadingDrafts(false);
                }
            };
            fetchDrafts();
        }
    }, [searchParams, profile?.activeMembership?.partnerId]);

    // Fetch remote draft if ID is in URL
    useEffect(() => {
        const eventId = searchParams.get('id');
        if (eventId && !isLoadingDraft && formData.id !== eventId && !loadError) {
            const fetchDraft = async () => {
                setIsLoadingDraft(true);
                try {
                    const res = await fetch(`/api/events/${eventId}`);
                    if (!res.ok) throw new Error("Failed to load event draft.");
                    const data = await res.json();
                    if (data.event) {
                        const remote = data.event;
                        const remoteUpdated = new Date(remote.updatedAt).getTime();

                        // Compare with local recovery data
                        if (localRecoveryData && localRecoveryData.draftMeta?.clientUpdatedAt > remoteUpdated) {
                            // Local is newer! Show banner.
                            setFormData(remote);
                            setSavedDraftId(remote.id);
                            setShowRecoveryBanner(true);
                        } else {
                            // Remote is newer or no local data
                            setFormData(remote);
                            setSavedDraftId(remote.id);
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
    }, [searchParams, formData.id, loadError, isLoadingDraft, localRecoveryData]);

    const updateFormData = useCallback((updates: any) => {
        setFormData((prev: any) => ({ ...prev, ...updates }));
    }, []);

    const fetchPartnerships = useCallback(async () => {
        try {
            const res = await fetch(`/api/venue/partnerships?hostId=${profile?.activeMembership?.partnerId}&status=active`);
            const data = await res.json();
            const activePartnerships = data.partnerships || [];
            setPartnerships(activePartnerships);

            // Auto-select if there's exactly one partnership and nothing selected yet
            if (activePartnerships.length === 1 && !formData.venueId && role === 'host' && !searchParams.get('id')) {
                const solo = activePartnerships[0];
                updateFormData({
                    venueId: solo.venueId,
                    venueName: solo.venueName,
                    venue: solo.venueName
                });
            }
        } catch (err) {
            console.error("Failed to fetch partnerships", err);
        }
    }, [profile?.activeMembership?.partnerId, formData.venueId, role, searchParams, updateFormData]);

    useEffect(() => {
        if (!profile?.activeMembership) return;

        // Skip auto-fill if we are loading an existing event
        if (searchParams.get('id')) return;

        if (role === 'host') {
            fetchPartnerships();

            // Handle pre-populated venue from URL
            const venueIdParam = searchParams.get('venue');
            if (venueIdParam && partnerships.length > 0) {
                const preselected = partnerships.find(p => p.venueId === venueIdParam);
                if (preselected && formData.venueId !== preselected.venueId) {
                    setFormData((prev: any) => ({
                        ...prev,
                        venueId: preselected.venueId,
                        venueName: preselected.venueName
                    }));
                    setCurrentStep('venue'); // Jump to venue step to confirm
                }
            }
        } else {
            // Venue role: Always force their own venue
            const venueId = profile.activeMembership.partnerId;
            const venueName = profile.activeMembership.partnerName || "Your Venue";

            if (formData.venueId !== venueId) {
                setFormData((prev: any) => ({
                    ...prev,
                    venueId: venueId,
                    venueName: venueName,
                    venue: venueName
                }));
            }
        }
    }, [role, profile, searchParams, partnerships, formData.venueId, fetchPartnerships]);


    const validateStep = () => {
        const errors: Record<string, string> = {};
        if (currentStep === 'basics') {
            if (!formData.title) errors.title = "Please enter an event title";
        }
        if (currentStep === 'venue') {
            if (role === 'host' && !formData.venueId) errors.venueId = "Please select a venue";
            if (!formData.startDate) errors.startDate = "Please select an event date";
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
    const canAutoSave = !isLocked && formData.lifecycle !== 'submitted' && formData.lifecycle !== 'scheduled';

    useEffect(() => {
        if (!profile?.uid || !canAutoSave) return;
        const storageKey = `c1rcle_draft_event_${profile.uid}_${savedDraftId || 'new'}`;

        // Enrich with meta before saving
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

    // Debounced remote auto-save
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Only auto-save if we have at least a title or description and it's not locked
            if ((formData.title || formData.description) && !isLocked) {
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
                        // Update existing draft
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
                        setSaveState('saved');
                    } else {
                        // Create initial draft
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
                                setSaveState('saved');
                                // Sync ID with URL so refresh works
                                const currentPath = window.location.pathname;
                                const params = new URLSearchParams(searchParams.toString());
                                params.set('id', data.event.id);
                                router.replace(`${currentPath}?${params.toString()}`, { scroll: false });
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
        }, 3000); // 3s debounce for background saving
        return () => clearTimeout(timer);
    }, [formData, savedDraftId, profile, role, router, currentStep, isLocked, searchParams]);


    const handleSubmit = async (isDraft: boolean = false) => {
        if (!isDraft && !validateStep()) return;
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
                lifecycle: isDraft ? 'draft' : (role === 'venue' ? (formData.creatorRole === 'host' ? 'approved' : 'scheduled') : 'submitted'),
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
                        onClick={() => window.location.href = role === 'venue' ? '/venue/events' : '/host/events'}
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

    const handleDeleteDraft = async (id: string) => {
        if (!confirm("Are you sure you want to delete this draft?")) return;
        try {
            const res = await fetch(`/api/events/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actor: { uid: profile?.uid, role: role }
                })
            });
            if (res.ok) {
                setDrafts(prev => prev.filter(d => d.id !== id));
            }
        } catch (err) {
            console.error("Failed to delete draft", err);
        }
    };

    if (drafts.length > 0 && !searchParams.get('id') && !showGuestlist && currentStep === 'basics' && !formData.title) {
        return (
            <DraftsLanding
                drafts={drafts}
                onResume={(id) => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('id', id);
                    router.push(`${window.location.pathname}?${params.toString()}`);
                }}
                onDelete={handleDeleteDraft}
                onStartFresh={() => {
                    // Start fresh by setting a flag or just remaining here but hiding the landing
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('id', 'new');
                    router.push(`${window.location.pathname}?${params.toString()}`);
                }}
            />
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

                    <h1 className="apple-headline mb-4">Event {role === 'venue' ? 'Published' : 'Submitted'}!</h1>
                    <p className="apple-subhead mb-12">
                        {role === 'venue'
                            ? "Your event is now live and ready for guests to discover."
                            : "Your event has been submitted to the venue for review. You'll be notified once it's approved."}
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={() => router.push(role === 'venue' ? '/venue/events' : '/host/events')}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                        >
                            Go to Dashboard
                        </button>
                        <button
                            onClick={() => window.open(role === 'venue' ? `/venue/events` : `/host/events`, '_self')}
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
        <>
            <div className="min-h-screen bg-white">
                {/* Content */}
                <div className="max-w-6xl mx-auto px-6 py-12">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
                        <div className="text-left">
                            <h1 className="apple-headline mb-1">Create Event</h1>
                            <p className="apple-subhead">Build something extraordinary.</p>
                        </div>

                        {/* Saving Status Indicator */}
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#f5f5f7] border border-[#d2d2d7]/30">
                            {saveState === 'saving' ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                                    <span className="text-[12px] font-medium text-[#86868b]">Saving...</span>
                                </>
                            ) : saveState === 'saved' ? (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    <span className="text-[12px] font-medium text-[#86868b]">Changes Saved</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                    <span className="text-[12px] font-medium text-red-500">Save Failed</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Step Indicator — Design System Integration */}
                    <div className="flex items-center justify-between gap-1 mb-16 px-6 py-4 surface-secondary rounded-2xl border border-default overflow-x-auto scrollbar-hide">
                        {STEPS.map((step, index) => {
                            const Icon = step.icon;
                            const isActive = index === currentStepIndex;
                            const isComplete = index < currentStepIndex;

                            return (
                                <button
                                    key={step.id}
                                    onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                                    disabled={index > currentStepIndex}
                                    className={`flex flex-col items-center gap-2 min-w-[70px] transition-all group ${isActive ? 'opacity-100' : 'opacity-40'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive
                                        ? 'bg-[#4f46e5] text-white shadow-xl shadow-indigo-100 scale-105'
                                        : isComplete
                                            ? 'bg-emerald-50 text-emerald-600'
                                            : 'bg-white text-stone-400 border border-default'
                                        }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <span className={`text-label transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        {step.label}
                                    </span>
                                </button>
                            );
                        })}
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
                                    {/* Recovery Banner */}
                                    <AnimatePresence>
                                        {showRecoveryBanner && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4 text-indigo-600" />
                                                        <p className="text-[13px] font-medium text-indigo-900">
                                                            We found newer unsaved changes from your last session.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                                        <button
                                                            onClick={() => {
                                                                if (localRecoveryData) {
                                                                    setFormData(localRecoveryData);
                                                                    setShowRecoveryBanner(false);
                                                                }
                                                            }}
                                                            className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-bold hover:bg-indigo-700 transition-all"
                                                        >
                                                            Recover Changes
                                                        </button>
                                                        <button
                                                            onClick={() => setShowRecoveryBanner(false)}
                                                            className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-[12px] font-bold hover:bg-slate-50 transition-all"
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Step Header */}
                                    <div className="mb-8">
                                        <p className="apple-caption mb-2">Step {currentStepIndex + 1} of {STEPS.length}</p>
                                        <h2 className="apple-title">{STEPS[currentStepIndex].label}</h2>

                                        {/* Rejection Notes */}
                                        {(formData.lifecycle === 'needs_changes' || formData.lifecycle === 'denied') && formData.rejectionReason && (
                                            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                                <div>
                                                    <p className="text-[14px] font-bold text-red-900">Changes Requested</p>
                                                    <p className="text-[13px] text-red-700 font-medium mt-0.5">{formData.rejectionReason}</p>
                                                </div>
                                            </div>
                                        )}
                                        {isLocked && (role === 'host') && (
                                            <div className="mt-2 p-3 bg-blue-50 text-blue-600 rounded-xl flex items-center gap-2 text-[13px] font-medium">
                                                <ShieldCheck className="w-4 h-4" />
                                                This event is currently locked and cannot be edited.
                                            </div>
                                        )}
                                        {isReviewMode && (
                                            <div className="mt-2 p-3 bg-amber-50 text-amber-600 rounded-xl flex items-center gap-2 text-[13px] font-medium">
                                                <ShieldCheck className="w-4 h-4" />
                                                Review Mode: You are viewing a host&apos;s submission. You cannot edit their content.
                                            </div>
                                        )}
                                        {role === 'venue' && formData.creatorRole === 'host' && formData.lifecycle === 'submitted' && (
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
                                        <div className="space-y-8">
                                            {/* Identity Section */}
                                            <div className="card-elevated p-8 space-y-6">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                    </div>
                                                    <h3 className="text-headline-sm">Identity</h3>
                                                </div>

                                                <AppleInput
                                                    label="Event Title"
                                                    placeholder="Give your event a name"
                                                    value={formData.title}
                                                    onChange={(e) => updateFormData({ title: e.target.value })}
                                                    error={validationErrors.title}
                                                    className="text-stat-sm h-14"
                                                />

                                                <AppleTextArea
                                                    label="Description"
                                                    placeholder="Tell people what your event is about"
                                                    rows={4}
                                                    value={formData.description}
                                                    onChange={(e) => updateFormData({ description: e.target.value })}
                                                />

                                                <div className="grid grid-cols-2 gap-6">
                                                    <AppleSelect
                                                        label="Category"
                                                        options={['Music', 'Art', 'Fashion', 'Tech', 'Food & Drink'].map(c => ({ label: c, value: c }))}
                                                        value={formData.category}
                                                        onChange={(e) => updateFormData({ category: e.target.value })}
                                                    />
                                                    <AppleSelect
                                                        label="City / Hub"
                                                        options={['Pune', 'Mumbai', 'Goa', 'Bengaluru', 'Delhi'].map(c => ({ label: c, value: c }))}
                                                        value={formData.city}
                                                        onChange={(e) => updateFormData({ city: e.target.value })}
                                                    />
                                                </div>

                                                <AppleInput
                                                    label="Maximum Expected Capacity"
                                                    type="number"
                                                    icon={Users}
                                                    placeholder="Total guest count"
                                                    value={formData.capacity}
                                                    onChange={(e) => updateFormData({ capacity: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Step: Venue — Combined Selection, Time & Location */}
                                    {currentStep === 'venue' && (
                                        <div className="space-y-8">
                                            <VenueStep
                                                role={role}
                                                formData={formData}
                                                updateFormData={updateFormData}
                                                partnerships={partnerships}
                                                profile={profile}
                                                validationErrors={validationErrors}
                                            />

                                            {/* Schedule Section */}
                                            <div className="card-elevated p-8 space-y-6">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                                        <Clock className="w-3.5 h-3.5" />
                                                    </div>
                                                    <h3 className="text-headline-sm">Timing</h3>
                                                </div>

                                                <div className={role === 'venue' ? 'grid grid-cols-3 gap-6' : 'grid grid-cols-2 gap-6'}>
                                                    {role === 'venue' && (
                                                        <AppleInput
                                                            label="Event Date"
                                                            type="date"
                                                            icon={Calendar}
                                                            value={formData.startDate}
                                                            onChange={(e) => updateFormData({ startDate: e.target.value })}
                                                            error={validationErrors.startDate}
                                                        />
                                                    )}
                                                    <AppleInput
                                                        label="Start Time"
                                                        type="time"
                                                        icon={Clock}
                                                        value={formData.startTime}
                                                        onChange={(e) => updateFormData({ startTime: e.target.value })}
                                                    />
                                                    <AppleInput
                                                        label="End Time"
                                                        type="time"
                                                        icon={Clock}
                                                        value={formData.endTime}
                                                        onChange={(e) => updateFormData({ endTime: e.target.value })}
                                                    />
                                                </div>

                                                {/* Date Summary Banner */}
                                                <AnimatePresence>
                                                    {(formData.startDate || (formData.startTime && formData.endTime)) && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="p-4 rounded-xl state-confirmed-bg border border-emerald-100 flex items-center gap-3"
                                                        >
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                            <p className="text-body-sm text-emerald-800 font-medium">
                                                                Event takes place {formData.startDate ? `on ${formatEventDate(formData.startDate)}` : 'soon'}
                                                                {formData.startTime && ` from ${formData.startTime}`}
                                                                {formData.endTime && ` until ${formData.endTime}`}.
                                                            </p>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Location Details (Only shown or editable if not a managed venue or if specific details needed) */}
                                            <div className="card-elevated p-8 space-y-6">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                        <MapPin className="w-3.5 h-3.5" />
                                                    </div>
                                                    <h3 className="text-headline-sm">Location Particulars</h3>
                                                </div>

                                                <AppleInput
                                                    label="Display Venue Name"
                                                    icon={Building2}
                                                    placeholder="e.g., The Grand Ballroom"
                                                    value={formData.venueName}
                                                    onChange={(e) => updateFormData({ venueName: e.target.value })}
                                                    disabled={role === 'host' && formData.venueId} // Host uses partnered venue name
                                                />

                                                <AppleInput
                                                    label="Full Address"
                                                    icon={MapPin}
                                                    placeholder="Exact address for navigation"
                                                    value={formData.address}
                                                    onChange={(e) => updateFormData({ address: e.target.value })}
                                                />

                                                <div className="grid grid-cols-2 gap-6">
                                                    <AppleSelect
                                                        label="City / Hub"
                                                        options={['Pune', 'Mumbai', 'Goa', 'Bengaluru', 'Delhi'].map(c => ({ label: c, value: c }))}
                                                        value={formData.city}
                                                        onChange={(e) => updateFormData({ city: e.target.value })}
                                                    />
                                                    <AppleInput
                                                        label="Pincode"
                                                        placeholder="411001"
                                                        value={formData.pincode}
                                                        onChange={(e) => updateFormData({ pincode: e.target.value })}
                                                    />
                                                </div>

                                                <AppleInput
                                                    label="Maps Navigation Link"
                                                    placeholder="URL for guest directions"
                                                    value={formData.mapsLink}
                                                    onChange={(e) => updateFormData({ mapsLink: e.target.value })}
                                                    suffix={
                                                        <button
                                                            className="btn btn-icon-sm btn-ghost"
                                                            onClick={() => window.open(formData.mapsLink, '_blank')}
                                                            title="Test Link"
                                                        >
                                                            <ArrowRight className="w-4 h-4" />
                                                        </button>
                                                    }
                                                />
                                            </div>
                                        </div>
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

                                    {/* Step: Review */}
                                    {currentStep === 'review' && (
                                        <div className="space-y-8">
                                            <div className="card-elevated p-8 space-y-8">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                                                            <Sparkles className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-headline-sm">Final Overview</h3>
                                                            <p className="text-label">Review your event before publishing</p>
                                                        </div>
                                                    </div>
                                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${role === 'venue' ? 'state-confirmed-bg text-emerald-600' : 'state-pending-bg text-amber-600'
                                                        }`}>
                                                        {role === 'venue' ? 'Instant Activation' : 'Review Required'}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    {/* Left: Summary Cards */}
                                                    <div className="space-y-4">
                                                        <div className="p-6 rounded-2xl surface-secondary border border-default space-y-4">
                                                            <div>
                                                                <h4 className="text-headline mb-2">
                                                                    {formData.title || "Untitled Event"}
                                                                </h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <span className="badge badge-neutral">
                                                                        {formData.category || "General"}
                                                                    </span>
                                                                    <span className="badge badge-neutral">
                                                                        {formData.city}
                                                                    </span>
                                                                    <span className="badge badge-indigo">
                                                                        {formData.capacity} Capacity
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3 pt-4 border-t border-subtle">
                                                                <div className="flex items-center gap-3 text-body-sm font-medium">
                                                                    <Calendar className="w-4 h-4 text-muted" />
                                                                    <span>{formData.startDate ? formatEventDate(formData.startDate) : "Schedule Pending"}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-body-sm font-medium">
                                                                    <Clock className="w-4 h-4 text-muted" />
                                                                    <span>{formData.startTime} – {formData.endTime}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-body-sm font-medium">
                                                                    <MapPin className="w-4 h-4 text-muted" />
                                                                    <span>{formData.venueName || "Location not set"}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="p-6 rounded-2xl border border-default bg-white space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-label font-bold text-primary">Financial Summary</p>
                                                                <Ticket className="w-4 h-4 text-muted" />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1">
                                                                    <p className="text-[10px] font-black uppercase text-muted tracking-widest">Access Model</p>
                                                                    <p className="text-body-sm font-bold text-emerald-600">
                                                                        {formData.isRSVP ? "Complimentary (RSVP)" : "Paid Admission"}
                                                                    </p>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-[10px] font-black uppercase text-muted tracking-widest">Inventory</p>
                                                                    <p className="text-body-sm font-bold text-primary">
                                                                        {(formData.tickets || []).length} Tiers Configured
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right: Media Preview */}
                                                    <div className="space-y-4">
                                                        <div className="aspect-[4/3] rounded-2xl surface-secondary border border-default overflow-hidden group relative shadow-sm">
                                                            {formData.image ? (
                                                                <img src={formData.image} alt="Review" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                                            ) : (
                                                                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                                                    <ImageIcon className="w-10 h-10 text-stone-300" />
                                                                    <p className="text-label">Visual asset missing</p>
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                                        </div>

                                                        <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-indigo-600">
                                                                <Zap className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-body-sm font-bold text-indigo-900 leading-tight">Submission Logic</p>
                                                                <p className="text-[12px] text-indigo-700/80 mt-1">
                                                                    {role === 'venue'
                                                                        ? "Instant listing upon confirmation. Your event goes live immediately."
                                                                        : "Awaiting approval from venue operator before publication."}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
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
                        <div className="w-full lg:w-[360px] lg:sticky lg:top-8 self-start space-y-8">
                            {/* Perspective Header & Perspective Controls */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Perspective</span>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100/50">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Live Sync</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-5 gap-2">
                                    <div className="col-span-3 flex bg-stone-100 rounded-xl p-1">
                                        <button
                                            onClick={() => setPreviewAs('guest')}
                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${previewAs === 'guest' ? 'bg-white text-primary shadow-sm' : 'text-stone-400 hover:text-primary'}`}
                                        >
                                            Guest
                                        </button>
                                        <button
                                            onClick={() => setPreviewAs('promoter')}
                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${previewAs === 'promoter' ? 'bg-white text-primary shadow-sm' : 'text-stone-400 hover:text-primary'}`}
                                        >
                                            Promoter
                                        </button>
                                    </div>

                                    <div className="col-span-2 flex bg-stone-100 rounded-xl p-1">
                                        <button
                                            onClick={() => setDevice('desktop')}
                                            className={`flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all ${device === 'desktop' ? 'bg-white text-primary shadow-sm' : 'text-stone-400 hover:text-primary'}`}
                                        >
                                            <Monitor className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setDevice('mobile')}
                                            className={`flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all ${device === 'mobile' ? 'bg-white text-primary shadow-sm' : 'text-stone-400 hover:text-primary'}`}
                                        >
                                            <Smartphone className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Live Card Preview */}
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-gradient-to-b from-stone-50 to-transparent rounded-[2rem] -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <PreviewCard formData={formData} device={device} showDemoHover={showDemoHover} previewAs={previewAs} />
                            </div>

                            {/* Full Page Preview - Premium Trigger */}
                            <button
                                onClick={() => setIsFullPagePreviewOpen(true)}
                                className="group relative w-full p-6 rounded-[2rem] bg-stone-900 overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-stone-200"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-rose-500/20 opacity-50" />
                                <div className="relative flex items-center justify-between">
                                    <div className="text-left">
                                        <p className="text-[14px] font-black text-white tracking-tight">Full Event Experience</p>
                                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">Exact detail page replica</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md group-hover:bg-white/20 transition-colors">
                                        <Maximize2 className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </button>

                            {/* Advanced Settings */}
                            <div className="p-6 rounded-[2rem] border border-stone-200 bg-white/50 backdrop-blur-sm space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-[13px] font-bold text-primary">Public Guestlist</p>
                                        <p className="text-[11px] text-stone-400 font-medium leading-tight">Display attendee counts to public</p>
                                    </div>
                                    <button
                                        onClick={() => setShowGuestlist(!showGuestlist)}
                                        className={`w-12 h-7 rounded-full transition-all duration-300 relative ${showGuestlist ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-stone-200'}`}
                                    >
                                        <motion.div
                                            className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm"
                                            animate={{ x: showGuestlist ? 20 : 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
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
            </div>
        </>
    );
}
