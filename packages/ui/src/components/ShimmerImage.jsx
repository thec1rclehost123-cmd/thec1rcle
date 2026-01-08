"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * A shared ShimmerImage component with loading states using only Tailwind.
 */
export default function ShimmerImage({
    className = "",
    wrapperClassName = "",
    onLoad,
    onLoadingComplete,
    fill,
    src,
    alt,
    ...props
}) {
    const imgRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const isPlaceholder = !src || src === "placeholder";
    const isDataUrl = typeof src === "string" && src.startsWith("data:");
    const isLocal = typeof src === "string" && src.startsWith("/");
    // We prefer Next.js Image for local paths too for optimization and better handling
    const useNativeImage = isDataUrl;

    useEffect(() => {
        if (!src || isPlaceholder) {
            setError(true);
            return;
        }
        setError(false);

        // If it's a data URL, it's ready immediately
        if (isDataUrl) {
            setLoaded(true);
            return;
        }

        // Reset loaded state for new src
        setLoaded(false);

        // Check if image is already cached/loaded
        if (imgRef.current && imgRef.current.complete) {
            setLoaded(true);
        }
    }, [src, isPlaceholder, isDataUrl]);

    const handleLoad = (e) => {
        setLoaded(true);
        if (onLoad) onLoad(e);
        if (onLoadingComplete) onLoadingComplete(e);
    };

    const handleError = () => {
        console.error(`[ShimmerImage] Failed to load: ${src?.substring(0, 50)}...`);
        setError(true);
    };

    const wrapperStyles = fill
        ? `absolute inset-0 overflow-hidden ${wrapperClassName}`
        : `relative overflow-hidden ${wrapperClassName}`;

    return (
        <div className={wrapperStyles}>
            {/* Shimmer Effect */}
            <div
                className={`absolute inset-0 z-0 bg-white/5 transition-opacity duration-700 ${loaded ? "opacity-0 invisible" : "opacity-100 visible"
                    }`}
            >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {!isPlaceholder && !error ? (
                useNativeImage ? (
                    <img
                        ref={imgRef}
                        src={src}
                        alt={alt || "Image"}
                        className={`relative z-10 transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"
                            } ${fill ? 'absolute inset-0 h-full w-full object-cover' : 'h-full w-full object-cover'} ${className}`}
                        onLoad={handleLoad}
                        onError={handleError}
                    />
                ) : (
                    <Image
                        {...props}
                        src={src}
                        alt={alt || "Image"}
                        fill={fill}
                        ref={(node) => {
                            // Support both functional ref (for Next.js Image) and local ref
                            if (node) {
                                imgRef.current = node.querySelector ? node.querySelector('img') : node;
                                if (imgRef.current?.complete && !loaded) {
                                    setLoaded(true);
                                }
                            }
                        }}
                        className={`relative z-10 transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"
                            } ${className}`}
                        onLoadingComplete={handleLoad}
                        onError={handleError}
                    />
                )
            ) : (
                <div className={`relative z-10 flex flex-col items-center justify-center bg-zinc-900 border border-white/5 ${fill ? 'absolute inset-0' : 'h-full w-full'
                    } ${className}`}>
                    <div className="text-[10px] font-black uppercase text-white/10 tracking-[0.2em] text-center px-4">
                        {alt || "No Image"}
                    </div>
                </div>
            )}
        </div>
    );
}

// Ensure the shimmer animation is in tailwind.config.js or globals.css:
// @keyframes shimmer {
//   100% { transform: translateX(100%); }
// }
// .animate-shimmer { animation: shimmer 2s infinite; }
