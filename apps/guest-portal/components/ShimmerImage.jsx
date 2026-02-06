"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function ShimmerImage({ className = "", wrapperClassName = "", onLoad, onLoadingComplete, ...props }) {
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const isPlaceholder = props.src === "placeholder";

  useEffect(() => {
    setLoaded(false);
    setError(false);
    if (props.src && String(props.src).startsWith('http')) {
      console.log(`[ShimmerImage] Loading: ${props.alt} -> ${props.src}`);
    }
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && !isPlaceholder) {
      setLoaded(true);
    }
  }, [props.src, isPlaceholder, props.alt]);

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

  return (
    <div className={`relative ${props.fill ? "h-full w-full" : ""} ${wrapperClassName}`}>
      <div
        className={`absolute inset-0 rounded-[inherit] bg-black/5 dark:bg-white/5 transition-opacity duration-700 ${loaded ? "opacity-0" : "opacity-100"
          }`}
      >
        <div className="absolute inset-0 -translate-x-full animate-[shimmer-block_2s_infinite] bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />
      </div>

      {!isPlaceholder && !error ? (
        <Image
          {...props}
          unoptimized={props.unoptimized || (props.src && String(props.src).startsWith('http'))}
          ref={imgRef}
          className={`relative z-10 ${className}`}
          onLoad={(event) => {
            handleLoad(event);
            handleComplete(event.target);
          }}
          onError={(e) => {
            console.error(`[ShimmerImage] Failed to load: ${props.alt}`, props.src);
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
