"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { forwardRef, useMemo, type ReactNode, type CSSProperties } from "react";
import { getAccentToken, type AccentName } from "../../lib/design-system/tokens";

type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  accent?: AccentName;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const Spinner = () => (
  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/80" aria-hidden="true" />
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", accent = "iris", loading, disabled, fullWidth, icon, children, className, ...rest }, ref) => {
    const accentToken = useMemo(() => getAccentToken(accent), [accent]);

    const baseStyles =
      "group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

    const variantStyles: Record<ButtonVariant, string> = {
      primary: "text-black shadow-lg",
      secondary: "bg-white/5 text-white border border-white/15 backdrop-blur focus-visible:ring-white/30",
      ghost: "text-white bg-transparent border border-transparent hover:border-white/15 focus-visible:ring-white/20",
    };

    const inlineStyles: CSSProperties =
      variant === "primary"
        ? { backgroundImage: accentToken.gradient, boxShadow: accentToken.shadow }
        : variant === "secondary"
          ? { boxShadow: accentToken.shadow.replace("0 15px 30px", "0 12px 24px") }
          : {};

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variantStyles[variant], fullWidth && "w-full", "disabled:cursor-not-allowed disabled:opacity-60 hover:scale-[1.015] active:scale-[0.98] transition-transform", className)}
        disabled={disabled || loading}
        style={inlineStyles}
        {...rest}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
          style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.25), transparent 60%)" }}
        />
        <span
          className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen transition group-active:opacity-60"
          style={{ background: accentToken.soft }}
        />
        {loading ? <Spinner /> : icon}
        <span className={clsx("relative z-10 flex items-center gap-2", loading && "opacity-80")}>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
