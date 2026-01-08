import clsx from "clsx";
import { type ReactNode } from "react";

/**
 * Badge Component — State-Based Indicators
 * 
 * Color is state, not decoration.
 * Each badge must answer: "Is this okay, or do I need to act?"
 */

type BadgeTone = "confirmed" | "pending" | "risk" | "draft" | "neutral";

const toneStyles: Record<BadgeTone, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  risk: "bg-red-50 text-red-700 border-red-100",
  draft: "bg-indigo-50 text-indigo-700 border-indigo-100",
  neutral: "bg-stone-100 text-stone-600 border-stone-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
  dot?: boolean;
}

export const Badge = ({
  tone = "neutral",
  icon,
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium rounded-full",
        toneStyles[tone],
        className
      )}
      {...rest}
    >
      {dot && (
        <span className={clsx(
          "w-1.5 h-1.5 rounded-full",
          tone === "confirmed" && "bg-emerald-500",
          tone === "pending" && "bg-amber-500",
          tone === "risk" && "bg-red-500",
          tone === "draft" && "bg-indigo-500",
          tone === "neutral" && "bg-stone-400",
        )} />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
