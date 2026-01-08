"use client";

import clsx from "clsx";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

/**
 * Input Component — Forgiving and Elegant
 * Soft focus glow, clear error states
 */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconPosition = "left", className, ...rest }, ref) => {
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-[12px] font-medium text-stone-500 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === "left" && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={clsx(
              "w-full bg-stone-50 border rounded-lg px-4 py-3 text-[14px] text-stone-900 placeholder:text-stone-400 transition-all duration-150 outline-none",
              "hover:bg-stone-100",
              "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10",
              hasError
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
                : "border-transparent",
              icon && iconPosition === "left" && "pl-10",
              icon && iconPosition === "right" && "pr-10",
              className
            )}
            {...rest}
          />
          {icon && iconPosition === "right" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
              {icon}
            </div>
          )}
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

Input.displayName = "Input";

export default Input;
