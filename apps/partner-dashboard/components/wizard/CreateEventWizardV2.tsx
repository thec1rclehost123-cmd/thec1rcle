'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Calendar,
  Music,
  Ticket,
  Wine,
  Percent,
  Image as ImageIcon,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
  MapPin,
  Plus,
  X,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';

// Step Components
import { IdentityStep, ExperienceStep } from './steps';
import { TicketTierStep } from './TicketTierStep';
import { TableBookingStep } from './TableBookingStep';
import { MediaStep } from './MediaStep';
import { PromoterStep } from './PromoterStep';
import { PublishConfirmationModal } from './PublishConfirmationModal';
import { DetailedBreakdown } from './components/DetailedBreakdown';
import { WizardNavigation, SaveStatus, WizardStep, StepConfig } from './WizardNavigation';
import { GuestPortalEventPreview, GuestPortalPosterPreview } from './GuestPortalEventPreview';

type ScheduleAvailabilityState = {
  checking: boolean;
  available: boolean;
  reason: string;
};

const PROTECTED_EVENT_PATCH_FIELDS = new Set([
  'id',
  'creatorId',
  'creatorRole',
  'workspaceId',
  'hostId',
  'venueId',
  'lifecycle',
  'status',
  'visibility',
  'approvalState',
  'approvedBy',
  'approvedAt',
  'publishedAt',
  'cancelledAt',
  'financialAttribution',
  'splitRuleSnapshot',
]);

function createSafeEventPatch(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([field]) => !PROTECTED_EVENT_PATCH_FIELDS.has(field)),
  );
}

