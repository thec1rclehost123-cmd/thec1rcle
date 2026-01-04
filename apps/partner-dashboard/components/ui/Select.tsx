import clsx from "clsx";
import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  options?: SelectOption[];
  leadingIcon?: ReactNode;
  tone?: "default" | "light";
}

const baseSelect =
  "peer w-full appearance-none rounded-[28px] border px-5 py-3 pr-12 text-base transition focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:outline-none";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, errorText, options, className, leadingIcon, children, required, tone = "default", ...rest }, ref) => (
    <label className={clsx(
      "flex w-full flex-col gap-2 text-sm",
      tone === 'light' ? 'text-slate-600' : 'text-white/70'
    )}>
      {label && (
        <span className={clsx(
          "text-xs font-medium uppercase tracking-[0.35em]",
          tone === 'light' ? 'text-slate-400' : 'text-white/50'
        )}>
          {label} {required && <span className="text-peach">*</span>}
        </span>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className={clsx(
            "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2",
            tone === 'light' ? 'text-slate-400' : 'text-white/40'
          )}>
            {leadingIcon}
          </span>
        )}
        <select
          ref={ref}
          className={clsx(
            baseSelect,
            leadingIcon && "pl-12",
            tone === 'light' ?
              "border-slate-200 bg-slate-50 text-slate-900 focus-visible:bg-white focus-visible:border-indigo-300 focus-visible:ring-indigo-100" :
              "border-white/10 bg-white/[0.04] text-white focus-visible:border-white/40 focus-visible:ring-white/50",
            errorText && (tone === 'light' ? "border-rose-300 ring-rose-100" : "border-red-400/50 text-red-100"),
            className
          )}
          {...rest}
        >
          {options
            ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
            : children}
        </select>
        <span className={clsx(
          "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2",
          tone === 'light' ? 'text-slate-400' : 'text-white/40'
        )}>⌄</span>
      </div>
      {
        errorText ? (
          <span className="text-xs text-red-500 font-medium" > {errorText}</span>
        ) : (
          helperText && (
            <span className={clsx(
              "text-xs",
              tone === 'light' ? 'text-slate-400' : 'text-white/40'
            )}>
              {helperText}
            </span>
          )
        )}
    </label >
  )
);

Select.displayName = "Select";

export default Select;
