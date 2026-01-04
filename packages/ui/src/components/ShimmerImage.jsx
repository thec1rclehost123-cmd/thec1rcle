"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * A shared ShimmerImage component with loading states.
 */
export default function ShimmerImage({ className = "", wrapperClassName = "", onLoad, onLoadingComplete, fill, ...props }) {
    const imgRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const isPlaceholder = !props.src || props.src === "placeholder";

    useEffect(() => {
        setLoaded(false);
        setError(false);
        const img = imgRef.current;
        if (img && img.complete && img.naturalWidth > 0 && !isPlaceholder) {
            setLoaded(true);
        }
    }, [props.src, isPlaceholder]);

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

    // When fill is used, the wrapper needs to be absolute to match parent dimensions
    const wrapperStyles = fill
        ? `absolute inset-0 overflow-hidden ${wrapperClassName}`
        : `relative overflow-hidden ${wrapperClassName}`;

    return (
        <div className={wrapperStyles}>
            <div
                className={`absolute inset-0 rounded-[inherit] bg-black/5 dark:bg-white/5 transition-opacity duration-700 ${loaded ? "opacity-0" : "opacity-100"
                    }`}
            >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer-block_2s_infinite] bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />
            </div>

            {!isPlaceholder && !error ? (
                <Image
                    {...props}
                    fill={fill}
                    ref={imgRef}
                    className={`relative z-10 transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
                    onLoad={(event) => {
                        handleLoad(event);
                        handleComplete(event.target);
                    }}
                    onError={() => setError(true)}
                />
            ) : (
                <div className={`relative z-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase text-zinc-400 ${fill ? 'absolute inset-0' : ''} ${className}`}>
                    {props.alt?.slice(0, 2) || "IM"}
                </div>
            )}

            <style jsx global>{`
        @keyframes shimmer-block {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
        </div>
    );
}
