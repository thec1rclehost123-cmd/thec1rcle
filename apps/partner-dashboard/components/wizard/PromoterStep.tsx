'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Percent,
  Search,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Pencil,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

type CommissionType = 'percent' | 'fixed';
type CompensationModel = 'standard' | 'custom' | 'salary';

interface PromoterCommissionOverride {
  hasCustomCommission: boolean;
  tierRates?: Record<string, number>;
  globalRate?: number;
  globalRateType?: CommissionType;
}

interface Promoter {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  instagram?: string;
  connectionId?: string;
}

// Mirrors apps/partner-dashboard/components/wizard/components/DetailedBreakdown.tsx —
// both consume POST /api/events/wizard (events.ts preview-breakdown route).
interface WizardSubtotal {
  quantity: number;
  value: number;
  discTotal: number;
  commTotal: number;
  net: number;
}

interface WizardBreakdown {
  grandTotal: WizardSubtotal;
  venueSharePct: number;
  promoterSharePct: number;
}

interface PromoterStepProps {
  formData: any;
  updateFormData: (updates: any) => void;
  role: 'venue' | 'host';
}

const PAGE_SIZE = 8;

function formatRate(type: CommissionType | undefined, value: number | undefined | '') {
  const v = value === '' || value === undefined || value === null ? 0 : Number(value);
  return (type || 'percent') === 'percent' ? `${v}%` : `₹${v}`;
}

