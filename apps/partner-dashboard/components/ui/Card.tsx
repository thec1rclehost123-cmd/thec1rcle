"use client";

import clsx from "clsx";
import { forwardRef, type HTMLAttributes } from "react";

/**
 * Card Component — Clean Surface
 * 
 * Cards float gently with subtle depth.
 * No harsh borders, no decorative elements.
 */

const paddingMap = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: keyof typeof paddingMap;
  elevated?: boolean;
}

const CardComponent = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, padding = "md", elevated = false, className, children, ...rest }, ref) => {
    return (
      <article
        ref={ref}
        className={clsx(
          "bg-white rounded-xl border",
          elevated
            ? "border-stone-100 shadow-sm"
            : "border-stone-100",
          interactive && "cursor-pointer transition-all duration-150 hover:shadow-md hover:border-stone-200 active:scale-[0.995]",
          paddingMap[padding],
          className
        )}
        {...rest}
      >
        {children}
      </article>
    );
  }
);

CardComponent.displayName = "Card";

// Card Header
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader = ({ title, subtitle, action, className, ...rest }: CardHeaderProps) => (
  <div className={clsx("flex items-start justify-between mb-4", className)} {...rest}>
    <div>
      <h3 className="text-[16px] font-semibold text-stone-900">{title}</h3>
      {subtitle && <p className="text-[13px] text-stone-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// Card Media
export interface CardMediaProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  alt?: string;
  aspectRatio?: "video" | "square" | "auto";
}

export const CardMedia = ({
  src,
  alt = "",
  aspectRatio = "video",
  className,
  ...rest
}: CardMediaProps) => {
  const aspectStyles = {
    video: "aspect-video",
    square: "aspect-square",
    auto: "",
  };

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-lg -mx-5 -mt-5 mb-4 first:mt-0",
        aspectStyles[aspectRatio],
        className
      )}
      {...rest}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
};

// Card Stat
export interface CardStatProps {
  label: string;
  value: string;
  change?: { value: string; direction: "up" | "down" };
}

export const CardStat = ({ label, value, change }: CardStatProps) => (
  <div className="flex flex-col">
    <span className="text-[12px] text-stone-500 mb-1">{label}</span>
    <span className="text-[24px] font-medium text-stone-900 leading-none">{value}</span>
    {change && (
      <span className={clsx(
        "text-[12px] font-medium mt-1",
        change.direction === "up" ? "text-emerald-600" : "text-red-600"
      )}>
        {change.direction === "up" ? "↑" : "↓"} {change.value}
      </span>
    )}
  </div>
);

// Card Body
export const CardBody = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("flex flex-col gap-3", className)} {...rest} />
);

// Card Footer
export const CardFooter = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("mt-auto flex flex-wrap items-center gap-3 pt-4 border-t border-stone-100", className)} {...rest} />
);

// Export compound component
export const Card = Object.assign(CardComponent, {
  Header: CardHeader,
  Media: CardMedia,
  Body: CardBody,
  Footer: CardFooter,
  Stat: CardStat,
});

export default Card;
