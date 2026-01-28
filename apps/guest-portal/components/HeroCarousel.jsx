"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";

/**
 * HeroCarousel - A high-performance 3D "Museum Shelf" carousel.
 * Optimized for smoothness with a physics-based animation loop.
 */
export default function HeroCarousel({ cards = [] }) {
    const [progress, setProgress] = useState(0); // The "state" progress that drives the UI
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);
    const [isDraggingState, setIsDraggingState] = useState(false);

    // Animation & Physics Refs
    const requestRef = useRef();
    const lastTimestampRef = useRef();
    const progressRef = useRef(0);        // Internal precise progress
    const targetProgressRef = useRef(0);  // Goal progress (incorporates drag & momentum)
    const velocityRef = useRef(0);        // Current rotational velocity
    const isDragging = useRef(false);
    const lastX = useRef(0);
    const lastTime = useRef(0);
    const dragStartTime = useRef(0);

    useEffect(() => {
        setMounted(true);
        const handleResize = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768);
            setIsTablet(width >= 768 && width < 1024);
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Physics Constants
    const FRICTION = 0.96;
    const DRAG_SENSITIVITY = 0.0018;
    const LERP_FACTOR = 0.1; // Lower = smoother/heavier, Higher = snappier
    const RIVER_SPEED = 0.00015; // Change in progress per ms

    const animate = useCallback((time) => {
        if (!lastTimestampRef.current) lastTimestampRef.current = time;
        const deltaTime = time - lastTimestampRef.current;
        lastTimestampRef.current = time;

        if (cards.length > 0) {
            if (isDragging.current) {
                // Dragging: we manually set targetProgress in handleMouseMove
                // Smoothly pull current progress towards target
                progressRef.current += (targetProgressRef.current - progressRef.current) * LERP_FACTOR;
            } else {
                // Not Dragging: Handle momentum, river flow, and snapping

                // 1. River Flow (Constant drift)
                targetProgressRef.current += RIVER_SPEED * deltaTime;

                // 2. Momentum
                targetProgressRef.current += velocityRef.current;
                velocityRef.current *= FRICTION;

                // 3. Snap-to-center logic
                // (Disabled to allow continuous river flow)
                /* 
                if (Math.abs(velocityRef.current) < 0.005) {
                    const nearest = Math.round(targetProgressRef.current);
                    targetProgressRef.current += (nearest - targetProgressRef.current) * 0.05;
                }
                */

                // 4. Lerp actual progress towards target
                progressRef.current += (targetProgressRef.current - progressRef.current) * LERP_FACTOR;
            }

            // Sync with React state for rendering
            const wrappedProgress = ((progressRef.current % cards.length) + cards.length) % cards.length;
            setProgress(wrappedProgress);
        }

        requestRef.current = requestAnimationFrame(animate);
    }, [cards.length]);

    useEffect(() => {
        if (mounted && !isMobile) {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [mounted, isMobile, animate]);

    // Input Handlers
    const handleMouseDown = (e) => {
        if (isMobile) return;
        isDragging.current = true;
        setIsDraggingState(true);
        lastX.current = e.pageX;
        lastTime.current = performance.now();
        dragStartTime.current = lastTime.current;
        velocityRef.current = 0;
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;

        const now = performance.now();
        const dt = now - lastTime.current;
        const dx = e.pageX - lastX.current;

        // Shift the target based on mouse movement
        targetProgressRef.current -= dx * DRAG_SENSITIVITY;

        // Calculate velocity for momentum (averaged slightly for smoothness)
        if (dt > 0) {
            const instantVelocity = -(dx * DRAG_SENSITIVITY);
            velocityRef.current = velocityRef.current * 0.4 + instantVelocity * 0.6;
        }

        lastX.current = e.pageX;
        lastTime.current = now;
    };

    const handleMouseUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        setIsDraggingState(false);
    };

    const handleCardClick = (index) => {
        const dragDuration = performance.now() - dragStartTime.current;
        if (dragDuration < 200 && Math.abs(velocityRef.current) < 0.01) {
            let diff = index - (progressRef.current % cards.length);
            if (diff > cards.length / 2) diff -= cards.length;
            if (diff < -cards.length / 2) diff += cards.length;

            targetProgressRef.current = progressRef.current + diff;
            velocityRef.current = 0;
        }
    };

    if (!mounted) return null;

    return (
        <section className="relative w-full min-h-[420px] md:min-h-[620px] lg:min-h-[720px] bg-[#050505] flex flex-col items-center pt-8 pb-8 md:pt-14 md:pb-14 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ff4b1f]/5 blur-[140px] rounded-full mix-blend-plus-lighter animate-pulse" />
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full" />
            </div>

            {/* Heading Block */}
            <div className="flex flex-col items-center justify-center text-center z-20 mb-10 md:mb-16 relative px-4">
                <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] tracking-[0.3em] text-[#ff4b1f] font-black uppercase mb-6 shadow-2xl"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff4b1f] animate-ping" />
                    Now Dropping
                </motion.span>
                <motion.h1
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="text-[34px] md:text-[56px] lg:text-[76px] leading-[0.9] font-black uppercase tracking-tighter text-white mb-4"
                >
                    Featured <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4b1f] via-[#ff9068] to-[#ff4b1f] bg-[length:200%_auto] animate-gradient-x">Drops</span>
                </motion.h1>
                <div className="w-32 h-1 bg-gradient-to-r from-transparent via-[#ff4b1f] to-transparent opacity-40" />
            </div>

            {/* 3D Carousel Container */}
            <div
                className="relative w-full max-w-full flex items-center justify-center z-10 select-none"
                style={{
                    perspective: isMobile ? "1000px" : "1800px",
                    height: isMobile ? "460px" : "600px",
                    cursor: isDraggingState ? "grabbing" : "grab",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div className={`relative w-full h-full flex items-center ${isMobile ? 'justify-start overflow-x-auto px-6 gap-6 no-scrollbar snap-x snap-mandatory pb-10' : 'justify-center'}`}
                    style={{ transformStyle: "preserve-3d" }}
                >
                    {cards.map((card, index) => (
                        <CardItem
                            key={card.id || index}
                            card={card}
                            index={index}
                            progress={progress}
                            isMobile={isMobile}
                            isTablet={isTablet}
                            onClick={() => handleCardClick(index)}
                            cardsCount={cards.length}
                        />
                    ))}
                </div>
            </div>

            {/* Pagination Tabs */}
            {!isMobile && (
                <div className="mt-12 z-20 flex gap-2">
                    {cards.map((_, i) => {
                        const dist = Math.min(
                            Math.abs(i - progress),
                            Math.abs(i - progress + cards.length),
                            Math.abs(i - progress - cards.length)
                        );
                        const isActive = dist < 0.5;
                        return (
                            <button
                                key={i}
                                onClick={() => handleCardClick(i)}
                                className={`h-1.5 rounded-full transition-all duration-500 ease-out hover:bg-white/40 ${isActive ? 'w-12 bg-[#ff4b1f] shadow-[0_0_20px_rgba(255,75,31,0.5)]' : 'w-3 bg-white/10'}`}
                            />
                        );
                    })}
                </div>
            )}

            <style jsx global>{`
                @keyframes gradient-x {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient-x {
                    animation: gradient-x 3s ease infinite;
                }
            `}</style>
        </section>
    );
}

function CardItem({ card, index, progress, isMobile, isTablet, onClick, cardsCount }) {
    let offset = index - progress;
    if (offset > cardsCount / 2) offset -= cardsCount;
    if (offset < -cardsCount / 2) offset += cardsCount;

    const absOffset = Math.abs(offset);

    const radius = isTablet ? 1200 : 1800;
    const angleStep = isTablet ? 16 : 11;
    const angle = offset * angleStep;
    const rad = (angle * Math.PI) / 180;

    const interpX = Math.sin(rad) * radius;
    const interpZ = Math.cos(rad) * radius - radius + (isTablet ? 60 : 120);
    const interpRotateY = angle;

    const interpScale = 1.45 / (1 + absOffset * 0.14);
    const interpOpacity = Math.max(0, 1 - (absOffset - 1.8) * 0.6);
    const interpZIndex = Math.round(1000 - absOffset * 100);

    const width = isMobile ? 320 : isTablet ? 250 : 300;
    const height = isMobile ? 480 : isTablet ? 380 : 450;

    if (isMobile) {
        return (
            <motion.div
                className="relative shrink-0 rounded-[28px] overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 snap-center"
                style={{ width, height }}
                whileTap={{ scale: 0.98 }}
                onClick={onClick}
            >
                <CardContent card={card} isCenter={true} />
            </motion.div>
        );
    }

    return (
        <motion.div
            className="absolute rounded-[28px] overflow-hidden bg-[#0A0A0A] cursor-pointer group shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-shadow duration-500 hover:shadow-[0_40px_80px_-20px_rgba(255,75,31,0.15)]"
            style={{
                width,
                height,
                transformStyle: "preserve-3d",
            }}
            animate={{
                x: interpX,
                z: interpZ,
                rotateY: interpRotateY,
                opacity: interpOpacity,
                scale: interpScale,
                zIndex: interpZIndex,
                borderColor: absOffset < 0.5 ? `rgba(255, 75, 31, 0.5)` : `rgba(255, 255, 255, 0.05)`,
            }}
            transition={{
                duration: 0.05,
                ease: "linear"
            }}
            whileHover={{
                scale: interpScale * 1.04,
                transition: { duration: 0.3 }
            }}
            onClick={onClick}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none z-30" />
            <div className="w-full h-full relative text-white border-[1px] border-inherit rounded-[inherit]">
                <CardContent card={card} isCenter={absOffset < 0.5} />
            </div>
        </motion.div>
    );
}

function CardContent({ card, isCenter }) {
    return (
        <>
            <Image
                src={card.image}
                alt={card.title}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-110"
                sizes="(max-width: 768px) 400px, 500px"
            />

            {/* Rich Gradient Layer */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />

            {/* Info Overlay */}
            <div className={`absolute bottom-0 left-0 right-0 p-6 md:p-8 z-30 transition-all duration-700 ${isCenter ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-80'}`}>
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

                {/* CTA / Detail Link */}
                <div className={`flex items-center gap-3 text-[#ff4b1f] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${isCenter ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                    <span>View Drop</span>
                    <div className="w-8 h-[2px] bg-[#ff4b1f]" />
                </div>
            </div>
        </>
    );
}
