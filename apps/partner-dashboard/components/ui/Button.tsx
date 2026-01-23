"use client";

import clsx from "clsx";
import { forwardRef, type ReactNode } from "react";

/**
 * Button Component — Enterprise Grade
 * 
 * Supports multiple variants, sizes, loading states, and icons
 * Designed for THE C1RCLE Partner Dashboard
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "success" | "danger" | "accent";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

// Loading Spinner
const Spinner = ({ size = "md" }: { size?: ButtonSize }) => {
  const sizeClasses = {
    xs: "h-3 w-3 border",
    sm: "h-3.5 w-3.5 border",
    md: "h-4 w-4 border-2",
    lg: "h-5 w-5 border-2",
    xl: "h-5 w-5 border-2",
  };

  return (
    <span
      className={clsx(
        "inline-flex animate-spin rounded-full border-current/30 border-t-current",
        sizeClasses[size]
      )}
      aria-hidden="true"
    />
  );
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-[var(--c1rcle-orange)] text-white hover:bg-[var(--c1rcle-orange-dim)] shadow-sm hover:shadow-md active:shadow-sm",
  secondary: "bg-transparent text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-secondary)] hover:border-[var(--border-strong)]",
  ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]",
  dark: "bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90",
  success: "bg-[var(--state-success)] text-white hover:brightness-110",
  danger: "bg-[var(--state-error)] text-white hover:brightness-110",
  accent: "bg-[var(--c1rcle-orange-glow)] text-[var(--c1rcle-orange)] border border-[var(--c1rcle-orange)]/30 hover:bg-[var(--c1rcle-orange)]/20",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "text-[11px] px-2.5 py-1.5 gap-1 rounded-md min-h-[28px]",
  sm: "text-[13px] px-3.5 py-2 gap-1.5 rounded-lg min-h-[36px]",
  md: "text-[14px] px-5 py-2.5 gap-2 rounded-xl min-h-[44px]",
  lg: "text-[15px] px-6 py-3 gap-2 rounded-xl min-h-[52px]",
  xl: "text-[16px] px-8 py-4 gap-2.5 rounded-2xl min-h-[60px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = "primary",
    size = "md",
    loading,
    disabled,
    fullWidth,
    icon,
    iconPosition = "left",
    children,
    className,
    ...rest
  }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-semibold tracking-tight",
          "transition-all duration-150 ease-out outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--c1rcle-orange)]/30 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "active:scale-[0.98]",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        disabled={isDisabled}
        {...rest}
      >
        {loading ? (
          <>
            <Spinner size={size} />
            <span className="opacity-80">{children}</span>
          </>
        ) : (
          <>
            {icon && iconPosition === "left" && <span className="flex-shrink-0">{icon}</span>}
            {children && <span>{children}</span>}
            {icon && iconPosition === "right" && <span className="flex-shrink-0">{icon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

// Icon Button Variant
export interface IconButtonProps extends Omit<ButtonProps, "icon" | "children"> {
  icon: ReactNode;
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "ghost", size = "md", className, icon, ...rest }, ref) => {
    const iconSizeStyles: Record<ButtonSize, string> = {
      xs: "w-7 h-7 p-1.5 rounded-md",
      sm: "w-9 h-9 p-2 rounded-lg",
      md: "w-11 h-11 p-2.5 rounded-xl",
      lg: "w-13 h-13 p-3 rounded-xl",
      xl: "w-14 h-14 p-3.5 rounded-2xl",
    };

    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center",
          "transition-all duration-150 ease-out outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--c1rcle-orange)]/30 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "active:scale-[0.95]",
          variantStyles[variant],
          iconSizeStyles[size],
          className
        )}
        {...rest}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

// Button Group for grouping related actions
export function ButtonGroup({
  children,
  attached = false,
  className
}: {
  children: ReactNode;
  attached?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx(
      "inline-flex",
      attached ? "rounded-xl overflow-hidden divide-x divide-[var(--border-subtle)]" : "gap-2",
      attached && "[&>button]:rounded-none [&>button:first-child]:rounded-l-xl [&>button:last-child]:rounded-r-xl",
      className
    )}>
      {children}
    </div>
  );
}

export default Button;
