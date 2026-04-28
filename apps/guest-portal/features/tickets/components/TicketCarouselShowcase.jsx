"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export function TicketCarouselShowcase({ tickets }) {
  const [activeIndex, setActiveIndex] = useState(2);

  return (
    <div className="relative w-full h-[500px] flex flex-col items-center justify-center perspective-1000">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative h-[450px] w-full flex justify-center items-center">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none"
          animate={{
            backgroundColor: tickets[activeIndex]?.type === "VIP" ? "rgba(255, 165, 0, 0.5)" : "rgba(255, 255, 255, 0.2)",
            scale: [1, 1.3],
            opacity: [0.15, 0.45],
          }}
          transition={{
            scale: { duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
            opacity: { duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
            backgroundColor: { duration: 1 },
          }}
        />

        <AnimatePresence>
          {tickets.map((ticket, index) => {
            const offset = index - activeIndex;
            const isActive = index === activeIndex;

            return (
              <motion.div
                key={ticket.id}
                layout
                onClick={() => setActiveIndex(index)}
                className={clsx(
                  "absolute w-[260px] h-[420px] rounded-[32px] cursor-pointer flex flex-col justify-between p-6 overflow-hidden",
                  "bg-gradient-to-br border shadow-2xl backdrop-blur-md",
                  isActive ? "border-white/20 z-50" : "border-white/5",
                  ticket.color.includes("from-") ? ticket.color : "bg-zinc-900",
                )}
                style={{
                  boxShadow: isActive
                    ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                    : "0 10px 30px -10px rgba(0, 0, 0, 0.8)",
                }}
                initial={false}
                animate={{
                  x: offset * 140,
                  y: Math.abs(offset) * 40 + (isActive ? 0 : 20),
                  scale: 1 - Math.abs(offset) * 0.1,
                  rotateZ: offset * 12,
                  rotateY: offset * -15,
                  zIndex: 100 - Math.abs(offset),
                  opacity: Math.abs(offset) > 2.5 ? 0 : 1,
                }}
                whileHover={{
                  scale: isActive ? 1.05 : 1 - Math.abs(offset) * 0.1 + 0.05,
                  rotateY: offset * -5,
                  y: isActive ? -15 : Math.abs(offset) * 40,
                }}
              >
                <motion.div
                  className="absolute inset-x-0 top-0 h-[200%] w-[100%] bg-gradient-to-b from-transparent via-white/5 to-transparent -skew-y-12 pointer-events-none"
                  animate={{ y: ["-100%", "100%"] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.4,
                  }}
                />

                {isActive ? (
                  <motion.div
                    className="absolute inset-0 rounded-[32px] border-2 border-orange/40 pointer-events-none"
                    animate={{
                      opacity: [0.2, 0.5, 0.2],
                      scale: [1, 1.015, 1],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                  />
                ) : null}

                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                {[0, 1, 2].map((sparkleIndex) => (
                  <motion.div
                    key={sparkleIndex}
                    className="absolute w-1 h-1 bg-white/20 rounded-full"
                    animate={{
                      y: [0, -40, 0],
                      x: [0, (sparkleIndex - 1) * 20, 0],
                      opacity: [0, 0.5, 0],
                      scale: [0, 1.5, 0],
                    }}
                    transition={{
                      duration: 3 + sparkleIndex,
                      repeat: Infinity,
                      delay: sparkleIndex,
                      ease: "easeInOut",
                    }}
                    style={{
                      left: `${20 + sparkleIndex * 30}%`,
                      top: `${40 + sparkleIndex * 20}%`,
                    }}
                  />
                ))}

                <div className="relative flex justify-between items-start">
                  <div className={clsx(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                    isActive ? "bg-white/10 border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]" : "bg-white/5 border border-white/5",
                  )}>
                    <ticket.icon className={clsx(
                      "w-6 h-6 transition-all duration-500",
                      isActive ? (ticket.type === "VIP" ? "text-orange animate-pulse" : "text-white") : "text-white/20",
                    )} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold tracking-[0.2em] text-white/40">THE C1RCLE</span>
                    <div className="h-0.5 w-8 bg-white/20 mt-1" />
                  </div>
                </div>

                <div className="relative">
                  <div className="text-3xl font-black text-white">{ticket.title}</div>
                  <div className="mt-2 text-lg font-bold text-white">{ticket.price}</div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
