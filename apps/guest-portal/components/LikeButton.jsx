"use client";

import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { trackEvent } from "../lib/utils/analytics";

export default function LikeButton({ eventId }) {
    const router = useRouter();
    const pathname = usePathname();

    const handleLikeClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        trackEvent("web_like_clicked", {
            eventId,
            path: pathname,
            source: "web"
        });

        const returnTo = encodeURIComponent(pathname);
        router.push(`/app?reason=like&eventId=${eventId || ''}&source=web&returnTo=${returnTo}`);
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLikeClick}
            aria-label="Like event in app"
            className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white/12 backdrop-blur-[14px] transition-all duration-300"
            style={{
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
        >
            <Heart
                size={22}
                className="text-white transition-colors duration-300 group-hover:text-white/80"
            />

            {/* Subtle highlight ring on hover */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_70%)]" />
        </motion.button>
    );
}
