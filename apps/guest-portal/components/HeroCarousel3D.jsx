"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue } from "framer-motion";
import { CardItem } from "./HeroCarouselCards";

export default function HeroCarousel3D({ cards = [] }) {
    const progress = useMotionValue(0);
    const [mounted, setMounted] = useState(false);
    const [isTablet, setIsTablet] = useState(false);
    const [isDraggingState, setIsDraggingState] = useState(false);
    const [renderProgress, setRenderProgress] = useState(0);

    const requestRef = useRef();
    const lastTimestampRef = useRef();
    const targetProgressRef = useRef(0);
    const velocityRef = useRef(0);
    const isDragging = useRef(false);
    const lastX = useRef(0);
    const lastTime = useRef(0);
    const dragStartTime = useRef(0);
    const lastSyncTime = useRef(0);

    useEffect(() => {
        setMounted(true);
        const handleResize = () => {
            const width = window.innerWidth;
            setIsTablet(width >= 768 && width < 1024);
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const FRICTION = 0.96;
    const DRAG_SENSITIVITY = 0.0018;
    const LERP_FACTOR = 0.1;
    const RIVER_SPEED = 0.00015;

    const animate = useCallback((time) => {
        if (!lastTimestampRef.current) lastTimestampRef.current = time;
        const deltaTime = time - lastTimestampRef.current;
        lastTimestampRef.current = time;

        if (cards.length > 0) {
            let currentVal = progress.get();

            if (isDragging.current) {
                const nextVal = currentVal + (targetProgressRef.current - currentVal) * LERP_FACTOR;
                progress.set(nextVal);
            } else {
                targetProgressRef.current += RIVER_SPEED * deltaTime;
                targetProgressRef.current += velocityRef.current;
                velocityRef.current *= FRICTION;

                const nextVal = currentVal + (targetProgressRef.current - currentVal) * LERP_FACTOR;
                progress.set(nextVal);
            }

            if (time - lastSyncTime.current > 100) {
                const wrappedProgress = ((progress.get() % cards.length) + cards.length) % cards.length;
                setRenderProgress(wrappedProgress);
                lastSyncTime.current = time;
            }
        }

        requestRef.current = requestAnimationFrame(animate);
    }, [cards.length, progress]);

    useEffect(() => {
        if (mounted) {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [mounted, animate]);

    const handleMouseDown = (e) => {
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
        targetProgressRef.current -= dx * DRAG_SENSITIVITY;
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
            const current = progress.get();
            let diff = index - (current % cards.length);
            if (diff > cards.length / 2) diff -= cards.length;
            if (diff < -cards.length / 2) diff += cards.length;
            targetProgressRef.current = current + diff;
            velocityRef.current = 0;
        }
    };

    if (!mounted) return null;

    return (
        <>
            <div
                className="relative w-full max-w-full flex items-center justify-center z-10 select-none"
                style={{
                    perspective: "1800px",
                    height: "600px",
                    cursor: isDraggingState ? "grabbing" : "grab",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div className="relative w-full h-full flex items-center justify-center"
                    style={{ transformStyle: "preserve-3d" }}
                >
                    {cards.map((card, index) => (
                        <CardItem
                            key={card.id || index}
                            card={card}
                            index={index}
                            progress={progress}
                            isTablet={isTablet}
                            onClick={() => handleCardClick(index)}
                            cardsCount={cards.length}
                        />
                    ))}
                </div>
            </div>

            <div className="mt-12 z-20 flex gap-2">
                {cards.map((_, i) => {
                    const dist = Math.min(
                        Math.abs(i - renderProgress),
                        Math.abs(i - renderProgress + cards.length),
                        Math.abs(i - renderProgress - cards.length)
                    );
                    const isActive = dist < 0.5;
                    return (
                        <button
                            key={i}
                            onClick={() => handleCardClick(i)}
                            className={`h-1.5 rounded-full transition-all duration-500 ease-out hover:bg-white/40 ${isActive ? 'w-12 bg-[#ff4b1f] shadow-[0_0_20px_rgba(255,75,31,0.5)]' : 'w-3 bg-white/10'}`}
                            suppressHydrationWarning
                        />
                    );
                })}
            </div>
        </>
    );
}