// Step Configuration
const STEPS: StepConfig[] = [
  {
    id: 'identity',
    label: 'Identity & Headline',
    shortLabel: 'Identity',
    icon: Sparkles,
    description: 'Event name, category, host and venue',
  },
  {
    id: 'experience',
    label: 'Lineup & Experience',
    shortLabel: 'Lineup',
    icon: Music,
    description: 'Artists, genres, dress code and restrictions',
  },
  {
    id: 'ticketing',
    label: 'Ticketing & Pricing',
    shortLabel: 'Tickets',
    icon: Ticket,
    description: 'Ticket tiers, pricing and capacity',
  },
  {
    id: 'tables',
    label: 'Tables & VIP',
    shortLabel: 'Tables',
    icon: Wine,
    description: 'Table packages and premium offerings',
  },
  {
    id: 'promoters',
    label: 'PROMOTERS',
    shortLabel: 'PROMOTERS',
    icon: Percent,
    description: 'Assign promoters and configure compensation',
  },
  {
    id: 'media',
    label: 'Media & Presentation',
    shortLabel: 'Media',
    icon: ImageIcon,
    description: 'Poster, images and event copy',
  },
  {
    id: 'review',
    label: 'Review & Publish',
    shortLabel: 'Review',
    icon: CheckCircle2,
    description: 'Final review before publishing',
  },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

const toRateType = (t: string | undefined): 'percentage' | 'flat' =>
  t === 'fixed' || t === 'flat' ? 'flat' : 'percentage';

const fromRateType = (t: string | undefined): 'percent' | 'fixed' =>
  t === 'fixed' || t === 'flat' ? 'fixed' : 'percent';

/**
 * Builds the canonical `promoterCompensation` object (schemaVersion 2) from
 * the wizard's flat formData fields — sent instead of the many flat
 * commission keys. Mirrors apps/api-gateway/src/routes/v1/events.ts's
 * `buildPromoterCompensationV2`; keep the two in sync if the shape changes.
 */
function buildPromoterCompensationPayload(formData: any): any {
  const model = formData.compensationModel || 'standard';
  const enabled = formData.promotersEnabled === true;

  let defaults: any;
  if (model === 'standard') {
    defaults = {
      ticketCommission: {
        type: toRateType(formData.commissionType),
        value: Number(formData.commission) || 0,
      },
    };
    const tcv = formData.tablesCommissionValue;
    if (tcv !== undefined && tcv !== '' && tcv !== null) {
      defaults.tableCommission = {
        enabled: true,
        type: toRateType(formData.tablesCommissionType),
        value: Number(tcv) || 0,
      };
    }
  } else if (model === 'custom') {
    // Free (RSVP) tiers — price 0 — never carry a commission; exclude them
    // so a stale commissionValue left on a tier that was zeroed out doesn't
    // get persisted as a real commission entry.
    defaults = {
      ticketCommissions: (formData.tickets || [])
        .filter((t: any) => (Number(t.price) || 0) > 0)
        .map((t: any) => ({
          ticketTierId: t.id || t.tierId,
          type: toRateType(t.commissionType),
          value: Number(t.commissionValue) || 0,
        })),
    };
    const tcv = formData.tablesCommissionValue;
    if (tcv !== undefined && tcv !== '' && tcv !== null) {
      defaults.tableCommission = {
        enabled: true,
        type: toRateType(formData.tablesCommissionType),
        value: Number(tcv) || 0,
      };
    }
  } else {
    defaults = { notes: formData.salaryNotes || '' };
    if (formData.salaryTableIncentivesEnabled) {
      defaults.tableIncentive = {
        enabled: true,
        type: toRateType(formData.salaryTableIncentiveType),
        value: Number(formData.salaryTableIncentiveValue) || 0,
      };
    }
  }

  const overrides: Record<string, any> = {};
  const rawOverrides: Record<string, any> = formData.promoterCommissionOverrides || {};
  for (const [promoterId, ov] of Object.entries(rawOverrides)) {
    if (!(ov as any)?.hasCustomCommission) continue;
    if (model === 'standard') {
      const gr = (ov as any).globalRate;
      if (gr !== undefined && gr !== null) {
        overrides[promoterId] = {
          ticketCommission: {
            type: toRateType((ov as any).globalRateType),
            value: Number(gr) || 0,
          },
        };
      }
    } else if (model === 'custom') {
      const ticketOverrides = Object.entries((ov as any).tierRates || {}).map(([tierId, rate]) => {
        const defaultEntry = (defaults.ticketCommissions || []).find(
          (tc: any) => tc.ticketTierId === tierId,
        );
        return {
          ticketTierId: tierId,
          type: defaultEntry?.type || 'percentage',
          value: Number(rate) || 0,
        };
      });
      if (ticketOverrides.length > 0) overrides[promoterId] = { ticketOverrides };
    }
  }

  return { schemaVersion: 2, enabled, model, defaults, overrides };
}

/**
 * Converts a stored/fetched V2 `promoterCompensation` object back into the
 * flat formData keys the wizard steps read and write internally — used to
 * prefill the wizard when reopening a draft. Ticket-tier-level commission
 * fields (commissionValue/commissionType) already live on `event.tickets`
 * and need no reconstruction here.
 */
function deserializeCompensation(pc: any): Record<string, any> {
  if (!pc) return {};
  const model = pc.model || 'standard';
  const defaults = pc.defaults || {};

  const flat: Record<string, any> = {
    compensationModel: model,
    promotersEnabled: pc.enabled ?? false,
  };

  if (model === 'standard') {
    flat.commission = defaults.ticketCommission?.value ?? 0;
    flat.commissionType = fromRateType(defaults.ticketCommission?.type);
  } else if (model === 'custom') {
    flat.commission = 0;
    flat.commissionType = 'percent';
  } else {
    flat.commission = 0;
    flat.commissionType = 'percent';
    flat.salaryNotes = defaults.notes || '';
    flat.salaryTableIncentivesEnabled = !!defaults.tableIncentive?.enabled;
    if (defaults.tableIncentive) {
      flat.salaryTableIncentiveValue = defaults.tableIncentive.value ?? 0;
      flat.salaryTableIncentiveType = fromRateType(defaults.tableIncentive.type);
    }
  }

  if (defaults.tableCommission) {
    flat.tablesCommissionValue = defaults.tableCommission.value ?? 0;
    flat.tablesCommissionType = fromRateType(defaults.tableCommission.type);
  }

  const promoterCommissionOverrides: Record<string, any> = {};
  for (const [promoterId, ov] of Object.entries(pc.overrides || {})) {
    const ovAny = ov as any;
    if (model === 'standard' && ovAny.ticketCommission) {
      promoterCommissionOverrides[promoterId] = {
        hasCustomCommission: true,
        globalRate: ovAny.ticketCommission.value,
        globalRateType: fromRateType(ovAny.ticketCommission.type),
      };
    } else if (model === 'custom' && ovAny.ticketOverrides) {
      const tierRates: Record<string, number> = {};
      for (const to of ovAny.ticketOverrides as any[]) {
        tierRates[to.ticketTierId] = to.value;
      }
      promoterCommissionOverrides[promoterId] = { hasCustomCommission: true, tierRates };
    }
  }
  flat.promoterCommissionOverrides = promoterCommissionOverrides;

  return flat;
}

export function CreateEventWizardV2({ role }: { role: 'venue' | 'host' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, user } = useDashboardAuth();

  // Helper for authenticated API calls
  const authedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!user) {
        console.error('[WizardV2] authedFetch called without user');
        throw new Error('Not authenticated');
      }
      // Force refresh token to ensure it's valid
      const token = await user.getIdToken(true);
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [user],
  );

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
  const [scheduleAvailability, setScheduleAvailability] = useState<ScheduleAvailabilityState>({
    checking: false,
    available: true,
    reason: '',
  });
  const [prefilledSlot, setPrefilledSlot] = useState<{
    venueId: string;
    venueName: string;
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const draftCreateInFlightRef = useRef<Promise<string | null> | null>(null);

  // Form Data
  const [formData, setFormData] = useState<any>(() => ({
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
    hostNote: '',
    capacity: 500,
    artists: [],
    genres: [],
    dressCode: 'smart_casual',
    themeDescription: '',
    ageRestriction: '21+',
    tickets: [
      {
        id: 'ga',
        name: 'General Admission',
        entryType: 'general',
        price: 500,
        quantity: 400,
        minPerOrder: 1,
        maxPerOrder: 10,
        promoterEnabled: true,
      },
    ],
    tables: [],
    tablesEnabled: false,
    promotersEnabled: true,
    compensationModel: 'standard',
    commission: 15,
    commissionType: 'percent',
    tablesCommissionType: 'percent',
    tablesCommissionValue: 15,
    promoterCommissionOverrides: {},
    salaryTableIncentivesEnabled: false,
    salaryTableIncentiveType: 'percent',
    salaryTableIncentiveValue: 10,
    salaryNotes: '',
    buyerDiscountsEnabled: false,
    discount: 10,
    discountType: 'percent',
    useDefaultDiscount: true,
    promoters: [],
    images: [],
    poster: '',
    lifecycle: 'draft',
    creatorRole: role,
    creatorId: '',
    draftMeta: {
      wizardVersion: '2.0',
      lastStep: 'identity',
      completionPercent: 0,
      lastSavedAt: new Date().toISOString(),
      clientUpdatedAt: Date.now(),
    },
  }));

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const currentStepConfig = STEPS[currentStepIndex];
  const previewHost = useMemo(
    () => ({
      handle: profile?.activeMembership?.partnerName || 'host',
      name: profile?.activeMembership?.partnerName || 'Host',
      city: formData.city || 'India',
      bio: 'Preview mode',
    }),
    [formData.city, profile?.activeMembership?.partnerName],
  );

  const checkScheduleAvailability = useCallback(
    async (venueId: string, startDate: string, startTime: string, endTime: string) => {
      const params = new URLSearchParams({
        startDate,
        endDate: startDate,
      });
      const endpoint =
        role === 'host'
          ? `/api/host/venue-calendar?venueId=${venueId}&${params.toString()}`
          : `/api/venues/${venueId}/calendar?${params.toString()}`;
      const res = await authedFetch(endpoint);
      const data = await res.json();

      if (!res.ok) {
        const slotErrMsg =
          typeof data.error === 'object' && data.error ? data.error.message : data.error;
        throw new Error(data.message || slotErrMsg || 'Failed to check slot availability');
      }

      const calendarDays = Array.isArray(data) ? data : data.calendar || data.days || [];
      const day = calendarDays[0];
      if (!day) return { available: true, reason: '' };

      const toExtendedMinutes = (time: string) => {
        const [hour, minute] = time.split(':').map(Number);
        let total = hour * 60 + minute;
        if (hour < 12) total += 24 * 60;
        return total;
      };

      const requestedStart = toExtendedMinutes(startTime);
      const requestedEnd = toExtendedMinutes(endTime);

      const isBlocked =
        String(day.status || '').toLowerCase() === 'blocked' ||
        String(day.state || '').toLowerCase() === 'blocked';

      if (isBlocked) {
        return { available: false, reason: 'This date is blocked on the venue calendar.' };
      }

      const isBooked =
        String(day.status || '').toLowerCase() === 'booked' ||
        String(day.state || '').toLowerCase() === 'confirmed';

      if (isBooked) {
        const slots = [
          ...(Array.isArray(day.slots) ? day.slots : []),
          ...(Array.isArray(day.events) ? day.events : []),
        ];
        if (slots.length === 0 && !Array.isArray(day.slots)) {
          slots.push(day);
        }

        const hasOverlap = slots.some((slot: any) => {
          if (!slot || slot.status === 'available') return false;

          // If checking overlap with self, ignore
          const targetId = searchParams.get('id');
          if (targetId && (slot.id === targetId || slot.eventId === targetId)) {
            return false;
          }

          const sStart = slot.startTime || slot.requestedStartTime;
          const sEnd = slot.endTime || slot.requestedEndTime;
          if (!sStart || !sEnd) return true;

          const slotStart = toExtendedMinutes(sStart);
          const slotEnd = toExtendedMinutes(sEnd);
          return requestedStart < slotEnd && slotStart < requestedEnd;
        });

        if (hasOverlap) {
          return {
            available: false,
            reason: 'The selected time overlaps with an existing blocked, pending, or booked slot.',
          };
        }
      }

      return { available: true, reason: '' };
    },
    [authedFetch, role, searchParams],
  );

  useEffect(() => {
    if (!formData.venueId || !formData.startDate || !formData.startTime || !formData.endTime) {
      setScheduleAvailability({ checking: false, available: true, reason: '' });
      return;
    }

    let cancelled = false;
    setScheduleAvailability((prev) => ({ ...prev, checking: true }));

    const timer = setTimeout(async () => {
      try {
        const result = await checkScheduleAvailability(
          formData.venueId,
          formData.startDate,
          formData.startTime,
          formData.endTime,
        );

        if (!cancelled) {
          setScheduleAvailability({
            checking: false,
            available: result.available,
            reason: result.reason,
          });
        }
      } catch (error: any) {
        if (!cancelled) {
          setScheduleAvailability({
            checking: false,
            available: false,
            reason: error.message || 'Failed to verify venue availability.',
          });
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    formData.venueId,
    formData.startDate,
    formData.startTime,
    formData.endTime,
    checkScheduleAvailability,
  ]);

  const createDraftOnce = useCallback(
    async (payload: any) => {
      if (savedDraftId) return savedDraftId;
      if (draftCreateInFlightRef.current) return draftCreateInFlightRef.current;

      draftCreateInFlightRef.current = (async () => {
        const res = await authedFetch('/api/events/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            creatorId: profile?.activeMembership?.partnerId || profile?.uid,
            creatorRole: role,
            lifecycle: 'draft',
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errMsg =
            data.message ||
            (typeof data.error === 'object' && data.error ? data.error.message : data.error) ||
            'Create failed';
          throw new Error(errMsg);
        }

        const data = await res.json();
        const draftId = data.event?.id || null;

        if (draftId) {
          setSavedDraftId(draftId);
          const params = new URLSearchParams(searchParams.toString());
          params.set('id', draftId);
          router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        }

        return draftId;
      })();

      try {
        return await draftCreateInFlightRef.current;
      } finally {
        draftCreateInFlightRef.current = null;
      }
    },
    [
      authedFetch,
      profile?.activeMembership?.partnerId,
      profile?.uid,
      role,
      router,
      savedDraftId,
      searchParams,
    ],
  );

  // Validation per step
  const stepValidation = useMemo(() => {
    const validation: Record<
      WizardStep,
      { isValid: boolean; issues: string[]; fieldErrors: Record<string, string> }
    > = {
      identity: { isValid: true, issues: [], fieldErrors: {} },
      experience: { isValid: true, issues: [], fieldErrors: {} },
      ticketing: { isValid: true, issues: [], fieldErrors: {} },
      tables: { isValid: true, issues: [], fieldErrors: {} },
      promoters: { isValid: true, issues: [], fieldErrors: {} },
      media: { isValid: true, issues: [], fieldErrors: {} },
      review: { isValid: true, issues: [], fieldErrors: {} },
    };

    // Identity validation
    if (!formData.title) {
      validation.identity.issues.push('Event title is required');
      validation.identity.fieldErrors.title = 'Required';
      validation.identity.isValid = false;
    }
    if (role === 'host' && !formData.venueId) {
      validation.identity.issues.push('Please select a venue partner');
      validation.identity.fieldErrors.venueId = 'Required';
      validation.identity.isValid = false;
    }
    if (!formData.startDate) {
      validation.identity.issues.push('Event date is required');
      validation.identity.fieldErrors.startDate = 'Required';
      validation.identity.isValid = false;
    }
    if (formData.startDate && formData.startTime && formData.endTime) {
      const [sYr, sMon, sDay] = formData.startDate.split('-').map(Number);
      const [sHr, sMin] = formData.startTime.split(':').map(Number);
      const startDt = new Date(sYr, sMon - 1, sDay, sHr, sMin);

      const effectiveEndDate = formData.endDate || formData.startDate;
      const [eYr, eMon, eDay] = effectiveEndDate.split('-').map(Number);
      const [eHr, eMin] = formData.endTime.split(':').map(Number);
      const endDt = new Date(eYr, eMon - 1, eDay, eHr, eMin);

      const isSameDayOrUnspecified = !formData.endDate || formData.endDate === formData.startDate;
      if (isSameDayOrUnspecified) {
        const startMinutes = sHr * 60 + sMin;
        const endMinutes = eHr * 60 + eMin;
        if (endMinutes < startMinutes) {
          endDt.setDate(endDt.getDate() + 1);
        }
      }

      if (endDt.getTime() <= startDt.getTime()) {
        validation.identity.issues.push('End time must be after start time');
        validation.identity.fieldErrors.endTime = 'Must be after start time';
        validation.identity.isValid = false;
      }
    }
    if (formData.venueId && formData.startDate && formData.startTime && formData.endTime) {
      if (scheduleAvailability.checking) {
        validation.identity.issues.push('Checking venue availability...');
        validation.identity.fieldErrors.scheduleAvailability = 'Checking';
        validation.identity.isValid = false;
      } else if (!scheduleAvailability.available) {
        validation.identity.issues.push(
          scheduleAvailability.reason || 'Selected slot is unavailable',
        );
        validation.identity.fieldErrors.scheduleAvailability =
          scheduleAvailability.reason || 'Unavailable';
        validation.identity.isValid = false;
      }
    }

    // Ticketing validation
    const ticketingIssues: string[] = [];
    const ticketingFieldErrors: Record<string, string> = {};
    const isCustomCommission = formData.promotersEnabled && formData.compensationModel === 'custom';
    if (formData.tickets && formData.tickets.length > 0) {
      formData.tickets.forEach((tier: any, index: number) => {
        const label = tier.name?.trim() || `Tier ${index + 1}`;
        if (tier.price === '' || tier.price === null || tier.price === undefined) {
          ticketingIssues.push(`"${label}": Price is required`);
          ticketingFieldErrors.tickets = 'Fill in Price and Quantity for all ticket tiers';
        }
        if (tier.quantity === '' || tier.quantity === null || tier.quantity === undefined) {
          ticketingIssues.push(`"${label}": Quantity is required`);
          ticketingFieldErrors.tickets = 'Fill in Price and Quantity for all ticket tiers';
        }
      });
      const totalTickets = formData.tickets.reduce(
        (sum: number, t: any) => sum + (Number(t.quantity) || 0),
        0,
      );
      const capacity = formData.capacity || 500;
      if (totalTickets > capacity) {
        ticketingIssues.push(
          `Quantity is exceeding the decided capacity (${totalTickets}/${capacity})`,
        );
        ticketingFieldErrors.tickets = 'Total ticket quantity exceeds the decided capacity';
      }
    }
    validation.ticketing = {
      isValid: ticketingIssues.length === 0,
      issues: ticketingIssues,
      fieldErrors: ticketingFieldErrors,
    };

    // Promoters validation
    const promotersIssues: string[] = [];
    const promotersFieldErrors: Record<string, string> = {};
    // RSVP events have no paid tickets, so promoter commission is never
    // configurable — the Promoters step hides the whole section for isRSVP,
    // and validation must not demand a commission it never let the user set.
    if (formData.promotersEnabled && !formData.isRSVP) {
      if (
        formData.compensationModel === 'custom' &&
        formData.tickets &&
        formData.tickets.length > 0
      ) {
        formData.tickets.forEach((tier: any, index: number) => {
          // Free tiers (price 0) inside an otherwise paid event never carry
          // a commission — skip them entirely.
          if ((Number(tier.price) || 0) === 0) return;
          const label = tier.name?.trim() || `Tier ${index + 1}`;
          if (
            tier.commissionValue === '' ||
            tier.commissionValue === null ||
            tier.commissionValue === undefined
          ) {
            promotersIssues.push(`"${label}": Commission is required`);
            promotersFieldErrors.promoters =
              'Set a commission for every ticket tier on the Promoters step';
          } else if (
            (tier.commissionType || 'percent') === 'percent' &&
            Number(tier.commissionValue) > 100
          ) {
            promotersIssues.push(`"${label}": Commission cannot exceed 100%`);
            promotersFieldErrors.promoters = 'Commission cannot exceed 100%';
          } else if (Number(tier.commissionValue) < 0) {
            promotersIssues.push(`"${label}": Commission cannot be negative`);
            promotersFieldErrors.promoters = 'Commission cannot be negative';
          }
        });
      }
      if (formData.compensationModel !== 'custom' && formData.compensationModel !== 'salary') {
        const commission = formData.commission;
        if (commission === '' || commission === null || commission === undefined) {
          promotersIssues.push('Global commission is required');
          promotersFieldErrors.promoters = 'Set a global commission on the Promoters step';
        } else if (
          (formData.commissionType || 'percent') === 'percent' &&
          Number(commission) > 100
        ) {
          promotersIssues.push('Global commission cannot exceed 100%');
          promotersFieldErrors.promoters = 'Global commission cannot exceed 100%';
        } else if (Number(commission) < 0) {
          promotersIssues.push('Global commission cannot be negative');
          promotersFieldErrors.promoters = 'Global commission cannot be negative';
        }
      }
      if (formData.compensationModel === 'salary' && formData.salaryTableIncentivesEnabled) {
        const incentive = formData.salaryTableIncentiveValue;
        if (incentive === '' || incentive === null || incentive === undefined) {
          promotersIssues.push('Table incentive value is required');
          promotersFieldErrors.promoters = 'Set a table incentive value on the Promoters step';
        } else if (
          (formData.salaryTableIncentiveType || 'percent') === 'percent' &&
          Number(incentive) > 100
        ) {
          promotersIssues.push('Table incentive cannot exceed 100%');
          promotersFieldErrors.promoters = 'Table incentive cannot exceed 100%';
        }
      }
    }
    validation.promoters = {
      isValid: promotersIssues.length === 0,
      issues: promotersIssues,
      fieldErrors: promotersFieldErrors,
    };

    // Publish-blocking: mirror the ticketing and promoters rules on the review step,
    // since Publish is gated on validation.review, not individual steps.
    if (!validation.ticketing.isValid) {
      validation.review.issues.push(...ticketingIssues);
      validation.review.isValid = false;
      validation.review.fieldErrors.tickets = ticketingFieldErrors.tickets;
    }
    if (!validation.promoters.isValid) {
      validation.review.issues.push(...promotersIssues);
      validation.review.isValid = false;
      validation.review.fieldErrors.promoters = promotersFieldErrors.promoters;
    }

    // Media validation (soft warning)
    if (!formData.poster && !formData.images?.length) {
      validation.media.issues.push('Adding a poster is recommended for better engagement');
    }

    if (!formData.startDate || !formData.startTime || !formData.endTime) {
      validation.review.issues.push('Event date and time must be selected before publishing');
      validation.review.isValid = false;
    } else {
      const [sYr, sMon, sDay] = formData.startDate.split('-').map(Number);
      const [sHr, sMin] = formData.startTime.split(':').map(Number);
      const startDt = new Date(sYr, sMon - 1, sDay, sHr, sMin);

      const effectiveEndDate = formData.endDate || formData.startDate;
      const [eYr, eMon, eDay] = effectiveEndDate.split('-').map(Number);
      const [eHr, eMin] = formData.endTime.split(':').map(Number);
      const endDt = new Date(eYr, eMon - 1, eDay, eHr, eMin);

      const isSameDayOrUnspecified = !formData.endDate || formData.endDate === formData.startDate;
      if (isSameDayOrUnspecified) {
        const startMinutes = sHr * 60 + sMin;
        const endMinutes = eHr * 60 + eMin;
        if (endMinutes < startMinutes) {
          endDt.setDate(endDt.getDate() + 1);
        }
      }

      if (endDt.getTime() <= startDt.getTime()) {
        validation.review.issues.push('End time must be after start time');
        validation.review.fieldErrors.endTime = 'Must be after start time';
        validation.review.isValid = false;
      }
    }
    if (!scheduleAvailability.checking && !scheduleAvailability.available) {
      validation.review.issues.push(scheduleAvailability.reason || 'Selected slot is unavailable');
      validation.review.fieldErrors.scheduleAvailability =
        scheduleAvailability.reason || 'Unavailable';
      validation.review.isValid = false;
    }

    return validation;
  }, [formData, role, scheduleAvailability]);

  // Grand Total Calculation
  const grandTotal = useMemo(() => {
    const ticketRevenue = (formData.tickets || []).reduce(
      (acc: number, tier: any) => acc + (Number(tier.price) || 0) * (Number(tier.quantity) || 0),
      0,
    );
    const tableRevenue = formData.tablesEnabled
      ? (formData.tables || []).reduce(
          (acc: number, table: any) =>
            acc + (Number(table.price) || 0) * (Number(table.quantity) || 0),
          0,
        )
      : 0;
    const ticketCapacity = (formData.tickets || []).reduce(
      (acc: number, tier: any) => acc + (Number(tier.quantity) || 0),
      0,
    );
    const tableCapacity = formData.tablesEnabled
      ? (formData.tables || []).reduce(
          (acc: number, table: any) =>
            acc +
            (Number(table.capacity || table.guestsPerTable) || 0) * (Number(table.quantity) || 0),
          0,
        )
      : 0;

    return {
      revenue: ticketRevenue + tableRevenue,
      capacity: ticketCapacity + tableCapacity,
    };
  }, [formData.tickets, formData.tables, formData.tablesEnabled]);

  const updateFormData = useCallback((updates: any) => {
    setFormData((prev: any) => ({ ...prev, ...updates }));
  }, []);

  // Fetch partnerships for hosts
  useEffect(() => {
    if (role === 'host' && profile?.activeMembership?.partnerId) {
      const fetchPartnerships = async () => {
        try {
          const res = await authedFetch(
            `/api/partners/hosts/partnerships?hostId=${profile!.activeMembership!.partnerId}&status=active`,
          );
          const data = await res.json();
          setPartnerships(data.partnerships || []);
        } catch (err) {
          console.error('Failed to fetch partnerships', err);
        }
      };
      fetchPartnerships();
    }
  }, [role, profile?.activeMembership?.partnerId, authedFetch]);

  useEffect(() => {
    if (role !== 'host' || partnerships.length === 0 || !formData.venueId) return;

    const exactMatch = partnerships.find(
      (partnership: any) => partnership.venueId === formData.venueId,
    );
    if (exactMatch) return;

    const normalizedVenueName = String(formData.venueName || formData.venue || '')
      .trim()
      .toLowerCase();
    if (!normalizedVenueName) return;

    const nameMatches = partnerships.filter(
      (partnership: any) =>
        String(partnership.venueName || '')
          .trim()
          .toLowerCase() === normalizedVenueName,
    );

    if (nameMatches.length !== 1) return;

    const canonicalVenue = nameMatches[0];
    setFormData((prev: any) => ({
      ...prev,
      venueId: canonicalVenue.venueId,
      venueName: canonicalVenue.venueName || prev.venueName,
      venue: canonicalVenue.venueName || prev.venue,
    }));

    const params = new URLSearchParams(searchParams.toString());
    if (params.get('venue') === formData.venueId) {
      params.set('venue', canonicalVenue.venueId);
      if (canonicalVenue.venueName) {
        params.set('venueName', canonicalVenue.venueName);
      }
      router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }
  }, [
    role,
    partnerships,
    formData.venueId,
    formData.venueName,
    formData.venue,
    searchParams,
    router,
  ]);

  // Hydrate from URL params (when coming from venue calendar selection)
  useEffect(() => {
    const venueId = searchParams.get('venue');
    const venueName = searchParams.get('venueName');
    const date = searchParams.get('date');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const doorsOpen = searchParams.get('doorsOpen') || '';
    const lastEntry = searchParams.get('lastEntry') || '';

    if (venueId && date && startTime && endTime) {
      setPrefilledSlot({
        venueId,
        venueName: venueName || 'Partner Venue',
        date,
        startTime,
        endTime,
      });

      // Pre-fill form data
      setFormData((prev: any) => ({
        ...prev,
        venueId,
        venueName: venueName || prev.venueName,
        startDate: date,
        startTime,
        endTime,
        doorsOpen,
        lastEntry,
      }));
    }
  }, [searchParams]);

  // Redirect to calendar if no date/time is provided and we are not loading a draft
  useEffect(() => {
    const isDraft = searchParams.get('id') && searchParams.get('id') !== 'new';
    const hasDateParams =
      searchParams.get('date') && searchParams.get('startTime') && searchParams.get('endTime');
    if (!isDraft && !hasDateParams) {
      if (role === 'venue') {
        const preferredId = profile?.activeMembership?.partnerId;
        const preferredName = profile?.activeMembership?.partnerName || 'Your Venue';
        if (preferredId) {
          router.replace(
            `/venue/create/select-venue/calendar?venueId=${preferredId}&venueName=${preferredName}`,
          );
        } else {
          router.replace('/venue/create/select-venue');
        }
      } else {
        router.replace('/host/create/select-venue');
      }
    }
  }, [searchParams, role, profile, router]);

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
        console.error('Failed to parse local draft', e);
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
          if (process.env.NODE_ENV === 'development')
            console.log('[WizardV2] Fetching draft:', eventId);
          const res = await authedFetch(`/api/events/${eventId}`);
          if (!res.ok) throw new Error('Failed to load event draft.');
          const data = await res.json();

          if (data.event) {
            const remote = {
              ...data.event,
              ...deserializeCompensation(data.event.promoterCompensation),
              startTime: data.event.startTime || '21:00',
              endTime: data.event.endTime || '03:00',
            };
            const remoteUpdated = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

            // Compare with local recovery data if available
            if (localRecoveryData && localRecoveryData.draftMeta?.clientUpdatedAt > remoteUpdated) {
              // Local is newer! Show recovery option
              if (process.env.NODE_ENV === 'development')
                console.log('[WizardV2] Local recovery data is newer');
              setFormData(remote);
              setSavedDraftId(remote.id);
              setShowRecoveryBanner(true);
            } else {
              // Remote is newer or no local data
              if (process.env.NODE_ENV === 'development')
                console.log('[WizardV2] Loading remote draft data');
              setFormData(remote);
              setSavedDraftId(remote.id);

              // Restore progress if saved
              if (remote.draftMeta?.lastStep) {
                const stepExists = STEPS.some((s) => s.id === remote.draftMeta.lastStep);
                setCurrentStep(stepExists ? (remote.draftMeta.lastStep as WizardStep) : 'identity');
              }
            }
          }
        } catch (err: any) {
          console.error('Failed to fetch remote draft:', err);
          setLoadError(err.message || 'Failed to load draft');
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
          const res = await authedFetch(
            `/api/events?lifecycle=draft&creatorId=${profile!.activeMembership!.partnerId}`,
          );
          if (res.ok) {
            const data = await res.json();
            setDrafts(data.events || []);
          }
        } catch (err) {
          console.error('Failed to fetch drafts:', err);
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
        const venueName = profile.activeMembership.partnerName || 'Your Venue';
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
        lastSavedAt: new Date().toISOString(),
      },
    };
    localStorage.setItem(storageKey, JSON.stringify(enrichedData));
  }, [formData, savedDraftId, profile?.uid, currentStep]);

  // Remote auto-save (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.title?.trim() && formData.lifecycle === 'draft') {
        setSaveState('saving');
        try {
          const payload = {
            ...formData,
            host:
              profile?.activeMembership?.partnerName || profile?.displayName || 'C1RCLE Partner',
            venue: formData.venue || formData.venueName || 'TBD',
            location: formData.venue || formData.venueName || formData.address || 'TBD',
            promoterCompensation: buildPromoterCompensationPayload(formData),
            draftMeta: {
              ...formData.draftMeta,
              lastStep: currentStep,
              clientUpdatedAt: Date.now(),
              lastSavedAt: new Date().toISOString(),
            },
          };

          if (savedDraftId) {
            const res = await authedFetch(`/api/events/${savedDraftId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(createSafeEventPatch(payload)),
            });
            if (!res.ok) throw new Error('Update failed');
          } else {
            await createDraftOnce(payload);
          }
          setSaveState('saved');
        } catch (e) {
          console.error('Auto-save failed:', e);
          setSaveState('failed');
        }
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [formData, savedDraftId, profile, role, currentStep, authedFetch, createDraftOnce]);

  const validateCurrentStep = (): boolean => {
    const validation = stepValidation[currentStep];
    if (!validation.isValid) {
      setValidationErrors(validation.fieldErrors);
      return false;
    }
    setValidationErrors({});
    return true;
  };

  const nextStep = () => {
    if (!validateCurrentStep()) return;

    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
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
      const pendingDraftId =
        !savedDraftId && draftCreateInFlightRef.current
          ? await draftCreateInFlightRef.current
          : null;
      const effectiveDraftId = savedDraftId || pendingDraftId;
      const hostId = profile?.activeMembership?.partnerId || profile?.uid;
      const hostName =
        profile?.activeMembership?.partnerName || profile?.displayName || 'C1RCLE Host';
      const currentLifecycle = String(formData.lifecycle || '').toLowerCase();
      const isResubmission =
        role === 'host' && ['needs_changes', 'denied'].includes(currentLifecycle);

      const payload: any = {
        ...formData,
        venue: formData.venue || formData.venueName || 'TBD',
        location: formData.venue || formData.venueName || formData.address || 'TBD',
        host: hostName,
        hostName: hostName,
        hostId: role === 'host' ? hostId : formData.hostId,
        venueId: role === 'venue' ? profile?.activeMembership?.partnerId : formData.venueId,
        creatorId: profile?.activeMembership?.partnerId || profile?.uid,
        creatorRole: formData.creatorRole || role,
        lifecycle: isDraft ? 'draft' : role === 'venue' ? 'scheduled' : 'submitted',
        status: 'active',
        coverImage:
          formData.coverImage ||
          formData.coverPhoto ||
          formData.poster ||
          formData.image ||
          formData.images?.[0] ||
          '',
        coverPhoto:
          formData.coverPhoto ||
          formData.coverImage ||
          formData.poster ||
          formData.image ||
          formData.images?.[0] ||
          '',
        settings: { ...(formData.settings || {}), showGuestlist },
        promoterCompensation: buildPromoterCompensationPayload(formData),
        draftMeta: {
          ...formData.draftMeta,
          lastStep: currentStep,
          clientUpdatedAt: Date.now(),
          lastSavedAt: new Date().toISOString(),
        },
      };
      console.log('payload', payload);
      const draftPayload = { ...payload, lifecycle: 'draft' };
      let res: Response;
      if (role === 'host' && !isDraft) {
        let draftId = effectiveDraftId;
        if (!draftId) {
          draftId = await createDraftOnce(draftPayload);
        }
        if (!draftId) throw new Error('Failed to prepare host event draft');

        if (effectiveDraftId) {
          const saveRes = await authedFetch(`/api/events/${draftId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actor: {
                uid: profile?.uid,
                role,
                partnerId: profile?.activeMembership?.partnerId,
              },
              updates: createSafeEventPatch(draftPayload),
              action: 'draft',
            }),
          });
          if (!saveRes.ok) {
            const data = await saveRes.json().catch(() => ({}));
            const updErrMsg =
              typeof data.error === 'object' && data.error ? data.error.message : data.error;
            throw new Error(data.message || updErrMsg || 'Failed to update draft');
          }
        }

        res = await authedFetch(
          `/api/partners/hosts/events/${draftId}/${isResubmission ? 'resubmit' : 'submit'}`,
          {
            method: isResubmission ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostNote: payload.hostNote || null }),
          },
        );
      } else {
        const endpoint = effectiveDraftId
          ? `/api/events/${effectiveDraftId}`
          : '/api/events/create';
        const method = effectiveDraftId ? 'PATCH' : 'POST';
        res = await authedFetch(endpoint, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            method === 'PATCH'
              ? {
                  actor: {
                    uid: profile?.uid,
                    role: role,
                    partnerId: profile?.activeMembership?.partnerId,
                  },
                  updates: createSafeEventPatch(payload),
                  action: isDraft ? 'draft' : role === 'venue' ? 'publish' : 'submit',
                }
              : payload,
          ),
        });
      }

      if (res.ok) {
        const eventResult = await res.json();
        const draftId = eventResult.id || eventResult.event?.id;

        if (profile?.uid) {
          const storageKey = `c1rcle_draft_event_v2_${profile.uid}_${savedDraftId || 'new'}`;
          localStorage.removeItem(storageKey);
        }

        if (draftId && !savedDraftId) {
          setSavedDraftId(draftId);
          const params = new URLSearchParams(searchParams.toString());
          params.set('id', draftId);
          router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        }

        if (!isDraft) {
          setIsSuccess(true);
        } else {
          setSaveState('saved');
        }
      } else {
        const data = await res.json();
        const errMsg =
          typeof data.error === 'object' && data.error ? data.error.message : data.error;
        alert(`Error: ${data.message || errMsg || 'Failed to create event'}`);
      }
    } catch (err: any) {
      console.error('Submission failed', err);
      setSaveState('failed');
      alert(
        `Error: ${err?.message || 'Failed to save event. Please check that the API gateway is running on port 4000.'}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingDraft) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-body text-muted">Loading your draft...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="mb-8 relative inline-block">
            <div className="absolute inset-0 bg-green-500/10 rounded-full scale-150 blur-2xl opacity-50" />
            <div className="relative bg-green-500 rounded-full p-6 shadow-xl">
              <CheckCircle2 className="h-12 w-12 text-text-primary" />
            </div>
          </div>
          <h1 className="text-headline text-text-primary mb-4">
            {role === 'venue' ? 'Event Published!' : 'Slot Request Submitted!'}
          </h1>
          <p className="text-body text-text-tertiary mb-8">
            {role === 'venue'
              ? 'Your event is now live and ready for guests to discover.'
              : "Your slot request has been sent to the venue. You'll be notified once they respond."}
          </p>
          {role === 'host' && (
            <div className="p-4 rounded-xl bg-surface-secondary mb-8">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {formData.venueName || 'Venue'}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {formData.startDate} • {formData.startTime} - {formData.endTime}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={() =>
                router.push(role === 'venue' ? '/venue/events' : '/host/events/requests')
              }
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
      <div className="min-h-screen bg-surface-base">
        <div className="max-w-6xl mx-auto px-6 pt-1 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-title-lg text-text-primary uppercase tracking-tight font-black">
                Create Event
              </h1>
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
          <div className="flex flex-col lg:flex-row gap-4">
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
                          <div className="bg-surface-base rounded-[20px] p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
                              </div>
                              <div>
                                <p className="text-[13px] font-black uppercase tracking-wider text-text-primary">
                                  Sequence Recovery Available
                                </p>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1 opacity-60">
                                  High-fidelity session state detected
                                </p>
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
                                className="px-8 py-3 bg-indigo-600 text-text-primary rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-500/30"
                              >
                                Restore Snapshot
                              </button>
                              <button
                                onClick={() => setShowRecoveryBanner(false)}
                                className="px-6 py-3 bg-surface-secondary text-text-tertiary rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-surface-tertiary transition-all"
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
                      prefilledSlot={prefilledSlot}
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
                    <PromoterStep formData={formData} updateFormData={updateFormData} role={role} />
                  )}

                  {currentStep === 'media' && (
                    <MediaStep formData={formData} updateFormData={updateFormData} />
                  )}

                  {currentStep === 'review' && (
                    <div className="space-y-8">
                      {/* Balance Sheet - UNCHANGED */}
                      <DetailedBreakdown formData={formData} />

                      {/* Show validation errors if any */}
                      {stepValidation.review.issues.length > 0 && (
                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 space-y-2">
                          <p className="font-bold text-sm">
                            Please resolve the following issues before publishing:
                          </p>
                          <ul className="list-disc pl-5 text-xs space-y-1">
                            {stepValidation.review.issues.map((issue, idx) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Navigation Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-subtle">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={prevStep}
                        className="btn btn-secondary btn-sm flex items-center gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <button
                        onClick={() => handleSubmit(true)}
                        className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors font-bold uppercase tracking-widest"
                      >
                        Save Draft
                      </button>
                    </div>

                    {currentStep === 'review' ? (
                      <button
                        disabled={isSubmitting || !stepValidation.review.isValid}
                        onClick={() => {
                          if (validateCurrentStep()) {
                            setShowPublishModal(true);
                          }
                        }}
                        className="btn btn-primary btn-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        Continue <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={nextStep}
                        className="btn btn-primary btn-sm flex items-center gap-2"
                      >
                        Continue <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Preview Sidebar */}
            <div className="w-full lg:w-[350px] lg:sticky lg:top-4 self-start space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                  Preview
                </span>
                <SaveStatus status={saveState} />
              </div>

              <div className="flex justify-center">
                <div onClick={() => setIsFullPagePreviewOpen(true)}>
                  <GuestPortalPosterPreview
                    event={formData}
                    host={previewHost}
                    width={300}
                    height={380}
                  />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="px-2 space-y-1">
                <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
                  <span className="text-[11px] font-medium text-text-tertiary">
                    Inventory Value
                  </span>
                  <span className="text-[13px] font-black text-text-primary">
                    {formatCurrency(grandTotal.revenue)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
                  <span className="text-[11px] font-medium text-text-tertiary">Total Capacity</span>
                  <span className="text-[13px] font-black text-text-primary">
                    {grandTotal.capacity}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-caption">Ticket Tiers</span>
                  <span className="text-body font-bold">{formData.tickets?.length || 0}</span>
                </div>
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
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-zinc-900">
                <button
                  onClick={() => setIsFullPagePreviewOpen(false)}
                  className="flex items-center gap-2 text-text-primary hover:text-text-placeholder"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-[11px] font-bold uppercase">
                    Back to {currentStepConfig?.shortLabel || 'Wizard'}
                  </span>
                </button>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-bold uppercase text-text-primary/40">
                    Preview Mode
                  </span>
                  <button
                    onClick={() => setIsFullPagePreviewOpen(false)}
                    aria-label="Close preview"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-text-primary/70 transition hover:bg-white/5 hover:text-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <GuestPortalEventPreview
                  event={{ ...formData, id: 'preview-id' }}
                  host={previewHost}
                  onBack={() => setIsFullPagePreviewOpen(false)}
                  backLabel={`Back to ${currentStepConfig?.shortLabel || 'Wizard'}`}
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
        hostNote={formData.hostNote || ''}
        onHostNoteChange={(value) => setFormData((prev: any) => ({ ...prev, hostNote: value }))}
      />
    </>
  );
}
