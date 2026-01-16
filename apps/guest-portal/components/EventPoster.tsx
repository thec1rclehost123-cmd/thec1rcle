"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useParallaxTilt } from "../lib/hooks/useParallaxTilt";
import { gradients } from "../lib/designSystem";

interface EventPosterProps {
  event: {
    image: string;
    title: string;
    category?: string;
  };
  className?: string;
}

export default function EventPoster({ event, className }: EventPosterProps) {
  const tilt = useParallaxTilt({ intensity: 10, scale: 1.03 });

  return (
    <motion.div
      className={clsx(
        "relative overflow-hidden rounded-[36px] border border-white/10 bg-white/5 p-2 shadow-[0_40px_120px_rgba(0,0,0,0.4)]",
        className
      )}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, scale: tilt.scale }}
      onMouseMove={tilt.handleMove}
      onMouseLeave={tilt.handleLeave}
    >
      <div className="relative h-[420px] w-full overflow-hidden rounded-[28px]">
        <Image src={event.image} alt={event.title} fill priority className="object-cover" />
        <span
          className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 hover:opacity-60"
          style={{ background: gradients.aurora }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 p-6">
          {event.category && <span className="text-xs uppercase tracking-[0.4em] text-white/70">{event.category}</span>}
          <h3 className="text-2xl font-heading uppercase tracking-[0.2em]">{event.title}</h3>
        </div>
      </div>
    </motion.div>
  );
}
