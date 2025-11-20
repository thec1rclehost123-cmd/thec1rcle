import clsx from "clsx";
import { type CSSProperties, type ReactNode } from "react";
import { getAccentToken, type AccentName } from "../../lib/design-system/tokens";

type BadgeVariant = "solid" | "soft" | "outline";
type BadgeTone = AccentName | "neutral" | "success" | "danger";

const tonePalette: Record<Exclude<BadgeTone, AccentName>, { bg: string; text: string; border: string }> = {
  neutral: { bg: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.75)", border: "rgba(255,255,255,0.2)" },
  success: { bg: "rgba(34,197,94,0.15)", text: "#34D399", border: "rgba(34,197,94,0.4)" },
  danger: { bg: "rgba(248,113,113,0.18)", text: "#F87171", border: "rgba(248,113,113,0.5)" },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  icon?: ReactNode;
  pill?: boolean;
}

export const Badge = ({ variant = "soft", tone = "neutral", icon, pill = true, className, children, ...rest }: BadgeProps) => {
  const isAccent = tone === "neutral" || tone === "success" || tone === "danger" ? null : tone;
  const accent = isAccent ? getAccentToken(isAccent as AccentName) : null;
  const palette = accent
    ? {
        bg: accent.soft,
        text: accent.text,
        border: accent.border,
      }
    : tonePalette[tone as Exclude<BadgeTone, AccentName>];

  const styles: Record<BadgeVariant, CSSProperties> = {
    solid: {
      background: accent ? accent.gradient : palette.bg,
      color: accent ? accent.text : palette.text,
      borderColor: palette.border,
    },
    soft: {
      background: palette.bg,
      color: palette.text,
      borderColor: palette.border,
    },
    outline: {
      background: "transparent",
      color: palette.text,
      borderColor: palette.border,
    },
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
        pill ? "rounded-full" : "rounded-2xl",
        className
      )}
      style={styles[variant]}
      {...rest}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
