"use client";

import { memo } from "react";
import { EventCard as SharedEventCard } from "@c1rcle/ui";
import { motion } from "framer-motion";

/**
 * Guest Portal wrapper for the shared EventCard.
 * Adds index-based entrance animations.
 */
function EventCard({ event, index = 0, height = "h-[320px] sm:h-[340px] md:h-[420px]" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.04, 0.24), // max 240ms total stagger, never 2+ seconds
        ease: [0.16, 1, 0.3, 1]
      }}
      className="h-full"
    >
      <SharedEventCard
        event={event}
        index={index}
        height={height}
      />
    </motion.div>
  );
}

export default memo(EventCard);
