import clsx from "clsx";
import { type AccentName, getAccentToken } from "../../lib/design-system/tokens";

type AvatarSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<AvatarSize, string> = {
  xs: "h-8 w-8 text-xs",
  sm: "h-10 w-10 text-sm",
  md: "h-14 w-14 text-base",
  lg: "h-20 w-20 text-xl",
};

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  accent?: AccentName;
  size?: AvatarSize;
  rounded?: "full" | "xl";
}

export const Avatar = ({ src, alt = "", name, accent = "iris", size = "md", rounded = "full", className, ...rest }: AvatarProps) => {
  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const accentToken = getAccentToken(accent);

  return (
    <div
      className={clsx(
        "relative overflow-hidden text-white uppercase",
        sizeMap[size],
        rounded === "full" ? "rounded-full" : "rounded-3xl",
        className
      )}
      style={{ background: accentToken.gradient, boxShadow: accentToken.shadow }}
      {...rest}
    >
      {src ? (
        <img src={src} alt={alt || name || "Guest avatar"} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-black/30">{initials || "??"}</span>
      )}
    </div>
  );
};

export default Avatar;
