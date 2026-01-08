import clsx from "clsx";

/**
 * Avatar Component — User Representation
 * 
 * Clean, simple, no decorative gradients.
 */

type AvatarSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-[16px]",
};

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
}

export const Avatar = ({
  src,
  alt = "",
  name,
  size = "md",
  className,
  ...rest
}: AvatarProps) => {
  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={clsx(
        "relative overflow-hidden flex items-center justify-center rounded-full bg-stone-100 text-stone-600 font-medium",
        sizeMap[size],
        className
      )}
      {...rest}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name || "Avatar"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </div>
  );
};

export default Avatar;
