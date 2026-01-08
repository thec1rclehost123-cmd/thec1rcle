import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import clsx from "clsx";

interface SectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export function Section({ title, description, children, className }: SectionProps) {
    return (
        <div className={clsx("rounded-2xl border border-stone-200 bg-white p-6 shadow-sm", className)}>
            <div className="mb-6 space-y-1">
                <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
                {description && <p className="text-sm text-stone-500">{description}</p>}
            </div>
            {children}
        </div>
    );
}

export function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={clsx("space-y-4", className)}>{children}</div>;
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
                <label className="ml-1 text-[13px] font-medium text-stone-700">
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                        <Icon className="h-4 w-4" />
                    </div>
                )}
                <input
                    className={clsx(
                        "w-full rounded-xl border bg-stone-50 px-4 py-3 text-[15px] font-medium text-stone-900 transition-all placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-stone-100",
                        Icon ? "pl-10" : "",
                        error
                            ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100"
                            : "border-stone-200",
                        className
                    )}
                    {...props}
                />
            </div>
            {hint && !error && <p className="ml-1 text-[11px] text-stone-500">{hint}</p>}
            {error && (
                <div className="flex items-center gap-1.5 ml-1 text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <p className="text-[11px] font-medium">{error}</p>
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
                <label className="ml-1 text-[13px] font-medium text-stone-700">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    className={clsx(
                        "w-full appearance-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-[15px] font-medium text-stone-900 transition-all focus:border-stone-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-stone-100 cursor-pointer",
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
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-stone-500">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>
            {hint && <p className="ml-1 text-[11px] text-stone-500">{hint}</p>}
        </div>
    );
}

export function Reassurance({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
            <div className="mt-0.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="text-sm leading-relaxed text-stone-600">{children}</p>
        </div>
    );
}

export function Hint({ children }: { children: React.ReactNode }) {
    return <p className="mt-2 text-[12px] leading-relaxed text-stone-500">{children}</p>;
}
