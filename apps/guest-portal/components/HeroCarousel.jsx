"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import Image from "next/image";

/**
 * HeroCarousel - A high-performance 3D "Museum Shelf" carousel.
 * Optimized for smoothness with a physics-based animation loop.
 */
export default function HeroCarousel({ cards = [] }) {
  const progress = useMotionValue(0);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0); // For pagination only

  // Animation & Physics Refs
  const requestRef = useRef();
  const lastTimestampRef = useRef();
  const targetProgressRef = useRef(0); // Goal progress (incorporates drag & momentum)
  const velocityRef = useRef(0); // Current rotational velocity
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const dragStartTime = useRef(0);
  const lastSyncTime = useRef(0);

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

  const animate = useCallback(
    (time) => {
      if (!lastTimestampRef.current) lastTimestampRef.current = time;
      const deltaTime = time - lastTimestampRef.current;
      lastTimestampRef.current = time;

      if (cards.length > 0) {
        let currentVal = progress.get();

        if (isDragging.current) {
          // Dragging: we manually set targetProgress in handleMouseMove
          // Smoothly pull current progress towards target
          const nextVal = currentVal + (targetProgressRef.current - currentVal) * LERP_FACTOR;
          progress.set(nextVal);
        } else {
          // Not Dragging: Handle momentum, river flow, and snapping
          targetProgressRef.current += RIVER_SPEED * deltaTime;
          targetProgressRef.current += velocityRef.current;
          velocityRef.current *= FRICTION;

          const nextVal = currentVal + (targetProgressRef.current - currentVal) * LERP_FACTOR;
          progress.set(nextVal);
        }

        // Sync with React state infrequently for pagination UI only
        if (time - lastSyncTime.current > 100) {
          const wrappedProgress = ((progress.get() % cards.length) + cards.length) % cards.length;
          setRenderProgress(wrappedProgress);
          lastSyncTime.current = time;
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    },
    [cards.length, progress],
  );

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
          Featured{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4b1f] via-[#ff9068] to-[#ff4b1f] bg-[length:200%_auto] animate-gradient-x">
            Drops
          </span>
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
        <div
          className={`relative w-full h-full flex items-center ${isMobile ? "justify-start overflow-x-auto px-6 gap-6 no-scrollbar snap-x snap-mandatory pb-10" : "justify-center"}`}
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

      {!isMobile && (
        <div className="mt-12 z-20 flex gap-2">
          {cards.map((_, i) => {
            const dist = Math.min(
              Math.abs(i - renderProgress),
              Math.abs(i - renderProgress + cards.length),
              Math.abs(i - renderProgress - cards.length),
            );
            const isActive = dist < 0.5;
            return (
              <button
                key={i}
                onClick={() => handleCardClick(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ease-out hover:bg-white/40 ${isActive ? "w-12 bg-[#ff4b1f] shadow-[0_0_20px_rgba(255,75,31,0.5)]" : "w-3 bg-white/10"}`}
              />
            );
          })}
        </div>
      )}

      <style jsx global>{`
        @keyframes gradient-x {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </section>
  );
}

function CardItem({ card, index, progress, isMobile, isTablet, onClick, cardsCount }) {
  // We use useTransform to calculate the position based on the progress motion value
  const transform = useTransform(progress, (p) => {
    let offset = index - (p % cardsCount);
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

    return { x, z, rotateY, scale, opacity, zIndex, absOffset };
  });

  // Derived values for animations that don't need to be in the main physics loop
  const x = useTransform(transform, (t) => t.x);
  const z = useTransform(transform, (t) => t.z);
  const rotateY = useTransform(transform, (t) => t.rotateY);
  const scale = useTransform(transform, (t) => t.scale);
  const opacity = useTransform(transform, (t) => t.opacity);
  const zIndex = useTransform(transform, (t) => t.zIndex);
  const absOffset = useTransform(transform, (t) => t.absOffset);

  const width = isMobile ? 320 : isTablet ? 250 : 300;
  const height = isMobile ? 480 : isTablet ? 380 : 450;

  if (isMobile) {
    return (
      <motion.div
        className="relative shrink-0 rounded-[24px] overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 snap-center"
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
        transition: { duration: 0.3 },
      }}
      onClick={onClick}
    >
      {/* 
              Fix for "Shredded" distortion: 
              We use a separate internal wrapper for overflow-hidden and border-radius.
              Applying overflow-hidden and 3D transforms on the SAME div is what causes the browser to glitch.
            */}
      <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-[#0A0A0A] border-[1.5px] border-white/5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-500 group-hover:border-[#ff4b1f]/30 group-hover:shadow-[0_40px_80px_-20px_rgba(255,75,31,0.15)]">
        <CardContent card={card} progress={progress} index={index} cardsCount={cardsCount} />
      </div>
    </motion.div>
  );
}

function CardContent({ card, progress, index, cardsCount }) {
  const overlayTransform = useTransform(progress, (p) => {
    if (!progress) return { opacity: 1, y: 0, textOpacity: 1 };
    let offset = index - (p % cardsCount);
    if (offset > cardsCount / 2) offset -= cardsCount;
    if (offset < -cardsCount / 2) offset += cardsCount;
    const absOffset = Math.abs(offset);

    // Calculate opacity and Y based on distance from center
    const opacity = Math.max(0, 1 - absOffset * 0.8);
    const y = absOffset * 20;
    const textOpacity = Math.max(0, 1 - absOffset * 1.5);

    return { opacity, y, textOpacity };
  });

  const opacity = useTransform(overlayTransform, (t) => t.opacity);
  const y = useTransform(overlayTransform, (t) => t.y);
  const textOpacity = useTransform(overlayTransform, (t) => t.textOpacity);

  return (
    <>
      <motion.div className="absolute inset-0 z-0" style={{ scale: 1.1 }}>
        <Image
          src={card.image}
          alt={card.title}
          fill
          className="object-cover transition-transform duration-1000 group-hover:scale-110"
          sizes="(max-width: 768px) 400px, 500px"
        />
      </motion.div>

      {/* Rich Gradient Layer */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />

      {/* Info Overlay */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-30"
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
          {card.description ||
            "An exclusive event curated for the seekers of culture and underground sound."}
        </p>

        {/* CTA / Detail Link */}
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
