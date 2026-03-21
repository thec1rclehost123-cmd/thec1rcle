import { cn } from "@/lib/utils";
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
  options?: SelectOption[];
  placeholder?: string;
  children?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, children, className, ...rest }, ref) => {
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-[12px] font-medium text-text-tertiary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              "w-full appearance-none bg-surface-tertiary border rounded-lg px-4 py-3 pr-10 text-[14px] text-text-primary transition-all duration-150 outline-none cursor-pointer",
              "hover:bg-surface-secondary",
              "focus:bg-surface-elevated focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10",
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
            {children}
            {options?.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        </div>
        {(error || hint) && (
          <p className={cn(
            "mt-1.5 text-[12px]",
            hasError ? "text-red-600" : "text-text-tertiary"
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
