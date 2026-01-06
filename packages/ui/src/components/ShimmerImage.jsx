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

    useEffect(() => {
        setLoaded(false);
        setError(false);
        const img = imgRef.current;
        if (img && img.complete && img.naturalWidth > 0 && !isPlaceholder) {
            setLoaded(true);
        }
    }, [src, isPlaceholder]);

    const handleLoad = (event) => {
        setLoaded(true);
        if (typeof onLoad === "function") {
            onLoad(event);
        }
    };

    const handleComplete = (img) => {
        setLoaded(true);
        if (typeof onLoadingComplete === "function") {
            onLoadingComplete(img);
        }
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
                <Image
                    {...props}
                    src={src}
                    alt={alt || "Image"}
                    fill={fill}
                    ref={imgRef}
                    className={`relative z-10 transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"
                        } ${className}`}
                    onLoad={(event) => {
                        handleLoad(event);
                        handleComplete(event.target);
                    }}
                    onError={() => setError(true)}
                />
            ) : (
                <div className={`relative z-10 flex items-center justify-center bg-zinc-800 text-[10px] font-black uppercase text-zinc-500 ${fill ? 'absolute inset-0' : 'h-full w-full'
                    } ${className}`}>
                    {alt?.slice(0, 2) || "IM"}
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
