"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function ShimmerImage({ className = "", wrapperClassName = "", onLoad, onLoadingComplete, ...props }) {
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [props.src]);

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
    <div className={`relative ${wrapperClassName}`}>
      <div
        className={`absolute inset-0 rounded-[inherit] bg-white/5 shimmer-block transition-opacity duration-700 ${
          loaded ? "opacity-0" : "opacity-60"
        }`}
      />
      <Image
        {...props}
        ref={imgRef}
        className={`relative z-10 ${className}`}
        onLoad={handleLoad}
        onLoadingComplete={handleComplete}
      />
    </div>
  );
}
