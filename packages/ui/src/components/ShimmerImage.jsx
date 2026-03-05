"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * ShimmerImage — shared image component with loading shimmer.
 *
 * Changes from previous version:
 * - Replaced deprecated `onLoadingComplete` with `onLoad` (Next.js 13.4+)
 * - Removed unsafe `node.querySelector('img')` ref (broken in Next.js 14)
 * - SVG URLs are automatically served with `unoptimized` to avoid _next/image 400 errors
 * - Data URLs rendered via native <img> (unchanged)
 */
export default function ShimmerImage({
    className = "",
    wrapperClassName = "",
    onLoad: onLoadProp,
    /** @deprecated use onLoad instead */
    onLoadingComplete,
    fill,
    src,
    alt,
    unoptimized: unoptimizedProp,
    ...props
}) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const isPlaceholder = !src || src === "placeholder";
    const isDataUrl = typeof src === "string" && src.startsWith("data:");

    // SVGs can't go through Next.js image optimizer → serve them raw
    const isSvg = typeof src === "string" && (
        src.endsWith(".svg") ||
        src.includes(".svg?") ||
        src.includes("/svg")          // covers api.dicebear.com/.../svg
    );
    const shouldUnoptimize = unoptimizedProp ?? isSvg;

    const handleLoad = (e) => {
        setLoaded(true);
        onLoadProp?.(e);
        onLoadingComplete?.(e); // backwards compat — no-op if not passed
    };

    const handleError = () => {
        setError(true);
    };

    const wrapperStyles = fill
        ? `absolute inset-0 overflow-hidden ${wrapperClassName}`
        : `relative overflow-hidden ${wrapperClassName}`;

    const imgClassName = [
        "relative z-10 transition-opacity duration-500",
        loaded ? "opacity-100" : "opacity-0",
        fill ? "" : "h-full w-full object-cover",
        className,
    ].filter(Boolean).join(" ");

    return (
        <div className={wrapperStyles}>
            {/* Shimmer overlay — fades out once image is loaded */}
            <div
                className={`absolute inset-0 z-0 bg-white/5 transition-opacity duration-700 ${
                    loaded ? "opacity-0 invisible" : "opacity-100 visible"
                }`}
            >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {!isPlaceholder && !error ? (
                isDataUrl ? (
                    // Data URLs: use native <img> — no Next.js optimization needed
                    <img
                        src={src}
                        alt={alt || "Image"}
                        className={imgClassName.replace("h-full w-full object-cover", "") + (fill ? " absolute inset-0 h-full w-full object-cover" : " h-full w-full object-cover")}
                        onLoad={handleLoad}
                        onError={handleError}
                    />
                ) : (
                    <Image
                        {...props}
                        src={src}
                        alt={alt || "Image"}
                        fill={fill}
                        unoptimized={shouldUnoptimize}
                        className={imgClassName}
                        onLoad={handleLoad}
                        onError={handleError}
                    />
                )
            ) : (
                // Fallback placeholder
                <div
                    className={`relative z-10 flex flex-col items-center justify-center bg-zinc-900 border border-white/5 ${
                        fill ? "absolute inset-0" : "h-full w-full"
                    } ${className}`}
                >
                    <div className="text-[10px] font-black uppercase text-white/10 tracking-[0.2em] text-center px-4">
                        {alt || "No Image"}
                    </div>
                </div>
            )}
        </div>
    );
}

// shimmer keyframe must be defined in tailwind.config.js or globals.css:
// @keyframes shimmer { 100% { transform: translateX(100%); } }


