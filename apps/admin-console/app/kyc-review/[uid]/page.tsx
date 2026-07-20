'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  ChevronLeft,
  User,
  Building2,
  Landmark,
  ShieldCheck,
  FileText,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react';
import { apiGet, apiPatch, getToken } from '@/lib/api/client';

interface KycDetailData {
  stepSequence: string[];
  kycStepStatus: Record<string, string>;
  kycStepData: Record<string, Record<string, unknown>>;
  kycStepAdminNotes: Record<string, string>;
  kycStepResubmissionReason: Record<string, string>;
  entityType?: string;
  displayName?: string;
  email?: string;
}

interface StepMetaValue {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEP_META: Record<string, StepMetaValue> = {
  kyc_identity: { label: 'Identity Verification', icon: User },
  kyc_business: { label: 'Business Documents', icon: Building2 },
  kyc_signatory: { label: 'Authorized Representative', icon: ShieldCheck },
  bank_setup: { label: 'Bank Account', icon: Landmark },
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_resubmission: 'Needs resubmission',
};

const STATUS_COLOR: Record<string, string> = {
  not_started: 'text-zinc-500',
  in_progress: 'text-blue-400',
  submitted: 'text-amber-400',
  under_review: 'text-indigo-400',
  approved: 'text-emerald-400',
  rejected: 'text-red-400',
  needs_resubmission: 'text-red-400',
};

function StepStatusIcon({ status, size = 'h-5 w-5' }: { status: string; size?: string }) {
  if (status === 'approved') return <CheckCircle2 className={`${size} text-emerald-500`} />;
  if (status === 'needs_resubmission' || status === 'rejected')
    return <AlertCircle className={`${size} text-red-400`} />;
  if (status === 'submitted' || status === 'under_review')
    return <Clock className={`${size} text-amber-400`} />;
  if (status === 'in_progress') return <Loader2 className={`${size} text-blue-400 animate-spin`} />;
  return <Circle className={`${size} text-zinc-700`} />;
}

function DataField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{label}</p>
      <p className="text-[12px] text-zinc-300 font-medium break-all">{String(value)}</p>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors group"
    >
      <FileText className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
      <span className="text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors flex-1">
        {label}
      </span>
      <ExternalLink className="h-3 w-3 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
    </a>
  );
}

