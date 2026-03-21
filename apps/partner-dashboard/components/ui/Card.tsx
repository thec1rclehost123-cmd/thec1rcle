import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

/**
 * Card Component — Premium Surface
 * 
 * Supports dark mode via CSS custom properties
 * Clean, elevated surfaces with subtle depth
 */

const paddingMap = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
  xl: "p-8",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: keyof typeof paddingMap;
  elevated?: boolean;
  glass?: boolean;
  glow?: boolean;
}

const CardComponent = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, padding = "md", elevated = false, glass = false, glow = false, className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border transition-all duration-200",
          // Base styles
          glass
            ? "card-glass backdrop-blur-xl"
            : "bg-surface-elevated",
          // Border styles
          glow
            ? "border-accent-primary shadow-glow"
            : "border-border-subtle",
          // Elevation
          elevated && "shadow-md",
          // Interactive states
          interactive && "cursor-pointer hover:shadow-lg hover:border-border-default active:scale-[0.995]",
          paddingMap[padding],
          className
        )}
        {...rest as any}
      >
        {children}
      </div>
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
  <div className={cn("flex items-start justify-between mb-5", className)} {...rest as any}>
    <div>
      <h3 className="text-title text-text-primary">{title}</h3>
      {subtitle && <p className="text-caption text-text-tertiary mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// Card Media
export interface CardMediaProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  alt?: string;
  aspectRatio?: "video" | "square" | "auto" | "poster";
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
    poster: "aspect-[3/4]",
    auto: "",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl -mx-5 -mt-5 mb-5 first:mt-0",
        aspectStyles[aspectRatio],
        className
      )}
      {...rest as any}
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
  change?: { value: string; direction: "up" | "down" | "neutral" };
}

export const CardStat = ({ label, value, change }: CardStatProps) => (
  <div className="flex flex-col">
    <span className="text-label-sm text-text-tertiary mb-1">{label}</span>
    <span className="text-stat text-text-primary leading-none">{value}</span>
    {change && (
      <span className={cn(
        "text-[12px] font-semibold mt-2 flex items-center gap-1",
        change.direction === "up" && "text-[var(--trend-up)]",
        change.direction === "down" && "text-[var(--trend-down)]",
        change.direction === "neutral" && "text-text-tertiary"
      )}>
        {change.direction === "up" && "↑"}
        {change.direction === "down" && "↓"}
        {change.value}
      </span>
    )}
  </div>
);

// Card Body
export const CardBody = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-4", className)} {...rest as any} />
);

// Card Footer
export const CardFooter = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-wrap items-center gap-3 pt-5 border-t border-border-subtle", className)} {...rest as any} />
);

// Card Section divider
export const CardDivider = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("h-px bg-border-subtle my-4 -mx-5", className)} {...rest as any} />
);

// Export compound component
export const Card = Object.assign(CardComponent, {
  Header: CardHeader,
  Media: CardMedia,
  Body: CardBody,
  Footer: CardFooter,
  Stat: CardStat,
  Divider: CardDivider,
});

export default Card;
