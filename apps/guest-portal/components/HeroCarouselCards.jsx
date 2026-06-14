"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import Image from "next/image";

export function CardItem({ card, index, progress, isTablet, onClick, cardsCount }) {
    // We use useTransform to calculate the position based on the progress motion value
    const transform = useTransform(progress, (p) => {
        // Sanity check for NaN
        const safeProgress = Number.isFinite(p) ? p : 0;

        let offset = index - (safeProgress % cardsCount);
        if (offset > cardsCount / 2) offset -= cardsCount;
        if (offset < -cardsCount / 2) offset += cardsCount;

        const absOffset = Math.abs(offset);
        const radius = isTablet ? 1200 : 1800;
        const angleStep = isTablet ? 16 : 11;
        const angle = offset * angleStep;
        const rad = (angle * Math.PI) / 180;

        const x = Math.sin(rad) * radius;
        const z = Math.cos(rad) * radius - radius + (isTablet ? 60 : 120);
        const rotateY = angle;
        const scale = 1.45 / (1 + absOffset * 0.14);
        const opacity = Math.max(0, 1 - (absOffset - 1.8) * 0.6);
        const zIndex = Math.round(1000 - absOffset * 100);

        return { x, z, rotateY, scale, opacity: Number.isFinite(opacity) ? opacity : 0, zIndex, absOffset };
    });

    // Derived values for animations that don't need to be in the main physics loop
    const x = useTransform(transform, (t) => t.x);
    const z = useTransform(transform, (t) => t.z);
    const rotateY = useTransform(transform, (t) => t.rotateY);
    const scale = useTransform(transform, (t) => t.scale);
    const opacity = useTransform(transform, (t) => t.opacity);
    const zIndex = useTransform(transform, (t) => t.zIndex);

    const width = isTablet ? 250 : 300;
    const height = isTablet ? 380 : 450;

    return (
        <motion.div
            className="absolute cursor-pointer group"
            style={{
                width,
                height,
                x,
                z,
                rotateY,
                scale,
                opacity,
                zIndex,
                transformStyle: "preserve-3d",
                perspective: "1000px",
            }}
            whileHover={{
                scale: 1.05,
                transition: { duration: 0.3 }
            }}
            onClick={onClick}
        >
            <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-[#0A0A0A] border-[1.5px] border-white/5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-500 group-hover:border-[#ff4b1f]/30 group-hover:shadow-[0_40px_80px_-20px_rgba(255,75,31,0.15)]">
                <CardContent card={card} progress={progress} index={index} cardsCount={cardsCount} priority={index < 3} />
            </div>
        </motion.div>
    );
}

export function CardContent({ card, progress, index, cardsCount, priority = false }) {
    const fallbackMotionValue = useMotionValue(0);
    const overlayTransform = useTransform(progress || fallbackMotionValue, (p) => {
        // Sanity check for NaN
        const safeProgress = Number.isFinite(p) ? p : 0;

        let offset = index - (safeProgress % cardsCount);
        if (offset > cardsCount / 2) offset -= cardsCount;
        if (offset < -cardsCount / 2) offset += cardsCount;
        const absOffset = Math.abs(offset);

        // Calculate opacity and Y based on distance from center
        const opacity = Math.max(0, 1 - absOffset * 0.8);
        const y = absOffset * 20;
        const textOpacity = Math.max(0, 1 - absOffset * 1.5);

        return {
            opacity: Number.isFinite(opacity) ? opacity : 0,
            y: Number.isFinite(y) ? y : 0,
            textOpacity: Number.isFinite(textOpacity) ? textOpacity : 0
        };
    });

    const opacity = useTransform(overlayTransform, (t) => t.opacity);
    const y = useTransform(overlayTransform, (t) => t.y);
    const textOpacity = useTransform(overlayTransform, (t) => t.textOpacity);

    return (
        <>
            <motion.div
                className="absolute inset-0 z-0"
                style={{ scale: 1.1 }}
            >
                <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    priority={priority}
                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                    sizes="(max-width: 1200px) 50vw, 33vw"
                />
            </motion.div>

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />

            <motion.div
                className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 z-30"
                style={{ opacity, y }}
            >
                <div className="flex items-center gap-3 mb-4">
                    <span className="px-3.5 py-1.5 rounded-full bg-[#ff4b1f] text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,75,31,0.4)]">
                        Live
                    </span>
                    <span className="text-[12px] text-white/90 font-bold uppercase tracking-widest drop-shadow-md">
                        {card.venue || "The C1rcle"}
                    </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-black uppercase leading-[1.1] text-white mb-3 tracking-tight drop-shadow-2xl">
                    {card.title}
                </h3>

                <p className="text-xs md:text-sm text-white/60 font-medium line-clamp-2 leading-relaxed mb-6">
                    {card.description || "An exclusive event curated for the seekers of culture and underground sound."}
                </p>

                <motion.div
                    className="flex items-center gap-3 text-[#ff4b1f] text-[11px] font-black uppercase tracking-[0.2em]"
                    style={{ opacity: textOpacity }}
                >
                    <span>View Drop</span>
                    <div className="w-8 h-[2px] bg-[#ff4b1f]" />
                </motion.div>
            </motion.div>
        </>
    );
}

export default CardContent;
