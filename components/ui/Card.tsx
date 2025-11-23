"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { forwardRef, type HTMLAttributes } from "react";
import { type AccentName, getAccentToken } from "../../lib/design-system/tokens";

const paddingMap = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: keyof typeof paddingMap;
  accent?: AccentName;
  blur?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = true, padding = "md", accent = "iris", blur = true, className, children, ...rest }, ref) => {
    const accentToken = getAccentToken(accent);
    return (
      <article
        ref={ref}
        className={clsx(
          "group relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] text-white",
          blur && "backdrop-blur-xl",
          interactive && "transition-all hover:-translate-y-1 hover:border-white/30 hover:scale-[1.01]",
          paddingMap[padding],
          className
        )}
        style={{ boxShadow: accentToken.soft }}
        {...rest}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-0 transition group-hover:opacity-100"
          style={{ background: accentToken.soft }}
        />
        <div className="relative z-10 flex flex-col gap-4">{children}</div>
      </article>
    );
  }
);

Card.displayName = "Card";

export interface CardMediaProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  alt?: string;
}

export const CardMedia = ({ src, alt = "", className, ...rest }: CardMediaProps) => (
  <div className={clsx("relative aspect-[4/3] overflow-hidden rounded-[28px]", className)} {...rest}>
    <img src={src} alt={alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
  </div>
);

export interface CardStatProps {
  label: string;
  value: string;
}

export const CardStat = ({ label, value }: CardStatProps) => (
  <div className="flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left">
    <span className="text-xs uppercase tracking-[0.35em] text-white/40">{label}</span>
    <span className="text-2xl font-heading text-white">{value}</span>
  </div>
);

export const CardBody = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("flex flex-col gap-3", className)} {...rest} />
);

export const CardFooter = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("mt-auto flex flex-wrap items-center gap-4", className)} {...rest} />
);

Card.Media = CardMedia;
Card.Body = CardBody;
Card.Footer = CardFooter;
Card.Stat = CardStat;

export default Card;
