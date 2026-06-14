import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

/**
 * TextArea Component — Multi-line Input
 */

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className, rows = 4, ...rest }, ref) => {
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-[12px] font-medium text-text-tertiary mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={cn(
            "w-full bg-surface-tertiary border rounded-lg px-4 py-3 text-[14px] text-text-primary placeholder:text-text-tertiary transition-all duration-150 outline-none resize-y",
            "hover:bg-surface-secondary",
            "focus:bg-surface-elevated focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10",
            hasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
              : "border-transparent",
            className
          )}
          {...rest}
        />
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

TextArea.displayName = "TextArea";

export default TextArea;
