"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const defaultSizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";

export default function ShimmerImage({ className = "", wrapperClassName = "", onLoad, onLoadingComplete, ...props }) {
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const isDiceBear = typeof props.src === "string" && props.src.includes("dicebear.com");

  function handleLoad(event) {
    setLoaded(true);
    onLoad?.(event);
    onLoadingComplete?.(event);
  }

  return (
    <div className={`relative ${props.fill ? "h-full w-full" : ""} ${wrapperClassName}`}>
      <div
        className={`absolute inset-0 rounded-[inherit] bg-black/5 dark:bg-white/5 transition-opacity duration-700 ${loaded ? "opacity-0" : "opacity-100"
          }`}
      >
        <div className="absolute inset-0 -translate-x-full animate-[shimmer-block_2s_infinite] bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />
      </div>

      {!error ? (
        <Image
          sizes={props.sizes || (props.fill ? defaultSizes : undefined)}
          {...props}
          unoptimized={isDiceBear || props.unoptimized || (props.src && String(props.src).startsWith('http'))}
          ref={imgRef}
          className={`relative z-10 ${className}`}
          onLoad={(event) => {
            handleLoad(event);
          }}
          onError={() => {
            setError(true);
          }}
        />
      ) : (
        <div className={`relative z-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase text-zinc-400 ${className}`}>
          {props.alt?.slice(0, 2) || "IM"}
        </div>
      )}
    </div>
  );
}
