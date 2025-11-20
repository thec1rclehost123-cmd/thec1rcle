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
}

const baseSelect =
  "peer w-full appearance-none rounded-[28px] border border-white/10 bg-white/[0.04] px-5 py-3 pr-12 text-base text-white transition focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, errorText, options, className, leadingIcon, children, required, ...rest }, ref) => (
    <label className="flex w-full flex-col gap-2 text-sm text-white/70">
      {label && (
        <span className="text-xs font-medium uppercase tracking-[0.35em] text-white/50">
          {label} {required && <span className="text-peach">*</span>}
        </span>
      )}
      <div className="relative">
        {leadingIcon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">{leadingIcon}</span>}
        <select ref={ref} className={clsx(baseSelect, leadingIcon && "pl-12", className)} {...rest}>
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">⌄</span>
      </div>
      {errorText ? (
        <span className="text-xs text-red-300">{errorText}</span>
      ) : (
        helperText && <span className="text-xs text-white/40">{helperText}</span>
      )}
    </label>
  )
);

Select.displayName = "Select";

export default Select;
