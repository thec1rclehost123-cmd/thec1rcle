"use client";

import { motion } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";

export type WizardStep =
    | 'identity'
    | 'scheduling'
    | 'experience'
    | 'ticketing'
    | 'tables'
    | 'promoters'
    | 'media'
    | 'review';

export interface StepConfig {
    id: WizardStep;
    label: string;
    shortLabel: string;
    icon: any;
    description: string;
}

interface WizardNavigationProps {
    steps: StepConfig[];
    currentStep: WizardStep;
    currentStepIndex: number;
    onStepClick: (step: WizardStep) => void;
    stepValidation: Record<WizardStep, { isValid: boolean; issues: string[] }>;
    completedSteps: WizardStep[];
}

export function WizardNavigation({
    steps,
    currentStep,
    currentStepIndex,
    onStepClick,
    stepValidation,
    completedSteps
}: WizardNavigationProps) {
    return (
        <div className="mb-4">
            {/* Progress Bar */}
            <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-black">Progress</span>
                    <span className="text-[10px] text-text-tertiary font-bold">{currentStepIndex + 1} / {steps.length}</span>
                </div>
                <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                </div>
            </div>

            {/* Step Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = step.id === currentStep;
                    const isComplete = completedSteps.includes(step.id);
                    const validation = stepValidation[step.id];
                    const hasIssues = validation && !validation.isValid && validation.issues.length > 0;
                    const canClick = index <= currentStepIndex || isComplete;

                    return (
                        <button
                            key={step.id}
                            onClick={() => canClick && onStepClick(step.id)}
                            disabled={!canClick}
                            className={`
                                flex items-center gap-1.5 px-3 py-2 rounded-full whitespace-nowrap transition-all
                                ${isActive
                                    ? 'bg-text-primary text-[var(--surface-base)] shadow-xl shadow-indigo-500/10'
                                    : isComplete
                                        ? 'bg-green-500/10 text-accent-primary border border-[var(--state-success)]/20 shadow-sm'
                                        : hasIssues
                                            ? 'bg-yellow-500/10 text-yellow-500 border border-[var(--state-warning)]/20 shadow-sm'
                                            : 'bg-surface-secondary text-text-tertiary hover:bg-surface-tertiary border border-border-subtle'
                                }
                                ${!canClick ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                        >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isActive ? 'bg-surface-base/20' : isComplete ? 'bg-green-500/20' : 'bg-surface-tertiary'
                                }`}>
                                {isComplete ? (
                                    <Check className="w-3 h-3" />
                                ) : hasIssues ? (
                                    <AlertCircle className="w-3 h-3" />
                                ) : (
                                    <Icon className="w-3 h-3" />
                                )}
                            </div>
                            <span className="text-[12px] font-semibold">{step.shortLabel}</span>
                        </button>
                    );
                })}
            </div>

            {/* Current Step Header */}
            <div className="mt-4 mb-3">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stepValidation[currentStep]?.isValid === false
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-indigo-500/10 text-indigo-500'
                        }`}>
                        {(() => {
                            const CurrentIcon = steps[currentStepIndex]?.icon;
                            return CurrentIcon ? <CurrentIcon className="w-4 h-4" /> : null;
                        })()}
                    </div>
                    <div>
                        <h2 className="text-[15px] font-black uppercase tracking-tight leading-tight">{steps[currentStepIndex]?.label}</h2>
                        <p className="text-[11px] text-text-tertiary font-medium">{steps[currentStepIndex]?.description}</p>
                    </div>
                </div>
            </div>

            {/* Validation Issues Banner */}
            {stepValidation[currentStep] && !stepValidation[currentStep].isValid && stepValidation[currentStep].issues.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 mb-4"
                >
                    <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <p className="text-[11px] font-black text-amber-500 uppercase tracking-wider">Validation Required:</p>
                            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                {stepValidation[currentStep].issues.map((issue, i) => (
                                    <li key={i} className="text-[11px] text-amber-500/80 font-bold">• {issue}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// Save Status Indicator
interface SaveStatusProps {
    status: 'saved' | 'saving' | 'failed';
}

export function SaveStatus({ status }: SaveStatusProps) {
    return (
        <div className={`
            flex items-center gap-2 px-4 py-2 rounded-xl transition-all border border-border-subtle
            ${status === 'saving' ? 'bg-surface-secondary' : status === 'saved' ? 'bg-green-500/10' : 'bg-red-500/10'}
        `}>
            {status === 'saving' ? (
                <>
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[12px] font-bold text-text-tertiary uppercase tracking-widest">Saving...</span>
                </>
            ) : status === 'saved' ? (
                <>
                    <Check className="w-3.5 h-3.5 text-accent-primary" />
                    <span className="text-[12px] font-bold text-accent-primary uppercase tracking-widest">Saved</span>
                </>
            ) : (
                <>
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[12px] font-bold text-red-500 uppercase tracking-widest">Save Failed</span>
                </>
            )}
        </div>
    );
}
