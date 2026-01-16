"use client";

import clsx from "clsx";
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
          <label className="block text-[12px] font-medium text-stone-500 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={clsx(
            "w-full bg-stone-50 border rounded-lg px-4 py-3 text-[14px] text-stone-900 placeholder:text-stone-400 transition-all duration-150 outline-none resize-y",
            "hover:bg-stone-100",
            "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10",
            hasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
              : "border-transparent",
            className
          )}
          {...rest}
        />
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

TextArea.displayName = "TextArea";

export default TextArea;
