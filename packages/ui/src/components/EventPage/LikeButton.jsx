"use client";

import { Heart } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Shared LikeButton component.
 */
export default function LikeButton({
    eventId,
    isLiked = false,
    onLike,
    isPreview = false
}) {
    const handleLikeClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isPreview) return;

        if (typeof onLike === "function") {
            onLike(!isLiked);
        }
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLikeClick}
            aria-label={isLiked ? "Unlike event" : "Like event"}
            disabled={isPreview}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 ${isLiked
                    ? "border-orange/40 bg-orange/20 shadow-[0_0_15px_rgba(244,74,34,0.2)]"
                    : "border-white/18 bg-white/12 backdrop-blur-[14px]"
                } ${isPreview ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
            <Heart
                size={20}
                className={`transition-colors duration-300 ${isLiked ? "fill-orange text-orange" : "text-white group-hover:text-white/80"
                    }`}
            />

            {/* Subtle highlight ring on hover */}
            {!isPreview && (
                <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_70%)]" />
            )}

            {isPreview && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Preview
                </div>
            )}
        </motion.button>
    );
}
