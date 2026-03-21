import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export function Section({ title, description, children, className }: SectionProps) {
    return (
        <div className={cn("rounded-[2rem] border border-border-subtle bg-surface-base p-8 shadow-sm", className)}>
            <div className="mb-6 space-y-1">
                <h3 className="text-headline-xs text-text-primary">{title}</h3>
                {description && <p className="text-body-sm text-text-tertiary uppercase tracking-widest font-bold">{description}</p>}
            </div>
            {children}
        </div>
    );
}

export function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("space-y-4", className)}>{children}</div>;
}

interface WizardInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: string;
    error?: string;
    icon?: React.ElementType;
}

export function WizardInput({ label, hint, error, className, icon: Icon, ...props }: WizardInputProps) {
    return (
        <div className="space-y-1.5 w-full">
            {label && (
                <label className="ml-1 text-[13px] font-bold text-text-secondary uppercase tracking-widest">
                    {label}
                </label>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-indigo-500 transition-colors">
                        {React.createElement(Icon as any, { className: "h-4 w-4" })}
                    </div>
                )}
                <input
                    className={cn(
                        "w-full rounded-[1.25rem] border bg-surface-secondary px-4 py-3.5 text-[15px] font-medium text-text-primary transition-all placeholder:text-text-tertiary/50 focus:border-indigo-500/50 focus:bg-surface-base focus:outline-none focus:ring-4 focus:ring-indigo-500/5",
                        Icon ? "pl-11" : "",
                        error
                            ? "border-[var(--state-error)]/30 bg-red-500/10 focus:border-[var(--state-error)] focus:ring-[var(--state-error)]/5"
                            : "border-border-subtle hover:border-border-strong",
                        className
                    )}
                    {...props}
                />
            </div>
            {hint && !error && <p className="ml-1 text-[11px] text-text-tertiary uppercase tracking-widest font-bold">{hint}</p>}
            {error && (
                <div className="flex items-center gap-1.5 ml-1 text-red-500">
                    {React.createElement(AlertCircle as any, { className: "h-3 w-3" })}
                    <p className="text-[11px] font-bold uppercase tracking-widest">{error}</p>
                </div>
            )}
        </div>
    );
}

interface WizardSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { label: string; value: string }[];
    hint?: string;
}

export function WizardSelect({ label, options, hint, className, ...props }: WizardSelectProps) {
    return (
        <div className="space-y-1.5 w-full">
            {label && (
                <label className="ml-1 text-[13px] font-bold text-text-secondary uppercase tracking-widest">
                    {label}
                </label>
            )}
            <div className="relative group">
                <select
                    className={cn(
                        "w-full appearance-none rounded-[1.25rem] border border-border-subtle bg-surface-secondary px-4 py-3.5 text-[15px] font-medium text-text-primary transition-all focus:border-indigo-500/50 focus:bg-surface-base focus:outline-none focus:ring-4 focus:ring-indigo-500/5 cursor-pointer uppercase tracking-wider",
                        className
                    )}
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-text-tertiary">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>
            {hint && <p className="ml-1 text-[11px] text-text-tertiary uppercase tracking-widest font-bold">{hint}</p>}
        </div>
    );
}

export function Reassurance({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--state-success)]/20 bg-green-500/10 p-5">
            <div className="mt-0.5 text-accent-primary">
                {React.createElement(CheckCircle2 as any, { className: "h-4 w-4" })}
            </div>
            <p className="text-body-sm leading-relaxed text-accent-primary font-medium opacity-90">{children}</p>
        </div>
    );
}

export function Hint({ children }: { children: React.ReactNode }) {
    return <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary uppercase tracking-widest font-black">{children}</p>;
}
