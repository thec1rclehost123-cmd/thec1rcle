import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

/**
 * Input Component — Premium Form Input
 * 
 * Features:
 * - Dark mode support via CSS variables
 * - Soft focus glow with C1RCLE orange accent
 * - Clear error states
 * - Icon support
 */

type InputSize = "sm" | "md" | "lg";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  inputSize?: InputSize;
}

const sizeStyles: Record<InputSize, string> = {
  sm: "px-3 py-2 text-[13px] rounded-lg",
  md: "px-4 py-3 text-[14px] rounded-xl",
  lg: "px-5 py-4 text-[15px] rounded-xl",
};

const iconPadding: Record<InputSize, { left: string; right: string }> = {
  sm: { left: "pl-9", right: "pr-9" },
  md: { left: "pl-11", right: "pr-11" },
  lg: { left: "pl-12", right: "pr-12" },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconPosition = "left", inputSize = "md", className, ...rest }, ref) => {
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label className="input-label block mb-2">
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && iconPosition === "left" && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-placeholder group-focus-within:text-accent-primary transition-colors">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-surface-secondary border text-text-primary placeholder:text-text-placeholder transition-all duration-200 outline-none",
              sizeStyles[inputSize],
              // Hover state
              "hover:bg-surface-tertiary hover:border-border-default",
              // Focus state
              "focus:bg-surface-base focus:border-accent-primary focus:ring-3 focus:ring-[var(--accent-glow)]",
              // Error state
              hasError
                ? "border-[var(--state-error)] focus:border-[var(--state-error)] focus:ring-[var(--state-error-bg)]"
                : "border-border-subtle",
              // Icon padding
              icon && iconPosition === "left" && iconPadding[inputSize].left,
              icon && iconPosition === "right" && iconPadding[inputSize].right,
              className
            )}
            {...rest}
          />
          {icon && iconPosition === "right" && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-placeholder group-focus-within:text-accent-primary transition-colors">
              {icon}
            </div>
          )}
        </div>
        {(error || hint) && (
          <p className={cn(
            "mt-2 text-[12px] font-medium",
            hasError ? "text-red-500" : "text-text-tertiary"
          )}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
