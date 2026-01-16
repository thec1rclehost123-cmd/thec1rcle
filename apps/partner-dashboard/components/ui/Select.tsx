"use client";

import clsx from "clsx";
import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Select Component — Clean Dropdown
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, ...rest }, ref) => {
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-[12px] font-medium text-stone-500 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={clsx(
              "w-full appearance-none bg-stone-50 border rounded-lg px-4 py-3 pr-10 text-[14px] text-stone-900 transition-all duration-150 outline-none cursor-pointer",
              "hover:bg-stone-100",
              "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10",
              hasError
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
                : "border-transparent",
              className
            )}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
        </div>
        {(error || hint) && (
          <p className={clsx(
            "mt-1.5 text-[12px]",
            hasError ? "text-red-600" : "text-stone-500"
          )}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
