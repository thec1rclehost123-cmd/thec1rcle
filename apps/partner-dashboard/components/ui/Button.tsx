"use client";

import clsx from "clsx";
import { forwardRef, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "confirm" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const Spinner = () => (
  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
);

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-stone-900 text-white hover:bg-black",
  secondary: "bg-transparent text-stone-700 border border-stone-200 hover:bg-stone-50 hover:border-stone-300",
  ghost: "bg-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-900",
  confirm: "bg-emerald-600 text-white hover:bg-emerald-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-[13px] px-3 py-2 gap-1.5 rounded-md",
  md: "text-[14px] px-4 py-2.5 gap-2 rounded-lg",
  lg: "text-[15px] px-6 py-3 gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, fullWidth, icon, children, className, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 focus-visible:ring-offset-2",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "active:scale-[0.98]",
          className
        )}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <Spinner /> : icon}
        <span className={clsx("flex items-center gap-2", loading && "opacity-80")}>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
