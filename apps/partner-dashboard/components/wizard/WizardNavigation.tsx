"use client";

import { motion } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";

export type WizardStep =
  | "identity"
  | "scheduling"
  | "experience"
  | "ticketing"
  | "tables"
  | "promoters"
  | "media"
  | "review";

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
  completedSteps,
}: WizardNavigationProps) {
  return (
    <div className="mb-12">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-label text-[var(--text-tertiary)] uppercase tracking-widest font-bold">
            Progress
          </span>
          <span className="text-label text-[var(--text-tertiary)] font-bold">
            {currentStepIndex + 1} of {steps.length}
          </span>
        </div>
        <div className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
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
                                flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all
                                ${
                                  isActive
                                    ? "bg-[var(--text-primary)] text-[var(--surface-base)] shadow-xl shadow-indigo-500/10"
                                    : isComplete
                                      ? "bg-[var(--state-success-bg)] text-[var(--state-success)] border border-[var(--state-success)]/20 shadow-sm"
                                      : hasIssues
                                        ? "bg-[var(--state-warning-bg)] text-[var(--state-warning)] border border-[var(--state-warning)]/20 shadow-sm"
                                        : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border-subtle)]"
                                }
                                ${!canClick ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                            `}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  isActive
                    ? "bg-[var(--surface-base)]/20"
                    : isComplete
                      ? "bg-[var(--state-success)]/20"
                      : "bg-[var(--surface-tertiary)]"
                }`}
              >
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
      <div className="mt-8 mb-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              stepValidation[currentStep]?.isValid === false
                ? "bg-[var(--state-warning-bg)] text-[var(--state-warning)]"
                : "bg-indigo-500/10 text-indigo-500"
            }`}
          >
            {(() => {
              const CurrentIcon = steps[currentStepIndex]?.icon;
              return CurrentIcon ? <CurrentIcon className="w-5 h-5" /> : null;
            })()}
          </div>
          <div>
            <h2 className="text-headline-sm">{steps[currentStepIndex]?.label}</h2>
            <p className="text-caption">{steps[currentStepIndex]?.description}</p>
          </div>
        </div>
      </div>

      {/* Validation Issues Banner */}
      {stepValidation[currentStep] &&
        !stepValidation[currentStep].isValid &&
        stepValidation[currentStep].issues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-amber-50 border border-amber-100 mb-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--state-warning)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-body font-bold text-[var(--state-warning)] uppercase tracking-wider">
                  Please complete the following:
                </p>
                <ul className="mt-2 space-y-1">
                  {stepValidation[currentStep].issues.map((issue, i) => (
                    <li
                      key={i}
                      className="text-body-sm text-[var(--state-warning)] opacity-80 font-medium"
                    >
                      • {issue}
                    </li>
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
  status: "saved" | "saving" | "failed";
}

export function SaveStatus({ status }: SaveStatusProps) {
  return (
    <div
      className={`
            flex items-center gap-2 px-4 py-2 rounded-xl transition-all border border-[var(--border-subtle)]
            ${status === "saving" ? "bg-[var(--surface-secondary)]" : status === "saved" ? "bg-[var(--state-success-bg)]" : "bg-[var(--state-error-bg)]"}
        `}
    >
      {status === "saving" ? (
        <>
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[12px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
            Saving...
          </span>
        </>
      ) : status === "saved" ? (
        <>
          <Check className="w-3.5 h-3.5 text-[var(--state-success)]" />
          <span className="text-[12px] font-bold text-[var(--state-success)] uppercase tracking-widest">
            Saved
          </span>
        </>
      ) : (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-[var(--state-error)]" />
          <span className="text-[12px] font-bold text-[var(--state-error)] uppercase tracking-widest">
            Save Failed
          </span>
        </>
      )}
    </div>
  );
}