const MODEL_SWITCH_COPY: Record<string, { title: string; message: string }> = {
  'standard->custom': {
    title: 'Switch to Custom Commission?',
    message: 'Global commission will be removed and replaced with ticket-level commissions.',
  },
  'custom->standard': {
    title: 'Replace Custom Commissions?',
    message:
      'All custom commission mappings will be deleted and replaced with one global commission.',
  },
  'standard->salary': {
    title: 'Change Compensation Model?',
    message: 'Global commission will be removed. Promoters will be paid salary instead.',
  },
  'custom->salary': {
    title: 'Change Compensation Model?',
    message:
      'Ticket-level commissions and promoter overrides will be removed. Promoters will be paid salary instead.',
  },
  'salary->standard': {
    title: 'Change Compensation Model?',
    message: 'Salary-based payout settings will be removed.',
  },
  'salary->custom': {
    title: 'Change Compensation Model?',
    message: 'Salary-based payout settings will be removed.',
  },
};

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Continue',
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-sm rounded-2xl bg-[var(--v-card)] border border-border-default p-6 space-y-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(244,74,34,0.12)] flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-[var(--v-orange)]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[var(--v-text-primary)]">{title}</p>
              <p className="text-[12px] text-[var(--v-text-secondary)] mt-1">{message}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border-default text-[12px] font-bold text-[var(--v-text-primary)] hover:bg-white/[0.03] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--v-orange)] text-white text-[12px] font-bold hover:opacity-90 transition-opacity"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export function PromoterStep({ formData, updateFormData, role }: PromoterStepProps) {
  const { user } = useDashboardAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [connectedPromoters, setConnectedPromoters] = useState<Promoter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDiscountSettings, setShowDiscountSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'assign' | 'compensation'>('assign');

  const [commissionSearch, setCommissionSearch] = useState('');
  const [commissionPage, setCommissionPage] = useState(1);
  const [expandedPromoter, setExpandedPromoter] = useState<string | null>(null);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftRates, setDraftRates] = useState<Record<string, number>>({});
  const [draftGlobalRate, setDraftGlobalRate] = useState<number>(0);
  const [draftGlobalRateType, setDraftGlobalRateType] = useState<CommissionType>('percent');
  const [pendingModelSwitch, setPendingModelSwitch] = useState<CompensationModel | null>(null);
  const [deselectConfirm, setDeselectConfirm] = useState<string | null>(null);

  const selectedIds: string[] = Array.isArray(formData.promoters) ? formData.promoters : [];
  const entityId = role === 'venue' ? formData.venueId : formData.creatorId;
  const tickets: Array<{
    id: string;
    name: string;
    price: number | '';
    commissionType?: CommissionType;
    commissionValue?: number | '';
  }> = formData.tickets || [];
  // Free (RSVP) tiers — price 0 — can never carry a commission, so they're
  // excluded from every commission-configuration surface below.
  const commissionableTickets = tickets.filter((t) => (Number(t.price) || 0) > 0);
  const overrides: Record<string, PromoterCommissionOverride> =
    formData.promoterCommissionOverrides || {};
  const model: CompensationModel = formData.compensationModel || 'standard';
  const standardType: CommissionType = formData.commissionType === 'fixed' ? 'fixed' : 'percent';
  const standardValue: number = Number(formData.commission) || 0;
  const tablesCommissionType: CommissionType =
    formData.tablesCommissionType === 'fixed' ? 'fixed' : 'percent';
  const tablesCommissionValue: number = Number(formData.tablesCommissionValue) || 0;

  useEffect(() => {
    if (!user || !entityId) return;

    const fetchConnectedPromoters = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/promoters/connections?entityId=${encodeURIComponent(entityId)}&entityType=${role}&status=approved`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error('Failed to fetch connected promoters');
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.connections || data.data || [];
        const mapped = list.map((c: any) => ({
          id: c.promoterId || c.otherId || c.id,
          name: c.promoterName || c.otherName || c.name || 'Unknown Promoter',
          email: c.promoterEmail || c.email,
          phone: c.promoterPhone || c.phone,
          instagram: c.promoterInstagram || c.instagram,
          connectionId: c.id,
        }));
        // Deduplicate by promoter id — the API may return multiple connection
        // records for the same promoter (e.g. pending + approved overlap).
        const seen = new Set<string>();
        const unique = mapped.filter((p: Promoter) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        setConnectedPromoters(unique);
      } catch (err: any) {
        console.error('[PromoterStep] Fetch error:', err);
        setError(err.message || 'Could not load promoter list');
      } finally {
        setLoading(false);
      }
    };

    fetchConnectedPromoters();
  }, [user, entityId, role]);

  const filteredPromoters = useMemo(() => {
    if (!searchQuery.trim()) return connectedPromoters;
    const q = searchQuery.toLowerCase();
    return connectedPromoters.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.instagram || '').toLowerCase().includes(q),
    );
  }, [connectedPromoters, searchQuery]);

  const assignedPromoters = useMemo(() => {
    return connectedPromoters.filter((p) => selectedIds.includes(p.id));
  }, [connectedPromoters, selectedIds]);

  const commissionFiltered = useMemo(() => {
    if (!commissionSearch.trim()) return assignedPromoters;
    const q = commissionSearch.toLowerCase();
    return assignedPromoters.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q),
    );
  }, [assignedPromoters, commissionSearch]);

  const commissionTotalPages = Math.max(1, Math.ceil(commissionFiltered.length / PAGE_SIZE));
  const commissionPageSafe = Math.min(commissionPage, commissionTotalPages);
  const commissionPaged = commissionFiltered.slice(
    (commissionPageSafe - 1) * PAGE_SIZE,
    commissionPageSafe * PAGE_SIZE,
  );

  const toggle = (promoterId: string) => {
    if (selectedIds.includes(promoterId)) {
      setDeselectConfirm(promoterId);
      return;
    }
    updateFormData({ promoters: [...selectedIds, promoterId] });
  };

  const confirmDeselect = () => {
    if (!deselectConfirm) return;
    updateFormData({ promoters: selectedIds.filter((id) => id !== deselectConfirm) });
    setDeselectConfirm(null);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredPromoters.length && filteredPromoters.length > 0) {
      updateFormData({ promoters: [] });
    } else {
      updateFormData({ promoters: filteredPromoters.map((p) => p.id) });
    }
  };

  const updatePromoterSetting = (key: string, value: any) => {
    updateFormData({ [key]: value });
  };

  const updateTierCommission = (
    tierId: string,
    patch: Partial<{ commissionType: CommissionType; commissionValue: number | '' }>,
  ) => {
    const updated = tickets.map((t) => (t.id === tierId ? { ...t, ...patch } : t));
    updateFormData({ tickets: updated });
  };

  const requestModelSwitch = (target: CompensationModel) => {
    if (target === model) return;
    setPendingModelSwitch(target);
  };

  const applyModelSwitch = () => {
    if (!pendingModelSwitch) return;
    const updates: any = { compensationModel: pendingModelSwitch };
    if (model === 'custom' && pendingModelSwitch !== 'custom') {
      updates.promoterCommissionOverrides = {};
      updates.tickets = tickets.map((t) => ({
        ...t,
        commissionType: undefined,
        commissionValue: undefined,
      }));
      if (pendingModelSwitch === 'salary') {
        updates.tablesCommissionType = undefined;
        updates.tablesCommissionValue = undefined;
      }
    }
    if (model === 'standard' && pendingModelSwitch === 'salary') {
      updates.tablesCommissionType = undefined;
      updates.tablesCommissionValue = undefined;
    }
    if (model === 'salary' && pendingModelSwitch !== 'salary') {
      updates.salaryTableIncentivesEnabled = false;
      updates.salaryTableIncentiveValue = undefined;
      updates.salaryNotes = '';
    }
    updateFormData(updates);
    toastSuccess('Compensation Model Updated', `Switched to ${pendingModelSwitch} commission.`);
    setPendingModelSwitch(null);
  };

  const openExpand = (promoter: Promoter) => {
    const override = overrides[promoter.id];
    const isCustom = !!override?.hasCustomCommission;
    setExpandedPromoter(promoter.id);
    setDraftEnabled(isCustom);
    if (model === 'standard') {
      setDraftGlobalRate(
        isCustom && override?.globalRate !== undefined ? override.globalRate : standardValue,
      );
      setDraftGlobalRateType(
        isCustom && override?.globalRateType ? override.globalRateType : standardType,
      );
    } else {
      const initial: Record<string, number> = {};
      commissionableTickets.forEach((t) => {
        const ov = override?.tierRates?.[t.id];
        initial[t.id] = ov ?? (typeof t.commissionValue === 'number' ? t.commissionValue : 0);
      });
      setDraftRates(initial);
    }
  };

  const closeExpand = () => {
    setExpandedPromoter(null);
    setDraftEnabled(false);
    setDraftRates({});
    setDraftGlobalRate(0);
    setDraftGlobalRateType('percent');
  };

  const saveExpand = (promoterId: string) => {
    let next: PromoterCommissionOverride;
    if (model === 'standard') {
      next = draftEnabled
        ? {
            hasCustomCommission: true,
            globalRate: draftGlobalRate,
            globalRateType: draftGlobalRateType,
          }
        : { hasCustomCommission: false };
    } else {
      if (draftEnabled) {
        for (const [tierId, value] of Object.entries(draftRates)) {
          if (Number.isNaN(value) || value < 0) {
            toastError('Invalid Commission', 'Enter a commission value of 0 or more.');
            return;
          }
          const tier = tickets.find((t) => t.id === tierId);
          if ((tier?.commissionType || 'percent') === 'percent' && value > 100) {
            toastError('Invalid Commission', 'Percentage commission cannot exceed 100%.');
            return;
          }
        }
      }
      next = {
        hasCustomCommission: draftEnabled,
        tierRates: draftEnabled ? draftRates : undefined,
      };
    }
    updateFormData({ promoterCommissionOverrides: { ...overrides, [promoterId]: next } });
    toastSuccess(
      next.hasCustomCommission ? 'Custom Commission Saved' : 'Reverted to Event Default',
      next.hasCustomCommission
        ? 'This promoter now has a custom rate.'
        : 'This promoter now follows the event default commission.',
    );
    closeExpand();
  };

  // Revenue projections are always server-computed (see
  // POST /events/wizard/preview-breakdown) — the same contract
  // DetailedBreakdown.tsx uses on the Review step — so this never
  // duplicates that math client-side.
  const [breakdown, setBreakdown] = useState<WizardBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => {
    if (!formData.promotersEnabled) return;
    let cancelled = false;
    setBreakdownLoading(true);
    fetch('/api/events/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setBreakdown(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData]);

  const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* Section 1: Enable Promoters */}
      <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[rgba(244,74,34,0.12)] flex items-center justify-center">
              <Percent className="w-4 h-4 text-[var(--v-orange)]" />
            </div>
            <div className="text-left">
              <p className="text-[13px] font-bold text-[var(--v-text-primary)]">Enable Promoters</p>
              <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                Allow promoters to sell tickets for this event
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.promotersEnabled}
            onClick={() => updatePromoterSetting('promotersEnabled', !formData.promotersEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${formData.promotersEnabled ? 'bg-[var(--v-orange)]' : 'bg-white/10'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formData.promotersEnabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      {formData.promotersEnabled && (
        <>
          {/* Sub-navigation Tabs */}
          <div className="flex p-1 bg-white/[0.03] rounded-xl border border-border-subtle w-full max-w-md mx-auto mb-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('assign')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                activeSubTab === 'assign'
                  ? 'bg-[var(--v-orange)] text-white shadow-sm font-black'
                  : 'text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)]'
              }`}
            >
              Assign Promoters
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('compensation')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                activeSubTab === 'compensation'
                  ? 'bg-[var(--v-orange)] text-white shadow-sm font-black'
                  : 'text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)]'
              }`}
            >
              Sales & Distribution
            </button>
          </div>

          {activeSubTab === 'assign' && (
            /* Section 4: Assign Promoters */
            <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden animate-in fade-in duration-200">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(56,122,255,0.12)] flex items-center justify-center">
                      <Users className="w-4 h-4 text-[#7aa2ff]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[var(--v-text-primary)]">
                        Assign Promoters
                      </p>
                      <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                        {loading
                          ? 'Loading...'
                          : `${connectedPromoters.length} connected · ${selectedIds.length} selected`}
                      </p>
                    </div>
                  </div>
                  {connectedPromoters.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-[10px] font-black uppercase tracking-widest text-[#7aa2ff] hover:text-[#5a82df] transition-colors"
                    >
                      {selectedIds.length === filteredPromoters.length &&
                      filteredPromoters.length > 0
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="px-6 py-3 border-b border-border-subtle">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--v-text-muted)]" />
                  <input
                    type="text"
                    aria-label="Search promoters"
                    placeholder="Search promoters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[12px] bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[#7aa2ff] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3 h-3 text-[var(--v-text-muted)]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Promoter List */}
              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--v-text-muted)]" />
                  </div>
                ) : error ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-[12px] text-red-400 font-medium">{error}</p>
                    <p className="text-[10px] text-[var(--v-text-secondary)] mt-1">
                      Connect promoters in your {role === 'venue' ? 'venue' : 'host'} settings
                    </p>
                  </div>
                ) : connectedPromoters.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                      <Users className="w-5 h-5 text-[var(--v-text-muted)]" />
                    </div>
                    <p className="text-[13px] font-bold text-[var(--v-text-primary)]">
                      No connected promoters
                    </p>
                    <p className="text-[10px] text-[var(--v-text-secondary)] mt-1">
                      {role === 'venue'
                        ? 'Invite promoters in your Promoters section to get started'
                        : 'Request promoter partnerships in your Promoters section'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {filteredPromoters.length === 0 && searchQuery ? (
                      <div className="px-6 py-8 text-center">
                        <p className="text-[12px] text-[var(--v-text-secondary)]">
                          No promoters match "{searchQuery}"
                        </p>
                      </div>
                    ) : (
                      filteredPromoters.map((promoter) => {
                        const isSelected = selectedIds.includes(promoter.id);
                        return (
                          <button
                            key={promoter.id}
                            type="button"
                            onClick={() => toggle(promoter.id)}
                            className={`w-full flex items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-white/[0.02] ${isSelected ? 'bg-[rgba(56,122,255,0.06)]' : ''}`}
                          >
                            {/* Checkbox */}
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-[#7aa2ff] border-[#7aa2ff]' : 'border-white/20'}`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-[var(--v-text-primary)] truncate">
                                {promoter.name}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-[var(--v-text-secondary)] font-medium">
                                {promoter.email && (
                                  <span className="truncate">{promoter.email}</span>
                                )}
                                {promoter.instagram && (
                                  <span className="truncate text-purple-400">
                                    @{promoter.instagram}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Badge */}
                            {isSelected && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#7aa2ff] flex-shrink-0">
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Selection Summary Footer */}
              {selectedIds.length > 0 && (
                <div className="px-6 py-3 border-t border-border-subtle bg-[rgba(56,122,255,0.04)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] font-bold text-emerald-400">
                        {selectedIds.length} promoter{selectedIds.length > 1 ? 's' : ''} assigned
                      </span>
                    </div>
                    <div className="flex -space-x-2">
                      {connectedPromoters
                        .filter((p) => selectedIds.includes(p.id))
                        .slice(0, 5)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="w-7 h-7 rounded-full bg-[var(--v-card)] border border-border-default flex items-center justify-center"
                            title={p.name}
                          >
                            <span className="text-[9px] font-bold text-[var(--v-text-secondary)]">
                              {p.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        ))}
                      {selectedIds.length > 5 && (
                        <div className="w-7 h-7 rounded-full bg-[var(--v-card)] border border-border-default flex items-center justify-center">
                          <span className="text-[9px] font-bold text-[var(--v-text-secondary)]">
                            +{selectedIds.length - 5}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'compensation' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Section 2b: Revenue Summary */}
              <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden px-6 py-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)] mb-3">
                  Revenue Summary (Estimated)
                </p>
                {breakdownLoading && !breakdown ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--v-text-muted)]" />
                  </div>
                ) : !breakdown ? (
                  <p className="text-[12px] text-[var(--v-text-secondary)]">
                    Unable to load estimate.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-[var(--v-text-muted)] font-bold uppercase tracking-widest">
                        Gross Revenue
                      </p>
                      <p className="text-[16px] font-black text-[var(--v-text-primary)]">
                        {formatINR(breakdown.grandTotal.value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--v-text-muted)] font-bold uppercase tracking-widest">
                        Promoter Commission
                      </p>
                      {model === 'salary' && !formData.salaryTableIncentivesEnabled ? (
                        <p className="text-[12px] font-bold text-[var(--v-text-secondary)] mt-1">
                          Handled outside the event
                        </p>
                      ) : (
                        <p className="text-[16px] font-black text-[var(--v-orange)]">
                          {formatINR(breakdown.grandTotal.commTotal)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--v-text-muted)] font-bold uppercase tracking-widest">
                        Venue Revenue
                      </p>
                      <p className="text-[16px] font-black text-emerald-500">
                        {formatINR(breakdown.grandTotal.net)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {formData.isRSVP ? (
                /* RSVP events have no paid tickets — commission can never be
                   configured, so the whole compensation section is disabled
                   rather than showing inputs that can't apply to anything. */
                <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden px-6 py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                    <Percent className="w-5 h-5 text-[var(--v-text-muted)]" />
                  </div>
                  <p className="text-[13px] font-bold text-[var(--v-text-primary)]">
                    Commission Unavailable
                  </p>
                  <p className="text-[10px] text-[var(--v-text-secondary)] mt-1">
                    This event is RSVP-only — every ticket is free, so there's no revenue to
                    commission.
                  </p>
                </div>
              ) : (
                <>
                  {/* Section 2: Promoter Compensation */}
                  <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden">
                    <div className="px-6 py-4 border-b border-border-subtle">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-[rgba(244,74,34,0.12)] flex items-center justify-center">
                          <Percent className="w-4 h-4 text-[var(--v-orange)]" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-[var(--v-text-primary)]">
                            Promoter Compensation
                          </p>
                          <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                            Only one promoter compensation model can be used per event.
                          </p>
                        </div>
                      </div>

                      <div className="flex p-0.5 bg-white/[0.03] rounded-xl border border-border-subtle w-fit mt-3">
                        {(
                          [
                            { id: 'standard', label: 'Standard' },
                            { id: 'custom', label: 'Custom' },
                            { id: 'salary', label: 'Salary' },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => requestModelSwitch(m.id)}
                            className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                              model === m.id
                                ? 'bg-[var(--v-orange)] text-white shadow-sm'
                                : 'text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)]'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {model === 'standard' && (
                        <motion.div
                          key="standard"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="px-6 py-5 space-y-4"
                        >
                          <div>
                            <label className="text-[11px] font-bold text-[var(--v-text-secondary)] mb-1.5 block">
                              Global Commission
                            </label>
                            <div className="flex items-center gap-3">
                              <div className="flex p-0.5 bg-white/[0.03] rounded-xl border border-border-subtle w-fit">
                                {(
                                  [
                                    { v: 'percent', l: 'Percentage' },
                                    { v: 'fixed', l: 'Fixed Amount' },
                                  ] as const
                                ).map(({ v, l }) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => updatePromoterSetting('commissionType', v)}
                                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                      standardType === v
                                        ? 'bg-[var(--v-orange)] text-white shadow-sm'
                                        : 'text-[var(--v-text-secondary)]'
                                    }`}
                                  >
                                    {l}
                                  </button>
                                ))}
                              </div>
                              <input
                                type="number"
                                min={0}
                                max={standardType === 'percent' ? 100 : undefined}
                                value={formData.commission}
                                onChange={(e) => {
                                  const raw = Math.max(0, Number(e.target.value));
                                  updatePromoterSetting(
                                    'commission',
                                    standardType === 'percent' ? Math.min(100, raw) : raw,
                                  );
                                }}
                                className="w-24 px-3 py-2 text-[14px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[var(--v-orange)] text-[var(--v-text-primary)]"
                              />
                              <span className="text-[13px] font-bold text-[var(--v-text-muted)]">
                                {standardType === 'percent' ? '%' : 'INR'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-border-subtle">
                            <Sparkles className="w-3.5 h-3.5 text-[var(--v-orange)] flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-[var(--v-text-secondary)] font-medium">
                              One percentage for all ticket tiers. New tiers automatically inherit
                              this rate. Use Per-Promoter Override below to give a specific promoter
                              a different rate.
                            </p>
                          </div>

                          {formData.tablesEnabled && (
                            <div className="pt-4 border-t border-border-subtle space-y-3">
                              <p className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)]">
                                Tables Commission
                              </p>
                              <div className="flex items-center gap-3">
                                <div className="flex p-0.5 bg-white/[0.03] rounded-xl border border-border-subtle w-fit">
                                  {(
                                    [
                                      { v: 'percent', l: 'Percentage' },
                                      { v: 'fixed', l: 'Fixed Amount' },
                                    ] as const
                                  ).map(({ v, l }) => (
                                    <button
                                      key={v}
                                      type="button"
                                      onClick={() =>
                                        updatePromoterSetting('tablesCommissionType', v)
                                      }
                                      className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                        tablesCommissionType === v
                                          ? 'bg-[var(--v-orange)] text-white shadow-sm'
                                          : 'text-[var(--v-text-secondary)]'
                                      }`}
                                    >
                                      {l}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  max={tablesCommissionType === 'percent' ? 100 : undefined}
                                  value={formData.tablesCommissionValue ?? ''}
                                  onChange={(e) => {
                                    if (e.target.value === '') {
                                      updatePromoterSetting('tablesCommissionValue', '');
                                      return;
                                    }
                                    const raw = Math.max(0, Number(e.target.value));
                                    updatePromoterSetting(
                                      'tablesCommissionValue',
                                      tablesCommissionType === 'percent' ? Math.min(100, raw) : raw,
                                    );
                                  }}
                                  placeholder="e.g. 15"
                                  className="w-24 px-3 py-2 text-[14px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[var(--v-orange)] text-[var(--v-text-primary)]"
                                />
                                <span className="text-[13px] font-bold text-[var(--v-text-muted)]">
                                  {tablesCommissionType === 'percent' ? '%' : 'INR per table sold'}
                                </span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {model === 'custom' && (
                        <motion.div
                          key="custom"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="divide-y divide-border-subtle"
                        >
                          {/* Ticket Tier Commission Mapping */}
                          <div className="px-6 py-5 space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)]">
                              Ticket Tier Commission Mapping
                            </p>
                            {tickets.length === 0 ? (
                              <p className="text-[12px] text-[var(--v-text-secondary)]">
                                Add ticket tiers in the Ticketing &amp; Pricing step first.
                              </p>
                            ) : commissionableTickets.length === 0 ? (
                              <p className="text-[12px] text-[var(--v-text-secondary)]">
                                All ticket tiers are free — there's nothing to configure a
                                commission on.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {commissionableTickets.map((tier) => {
                                  const isBlank =
                                    tier.commissionValue === undefined ||
                                    tier.commissionValue === '';
                                  const type = tier.commissionType || 'percent';
                                  const exceedsPrice =
                                    type === 'fixed' &&
                                    !isBlank &&
                                    Number(tier.commissionValue) > (Number(tier.price) || 0);
                                  return (
                                    <div
                                      key={tier.id}
                                      className="p-3 rounded-xl bg-white/[0.03] border border-border-subtle space-y-2"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="text-[13px] font-bold text-[var(--v-text-primary)] truncate">
                                          {tier.name || 'Untitled Tier'}
                                        </p>
                                        {isBlank && (
                                          <Badge tone="error" size="sm">
                                            Commission Required
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex p-0.5 bg-white/[0.03] rounded-lg border border-border-subtle">
                                          {(
                                            [
                                              { v: 'percent', l: '%' },
                                              { v: 'fixed', l: '₹' },
                                            ] as const
                                          ).map(({ v, l }) => (
                                            <button
                                              key={v}
                                              type="button"
                                              onClick={() =>
                                                updateTierCommission(tier.id, { commissionType: v })
                                              }
                                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${type === v ? 'bg-[var(--v-orange)] text-white' : 'text-[var(--v-text-secondary)]'}`}
                                            >
                                              {l}
                                            </button>
                                          ))}
                                        </div>
                                        <input
                                          type="number"
                                          min={0}
                                          max={type === 'percent' ? 100 : undefined}
                                          value={tier.commissionValue ?? ''}
                                          onChange={(e) => {
                                            if (e.target.value === '') {
                                              updateTierCommission(tier.id, {
                                                commissionValue: '',
                                              });
                                              return;
                                            }
                                            const raw = Math.max(0, Number(e.target.value));
                                            updateTierCommission(tier.id, {
                                              commissionValue:
                                                type === 'percent' ? Math.min(100, raw) : raw,
                                            });
                                          }}
                                          placeholder="Required"
                                          className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-border-subtle text-[13px] font-bold text-[var(--v-text-primary)] focus:outline-none focus:border-[var(--v-orange)]"
                                        />
                                      </div>
                                      {exceedsPrice && (
                                        <p className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3" /> Commission exceeds
                                          ticket value.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Tables Commission */}
                          {formData.tablesEnabled && (
                            <div className="px-6 py-5 space-y-3">
                              <p className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)]">
                                Tables Commission
                              </p>
                              <div className="flex items-center gap-3">
                                <div className="flex p-0.5 bg-white/[0.03] rounded-xl border border-border-subtle w-fit">
                                  {(
                                    [
                                      { v: 'percent', l: 'Percentage' },
                                      { v: 'fixed', l: 'Fixed Amount' },
                                    ] as const
                                  ).map(({ v, l }) => (
                                    <button
                                      key={v}
                                      type="button"
                                      onClick={() =>
                                        updatePromoterSetting('tablesCommissionType', v)
                                      }
                                      className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                        tablesCommissionType === v
                                          ? 'bg-[var(--v-orange)] text-white shadow-sm'
                                          : 'text-[var(--v-text-secondary)]'
                                      }`}
                                    >
                                      {l}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  max={tablesCommissionType === 'percent' ? 100 : undefined}
                                  value={formData.tablesCommissionValue ?? ''}
                                  onChange={(e) => {
                                    if (e.target.value === '') {
                                      updatePromoterSetting('tablesCommissionValue', '');
                                      return;
                                    }
                                    const raw = Math.max(0, Number(e.target.value));
                                    updatePromoterSetting(
                                      'tablesCommissionValue',
                                      tablesCommissionType === 'percent' ? Math.min(100, raw) : raw,
                                    );
                                  }}
                                  placeholder="e.g. 15"
                                  className="w-24 px-3 py-2 text-[14px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[var(--v-orange)] text-[var(--v-text-primary)]"
                                />
                                <span className="text-[13px] font-bold text-[var(--v-text-muted)]">
                                  {tablesCommissionType === 'percent' ? '%' : 'INR per table sold'}
                                </span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {model === 'salary' && (
                        <motion.div
                          key="salary"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="px-6 py-5 space-y-4"
                        >
                          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-border-subtle">
                            <Wallet className="w-3.5 h-3.5 text-[var(--v-orange)] flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-[var(--v-text-secondary)] font-medium">
                              Promoters are paid outside the platform through salary.
                            </p>
                          </div>

                          <label className="flex items-center justify-between cursor-pointer">
                            <div>
                              <p className="text-[12px] font-bold text-[var(--v-text-primary)]">
                                Enable Table Incentives
                              </p>
                              <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                                Optionally still reward table sales
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={formData.salaryTableIncentivesEnabled}
                              onClick={() =>
                                updatePromoterSetting(
                                  'salaryTableIncentivesEnabled',
                                  !formData.salaryTableIncentivesEnabled,
                                )
                              }
                              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${formData.salaryTableIncentivesEnabled ? 'bg-[var(--v-orange)]' : 'bg-white/10'}`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formData.salaryTableIncentivesEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                              />
                            </button>
                          </label>

                          {formData.salaryTableIncentivesEnabled &&
                            (formData.tablesEnabled ? (
                              <div className="flex items-center gap-3">
                                <div className="flex p-0.5 bg-white/[0.03] rounded-xl border border-border-subtle w-fit">
                                  {(
                                    [
                                      { v: 'percent', l: 'Percentage' },
                                      { v: 'fixed', l: 'Fixed Amount' },
                                    ] as const
                                  ).map(({ v, l }) => (
                                    <button
                                      key={v}
                                      type="button"
                                      onClick={() =>
                                        updatePromoterSetting('salaryTableIncentiveType', v)
                                      }
                                      className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                        (formData.salaryTableIncentiveType || 'percent') === v
                                          ? 'bg-[var(--v-orange)] text-white shadow-sm'
                                          : 'text-[var(--v-text-secondary)]'
                                      }`}
                                    >
                                      {l}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  value={formData.salaryTableIncentiveValue ?? ''}
                                  onChange={(e) => {
                                    if (e.target.value === '') {
                                      updatePromoterSetting('salaryTableIncentiveValue', '');
                                      return;
                                    }
                                    const raw = Math.max(0, Number(e.target.value));
                                    const isPct =
                                      (formData.salaryTableIncentiveType || 'percent') ===
                                      'percent';
                                    updatePromoterSetting(
                                      'salaryTableIncentiveValue',
                                      isPct ? Math.min(100, raw) : raw,
                                    );
                                  }}
                                  placeholder="e.g. 10"
                                  className="w-24 px-3 py-2 text-[14px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[var(--v-orange)] text-[var(--v-text-primary)]"
                                />
                                <span className="text-[13px] font-bold text-[var(--v-text-muted)]">
                                  {(formData.salaryTableIncentiveType || 'percent') === 'percent'
                                    ? '%'
                                    : 'INR per table'}
                                </span>
                              </div>
                            ) : (
                              <p className="text-[12px] text-[var(--v-text-secondary)]">
                                Enable Table Reservations in the Tables &amp; VIP step to configure
                                incentives.
                              </p>
                            ))}

                          <div>
                            <label className="text-[11px] font-bold text-[var(--v-text-secondary)] mb-1.5 block">
                              Salary Notes
                            </label>
                            <textarea
                              value={formData.salaryNotes || ''}
                              onChange={(e) => updatePromoterSetting('salaryNotes', e.target.value)}
                              placeholder="e.g. All ticket sales are covered under promoter salary. Table incentives will be calculated separately."
                              className="w-full px-3 py-2.5 rounded-xl bg-transparent border border-border-default text-[12px] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)] focus:outline-none focus:border-[var(--v-orange)] min-h-[72px] resize-none"
                            />
                            <p className="text-[10px] text-[var(--v-text-muted)] mt-1">
                              This note is visible in reports.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Per-Promoter Override (Standard + Custom models) ────────────── */}
                  {(model === 'standard' || model === 'custom') && (
                    <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden">
                      <div className="px-6 pt-5 pb-3 border-b border-border-subtle flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-bold text-[var(--v-text-primary)]">
                            Per-Promoter Override
                          </p>
                          <p className="text-[10px] text-[var(--v-text-secondary)] font-medium mt-0.5">
                            {model === 'standard'
                              ? 'Give a specific promoter a different rate from the global commission'
                              : 'Override per-tier rates for a specific promoter'}
                          </p>
                        </div>
                      </div>

                      <div className="px-6 py-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--v-text-muted)]" />
                          <input
                            type="text"
                            aria-label="Search promoters"
                            placeholder="Search promoters..."
                            value={commissionSearch}
                            onChange={(e) => {
                              setCommissionSearch(e.target.value);
                              setCommissionPage(1);
                            }}
                            className="w-full pl-9 pr-3 py-2 text-[12px] bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[var(--v-orange)] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)]"
                          />
                        </div>
                      </div>

                      {loading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--v-text-muted)]" />
                        </div>
                      ) : assignedPromoters.length === 0 ? (
                        <EmptyState
                          icon={Users}
                          title="No promoters assigned"
                          description="Assign promoters under the Assign Promoters tab first to configure individual overrides."
                        />
                      ) : commissionFiltered.length === 0 ? (
                        <div className="px-6 py-8 text-center">
                          <p className="text-[12px] text-[var(--v-text-secondary)]">
                            No promoters match "{commissionSearch}"
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-border-subtle">
                                  <th className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
                                    Promoter
                                  </th>
                                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
                                    Email
                                  </th>
                                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
                                    Rate
                                  </th>
                                  <th className="px-6 py-2.5 text-right" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-subtle">
                                {commissionPaged.map((promoter) => {
                                  const override = overrides[promoter.id];
                                  const isCustom = !!override?.hasCustomCommission;
                                  const isExpanded = expandedPromoter === promoter.id;
                                  return (
                                    <Fragment key={promoter.id}>
                                      <tr className="hover:bg-white/[0.02]">
                                        <td className="px-6 py-3">
                                          <p className="text-[13px] font-bold text-[var(--v-text-primary)] truncate max-w-[160px]">
                                            {promoter.name}
                                          </p>
                                        </td>
                                        <td className="px-3 py-3">
                                          <p className="text-[11px] text-[var(--v-text-secondary)] truncate max-w-[160px]">
                                            {promoter.email || '—'}
                                          </p>
                                        </td>
                                        <td className="px-3 py-3">
                                          <Badge tone={isCustom ? 'accent' : 'neutral'} size="sm">
                                            {isCustom
                                              ? model === 'standard'
                                                ? `Custom (${formatRate(override?.globalRateType || standardType, override?.globalRate)})`
                                                : 'Custom'
                                              : model === 'standard'
                                                ? `Default (${formatRate(standardType, standardValue)})`
                                                : 'Event Default'}
                                          </Badge>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              isExpanded ? closeExpand() : openExpand(promoter)
                                            }
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
                                              isExpanded
                                                ? 'border-[var(--v-orange)] text-[var(--v-orange)] bg-[rgba(244,74,34,0.06)]'
                                                : 'border-border-default text-[var(--v-text-primary)] hover:border-[var(--v-orange)] hover:text-[var(--v-orange)]'
                                            }`}
                                          >
                                            <Pencil className="w-3 h-3" />
                                            {isExpanded ? 'Close' : 'Edit'}
                                          </button>
                                        </td>
                                      </tr>
                                      {isExpanded && (
                                        <tr>
                                          <td
                                            colSpan={4}
                                            className="px-6 pb-5 pt-3 bg-white/[0.015]"
                                          >
                                            <div className="space-y-4 border-t border-border-subtle pt-4">
                                              {/* Use Event Default toggle */}
                                              <label className="flex items-center justify-between cursor-pointer">
                                                <div>
                                                  <p className="text-[12px] font-bold text-[var(--v-text-primary)]">
                                                    Use Event Default
                                                  </p>
                                                  <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                                                    Disable to set a custom rate for this promoter
                                                  </p>
                                                </div>
                                                <button
                                                  type="button"
                                                  role="switch"
                                                  aria-checked={!draftEnabled}
                                                  onClick={() => setDraftEnabled((v) => !v)}
                                                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${!draftEnabled ? 'bg-[var(--v-orange)]' : 'bg-white/10'}`}
                                                >
                                                  <span
                                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${!draftEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                                                  />
                                                </button>
                                              </label>

                                              {draftEnabled ? (
                                                model === 'standard' ? (
                                                  /* Standard — single rate override */
                                                  <div className="flex items-center gap-3">
                                                    <div className="flex p-0.5 bg-white/[0.03] rounded-xl border border-border-subtle w-fit">
                                                      {(
                                                        [
                                                          { v: 'percent', l: '%' },
                                                          { v: 'fixed', l: '₹' },
                                                        ] as const
                                                      ).map(({ v, l }) => (
                                                        <button
                                                          key={v}
                                                          type="button"
                                                          onClick={() => setDraftGlobalRateType(v)}
                                                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${draftGlobalRateType === v ? 'bg-[var(--v-orange)] text-white' : 'text-[var(--v-text-secondary)]'}`}
                                                        >
                                                          {l}
                                                        </button>
                                                      ))}
                                                    </div>
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      max={
                                                        draftGlobalRateType === 'percent'
                                                          ? 100
                                                          : undefined
                                                      }
                                                      value={draftGlobalRate}
                                                      onChange={(e) => {
                                                        const raw = Math.max(
                                                          0,
                                                          Number(e.target.value),
                                                        );
                                                        setDraftGlobalRate(
                                                          draftGlobalRateType === 'percent'
                                                            ? Math.min(100, raw)
                                                            : raw,
                                                        );
                                                      }}
                                                      className="w-20 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-border-subtle text-[13px] font-bold text-[var(--v-text-primary)] focus:outline-none focus:border-[var(--v-orange)]"
                                                    />
                                                    <span className="text-[12px] font-bold text-[var(--v-text-muted)]">
                                                      {draftGlobalRateType === 'percent'
                                                        ? '% commission'
                                                        : '₹ per ticket'}
                                                    </span>
                                                  </div>
                                                ) : /* Custom — per-tier rates */
                                                tickets.length === 0 ? (
                                                  <p className="text-[12px] text-[var(--v-text-secondary)]">
                                                    Add ticket tiers first.
                                                  </p>
                                                ) : commissionableTickets.length === 0 ? (
                                                  <p className="text-[12px] text-[var(--v-text-secondary)]">
                                                    All ticket tiers are free — nothing to override.
                                                  </p>
                                                ) : (
                                                  <div className="space-y-2">
                                                    {commissionableTickets.map((tier) => (
                                                      <div
                                                        key={tier.id}
                                                        className="flex items-center justify-between gap-3"
                                                      >
                                                        <p className="text-[12px] font-bold text-[var(--v-text-primary)] truncate">
                                                          {tier.name || 'Untitled Tier'}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                          <input
                                                            type="number"
                                                            min={0}
                                                            max={
                                                              (tier.commissionType || 'percent') ===
                                                              'percent'
                                                                ? 100
                                                                : undefined
                                                            }
                                                            value={draftRates[tier.id] ?? 0}
                                                            onChange={(e) => {
                                                              if (e.target.value === '') {
                                                                setDraftRates((prev) => ({
                                                                  ...prev,
                                                                  [tier.id]: 0,
                                                                }));
                                                                return;
                                                              }
                                                              const raw = Math.max(
                                                                0,
                                                                Number(e.target.value),
                                                              );
                                                              const isPct =
                                                                (tier.commissionType ||
                                                                  'percent') === 'percent';
                                                              setDraftRates((prev) => ({
                                                                ...prev,
                                                                [tier.id]: isPct
                                                                  ? Math.min(100, raw)
                                                                  : raw,
                                                              }));
                                                            }}
                                                            className="w-20 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-border-subtle text-[13px] font-bold text-[var(--v-text-primary)] focus:outline-none focus:border-[var(--v-orange)]"
                                                          />
                                                          <span className="text-[11px] font-bold text-[var(--v-text-muted)]">
                                                            {(tier.commissionType || 'percent') ===
                                                            'percent'
                                                              ? '%'
                                                              : '₹'}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )
                                              ) : (
                                                <div className="p-3 rounded-xl bg-white/[0.03] border border-border-subtle text-[11px] text-[var(--v-text-secondary)] font-medium">
                                                  {model === 'standard'
                                                    ? `This promoter follows the global commission (${formatRate(standardType, standardValue)}).`
                                                    : "This promoter follows the event's ticket tier commission mapping."}
                                                </div>
                                              )}

                                              <div className="flex gap-2 pt-1">
                                                <button
                                                  type="button"
                                                  onClick={closeExpand}
                                                  className="flex-1 px-3 py-2 rounded-xl border border-border-default text-[11px] font-bold text-[var(--v-text-primary)] hover:bg-white/[0.03] transition-colors"
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => saveExpand(promoter.id)}
                                                  className="flex-1 px-3 py-2 rounded-xl bg-[var(--v-orange)] text-white text-[11px] font-bold hover:opacity-90 transition-opacity"
                                                >
                                                  Save
                                                </button>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {commissionTotalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-3 border-t border-border-subtle">
                              <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                                Page {commissionPageSafe} of {commissionTotalPages}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={commissionPageSafe <= 1}
                                  onClick={() => setCommissionPage((p) => Math.max(1, p - 1))}
                                  className="w-7 h-7 rounded-lg border border-border-default flex items-center justify-center disabled:opacity-30 hover:border-[var(--v-orange)] transition-colors"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={commissionPageSafe >= commissionTotalPages}
                                  onClick={() =>
                                    setCommissionPage((p) => Math.min(commissionTotalPages, p + 1))
                                  }
                                  className="w-7 h-7 rounded-lg border border-border-default flex items-center justify-center disabled:opacity-30 hover:border-[var(--v-orange)] transition-colors"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Section 3: Buyer Discount Settings */}
              {!formData.isRSVP && (
                <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDiscountSettings(!showDiscountSettings)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[rgba(52,199,89,0.12)] flex items-center justify-center">
                        <Percent className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-bold text-[var(--v-text-primary)]">
                          Buyer Discounts
                        </p>
                        <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                          {formData.buyerDiscountsEnabled
                            ? `${formData.discount}${formData.discountType === 'percent' ? '%' : ' INR'} off via promoter links`
                            : 'Disabled'}
                        </p>
                      </div>
                    </div>
                    {showDiscountSettings ? (
                      <ChevronUp className="w-4 h-4 text-[var(--v-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--v-text-muted)]" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showDiscountSettings && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-5 space-y-4 border-t border-border-subtle pt-4">
                          <label className="flex items-center justify-between cursor-pointer">
                            <div>
                              <p className="text-[12px] font-bold text-[var(--v-text-primary)]">
                                Enable Buyer Discounts (Optional)
                              </p>
                              <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                                Let promoters offer discounts to their buyers
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={formData.buyerDiscountsEnabled}
                              onClick={() =>
                                updatePromoterSetting(
                                  'buyerDiscountsEnabled',
                                  !formData.buyerDiscountsEnabled,
                                )
                              }
                              className={`relative w-11 h-6 rounded-full transition-colors ${formData.buyerDiscountsEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formData.buyerDiscountsEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                              />
                            </button>
                          </label>

                          {formData.buyerDiscountsEnabled && (
                            <div>
                              <label className="text-[11px] font-bold text-[var(--v-text-secondary)] mb-1.5 block">
                                Discount Amount (Optional)
                              </label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={formData.discount}
                                  onChange={(e) =>
                                    updatePromoterSetting(
                                      'discount',
                                      Math.min(100, Math.max(0, Number(e.target.value))),
                                    )
                                  }
                                  className="w-20 px-3 py-2 text-[14px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-emerald-500 text-[var(--v-text-primary)]"
                                />
                                <span className="text-[13px] font-bold text-[var(--v-text-muted)]">
                                  {formData.discountType === 'percent' ? '%' : 'INR'}
                                </span>
                                <select
                                  value={formData.discountType}
                                  onChange={(e) =>
                                    updatePromoterSetting('discountType', e.target.value)
                                  }
                                  className="px-3 py-2 text-[12px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-emerald-500 text-[var(--v-text-primary)]"
                                >
                                  <option value="percent">Percent</option>
                                  <option value="fixed">Fixed (INR)</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Model switch confirm dialog */}
      <AnimatePresence>
        {pendingModelSwitch && (
          <ConfirmDialog
            title={
              MODEL_SWITCH_COPY[`${model}->${pendingModelSwitch}`]?.title ||
              'Change Compensation Model?'
            }
            message={
              MODEL_SWITCH_COPY[`${model}->${pendingModelSwitch}`]?.message ||
              'This will change how promoters are compensated for this event.'
            }
            onCancel={() => setPendingModelSwitch(null)}
            onConfirm={applyModelSwitch}
          />
        )}
      </AnimatePresence>

      {/* Deselect promoter confirm dialog */}
      <AnimatePresence>
        {deselectConfirm && (
          <ConfirmDialog
            title="Remove Promoter?"
            message="Sales already attributed to this promoter will remain. Future sales will not."
            confirmLabel="Remove"
            onCancel={() => setDeselectConfirm(null)}
            onConfirm={confirmDeselect}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
