"use client";

import { motion } from "framer-motion";
import { Check, AlertTriangle, Circle } from "lucide-react";

export type WizardStepV3 =
    | 'foundation'
    | 'schedule'
    | 'capacity'
    | 'revenue'
    | 'media'
    | 'review';

export interface StepConfigV3 {
    id: WizardStepV3;
    label: string;
    number: number;
}

export type StepStatus = 'not-started' | 'in-progress' | 'complete' | 'needs-attention';

interface WizardStepNavProps {
    currentStep: WizardStepV3;
    completedSteps: WizardStepV3[];
    stepIssues: Record<WizardStepV3, string[]>;
    onStepClick: (step: WizardStepV3) => void;
    unlockedUpTo: number; // index of furthest visited step
}

const STEPS: StepConfigV3[] = [
    { id: 'foundation', label: 'Foundation', number: 1 },
    { id: 'schedule',   label: 'Schedule',   number: 2 },
    { id: 'capacity',   label: 'Capacity',   number: 3 },
    { id: 'revenue',    label: 'Revenue',    number: 4 },
    { id: 'media',      label: 'Media',      number: 5 },
    { id: 'review',     label: 'Review',     number: 6 },
];

function getStatus(
    stepId: WizardStepV3,
    currentStep: WizardStepV3,
    completedSteps: WizardStepV3[],
    stepIssues: Record<WizardStepV3, string[]>
): StepStatus {
    if (stepId === currentStep) return 'in-progress';
    if (completedSteps.includes(stepId)) {
        if (stepIssues[stepId]?.length > 0) return 'needs-attention';
        return 'complete';
    }
    if (stepIssues[stepId]?.some(Boolean)) return 'needs-attention';
    return 'not-started';
}

export function WizardStepNav({
    currentStep,
    completedSteps,
    stepIssues,
    onStepClick,
    unlockedUpTo
}: WizardStepNavProps) {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    const progress = ((currentIndex + 1) / STEPS.length) * 100;

    return (
        <div className="w-full">
            {/* Segmented step chips */}
            <div className="flex items-stretch gap-0 w-full rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]">
                {STEPS.map((step, index) => {
                    const status = getStatus(step.id, currentStep, completedSteps, stepIssues);
                    const isClickable = index <= unlockedUpTo || status === 'complete';
                    const isLast = index === STEPS.length - 1;

                    return (
                        <button
                            key={step.id}
                            onClick={() => isClickable && onStepClick(step.id)}
                            disabled={!isClickable}
                            className={`
                                relative flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2
                                text-center transition-all duration-200 min-w-0
                                ${!isLast ? 'border-r border-white/[0.06]' : ''}
                                ${status === 'in-progress'
                                    ? 'bg-white/[0.06]'
                                    : status === 'complete'
                                        ? 'hover:bg-white/[0.03] cursor-pointer'
                                        : status === 'needs-attention'
                                            ? 'hover:bg-white/[0.03] cursor-pointer'
                                            : isClickable
                                                ? 'hover:bg-white/[0.02] cursor-pointer'
                                                : 'cursor-not-allowed opacity-40'
                                }
                            `}
                        >
                            {/* Active indicator line */}
                            {status === 'in-progress' && (
                                <motion.div
                                    layoutId="step-active-bar"
                                    className="absolute top-0 left-0 right-0 h-[2px] bg-[#F44A22]"
                                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                />
                            )}

                            {/* Status icon */}
                            <div className={`
                                w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                                ${status === 'in-progress' ? 'bg-[#F44A22]/20' : ''}
                                ${status === 'complete' ? 'bg-emerald-500/15' : ''}
                                ${status === 'needs-attention' ? 'bg-amber-500/15' : ''}
                                ${status === 'not-started' ? 'bg-white/[0.05]' : ''}
                            `}>
                                {status === 'complete' ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-400" strokeWidth={3} />
                                ) : status === 'needs-attention' ? (
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" strokeWidth={2.5} />
                                ) : status === 'in-progress' ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#F44A22]" />
                                ) : (
                                    <span className="text-[9px] font-bold text-white/30">{step.number}</span>
                                )}
                            </div>

                            {/* Step label */}
                            <span className={`
                                text-[10px] font-semibold tracking-wide truncate w-full text-center leading-none
                                ${status === 'in-progress' ? 'text-white' : ''}
                                ${status === 'complete' ? 'text-emerald-400' : ''}
                                ${status === 'needs-attention' ? 'text-amber-400' : ''}
                                ${status === 'not-started' ? 'text-white/35' : ''}
                            `}>
                                {step.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Thin global progress line below chips */}
            <div className="mt-1.5 h-[2px] rounded-full bg-white/[0.05] overflow-hidden">
                <motion.div
                    className="h-full bg-gradient-to-r from-[#F44A22]/60 to-[#F44A22]"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
}