function ActionModal({
  stepId,
  stepLabel,
  onClose,
  onSubmit,
}: {
  stepId: string;
  stepLabel: string;
  onClose: () => void;
  onSubmit: (params: { action: string; note: string; resubmitReason: string }) => Promise<void>;
}) {
  const [action, setAction] = useState<string>('approve');
  const [note, setNote] = useState<string>('');
  const [resubmitReason, setResubmitReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (action === 'request_resubmission' && !resubmitReason.trim()) return;
    setSubmitting(true);
    await onSubmit({ action, note, resubmitReason });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Review Step</p>
            <h2 className="text-lg font-semibold text-white mt-0.5">{stepLabel}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Decision</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'approve', label: 'Approve', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
                { value: 'mark_under_review', label: 'Under Review', color: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400' },
                { value: 'request_resubmission', label: 'Request Re-upload', color: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
                { value: 'reject', label: 'Reject', color: 'border-red-500/30 bg-red-500/10 text-red-400' },
              ].map((opt: { value: string; label: string; color: string }) => (
                <button
                  key={opt.value}
                  onClick={() => setAction(opt.value)}
                  className={`py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${action === opt.value ? opt.color : 'border-white/5 bg-white/[0.02] text-zinc-600 hover:text-zinc-400'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {action === 'request_resubmission' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                Reason for re-upload <span className="text-red-400">*</span>
              </label>
              <textarea
                value={resubmitReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResubmitReason(e.target.value)}
                placeholder="Tell the user exactly what to fix..."
                maxLength={500}
                rows={3}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/10 resize-none"
              />
              <p className="text-[10px] text-zinc-600 mt-1 text-right">{resubmitReason.length}/500</p>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">
              Internal note (optional)
            </label>
            <input
              value={note}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
              placeholder="For admin eyes only..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/10"
            />
          </div>
        </div>

        <div className="p-6 border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/5 text-zinc-400 font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (action === 'request_resubmission' && !resubmitReason.trim())}
            className="flex-2 flex-1 h-11 rounded-xl bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-zinc-200 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KycReviewDetail() {
  const { user } = useAuth() as { user: any };
  const { uid } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [reviewingStep, setReviewingStep] = useState<string | null>(null);

  const { data: kycData, isLoading, error } = useQuery<KycDetailData>({
    queryKey: ['kyc', uid],
    queryFn: async () => {
      const token = await getToken(user);
      return apiGet(`/api/kyc/${uid}`, token);
    },
    enabled: !!user && !!uid,
  });

  useEffect(() => {
    if (!activeStep && kycData?.stepSequence?.[0]) {
      setActiveStep(kycData.stepSequence[0]);
    }
  }, [kycData, activeStep]);

  const stepMutation = useMutation({
    mutationFn: async ({ action, note, resubmitReason }: { action: string; note: string; resubmitReason: string }) => {
      const token = await getToken(user);
      return apiPatch(`/api/kyc/${uid}`, { stepId: reviewingStep, action, note, resubmitReason }, token);
    },
    onSuccess: () => {
      toast({ type: 'success', message: 'Step updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['kyc', uid] });
      queryClient.invalidateQueries({ queryKey: ['kyc', 'requests'] });
      setReviewingStep(null);
    },
    onError: (err: Error) => {
      toast({ type: 'error', message: err.message });
    },
  });

  const handleStepAction = async (params: { action: string; note: string; resubmitReason: string }) => {
    await stepMutation.mutateAsync(params);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 font-bold mb-4">{(error as Error).message}</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['kyc', uid] })}
          className="text-zinc-500 text-sm hover:text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!kycData) return null;

  const { stepSequence, kycStepStatus, kycStepData, kycStepAdminNotes, kycStepResubmissionReason } = kycData;
  const approvedCount = stepSequence.filter((s: string) => kycStepStatus[s] === 'approved').length;
  const activeStepData = activeStep ? kycStepData[activeStep] || {} : {};
  const activeStepStatus = activeStep ? kycStepStatus[activeStep] || 'not_started' : 'not_started';

  return (
    <div className="space-y-8 pb-24">
      <div>
        <button
          onClick={() => router.push('/kyc-review')}
          className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Queue
        </button>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${kycData.entityType === 'business' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
              >
                {kycData.entityType || 'Individual'}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">{kycData.displayName}</h1>
            <p className="text-sm text-zinc-500 mt-1">{kycData.email} · {uid}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Progress</p>
            <p className="text-2xl font-black text-white">
              {approvedCount}<span className="text-zinc-600 text-lg">/{stepSequence.length}</span>
            </p>
            <p className="text-[10px] text-zinc-500 font-medium">steps approved</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <div className="space-y-1.5">
          {stepSequence.map((stepId: string) => {
            const status = kycStepStatus[stepId] || 'not_started';
            const meta = STEP_META[stepId];
            const Icon = meta?.icon ?? FileText;
            const isActive = activeStep === stepId;

            return (
              <button
                key={stepId}
                onClick={() => setActiveStep(stepId)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all ${isActive ? 'bg-obsidian-surface border border-white/8 shadow-sm' : 'hover:bg-white/[0.03]'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white/10' : 'bg-white/[0.03]'}`}>
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-zinc-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-bold truncate ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                    {meta?.label ?? stepId}
                  </p>
                  <p className={`text-[10px] truncate ${STATUS_COLOR[status] || 'text-zinc-600'}`}>
                    {STATUS_LABEL[status]}
                  </p>
                </div>
                <StepStatusIcon status={status} size="h-4 w-4" />
              </button>
            );
          })}
        </div>

        {activeStep && (
          <div className="bg-obsidian-surface border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = STEP_META[activeStep]?.icon ?? FileText;
                  return (
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-zinc-300" />
                    </div>
                  );
                })()}
                <div>
                  <h2 className="text-[15px] font-semibold text-white">{STEP_META[activeStep]?.label}</h2>
                  <p className={`text-[11px] font-bold ${STATUS_COLOR[activeStepStatus]}`}>{STATUS_LABEL[activeStepStatus]}</p>
                </div>
              </div>

              {activeStepStatus !== 'not_started' && activeStepStatus !== 'in_progress' && (
                <button
                  onClick={() => setReviewingStep(activeStep)}
                  className="px-4 py-2 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Review
                </button>
              )}
            </div>

            {kycStepAdminNotes[activeStep] && (
              <div className="mx-6 mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Admin Note</p>
                <p className="text-[12px] text-zinc-400">{kycStepAdminNotes[activeStep]}</p>
              </div>
            )}

            {kycStepResubmissionReason[activeStep] && (
              <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">Resubmission Reason (shown to user)</p>
                <p className="text-[12px] text-amber-200/70">{kycStepResubmissionReason[activeStep]}</p>
              </div>
            )}

            <div className="p-6">
              {Object.keys(activeStepData).length === 0 ? (
                <p className="text-[12px] text-zinc-600 font-medium text-center py-12">No data submitted yet.</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    {Object.entries(activeStepData)
                      .filter(([key]: [string, unknown]) => !key.toLowerCase().includes('url'))
                      .map(([key, value]: [string, unknown]) => (
                        <DataField key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={value} />
                      ))}
                  </div>

                  {Object.entries(activeStepData).filter(
                    ([key, value]: [string, unknown]) => key.toLowerCase().includes('url') && value,
                  ).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Documents</p>
                      <div className="space-y-2">
                        {Object.entries(activeStepData)
                          .filter(([key, value]: [string, unknown]) => key.toLowerCase().includes('url') && value)
                          .map(([key, value]: [string, unknown]) => (
                            <DocLink
                              key={key}
                              label={key.replace(/([A-Z])/g, ' $1').replace('Url', '').trim()}
                              url={value as string}
                            />
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {reviewingStep && (
        <ActionModal
          stepId={reviewingStep}
          stepLabel={STEP_META[reviewingStep]?.label ?? reviewingStep}
          onClose={() => setReviewingStep(null)}
          onSubmit={handleStepAction}
        />
      )}
    </div>
  );
}
