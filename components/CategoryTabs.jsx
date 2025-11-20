"use client";

import clsx from "clsx";
import { motion } from "framer-motion";

export default function CategoryTabs({ tabs = [], active, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {tabs.map((tab) => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={clsx(
              "relative rounded-full px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
              isActive ? "text-black" : "text-white/60 hover:text-white"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-full bg-white shadow-glow"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{tab}</span>
            {!isActive && (
              <div className="absolute inset-0 rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10" />
            )}
          </button>
        );
      })}
    </div>
  );
}
