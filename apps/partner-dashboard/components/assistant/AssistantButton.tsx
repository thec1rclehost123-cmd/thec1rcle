"use client";

/**
 * AssistantButton — Floating trigger for the Dashboard Intelligence panel.
 *
 * Design:
 *   - Fixed position, bottom-right corner
 *   - Small, unobtrusive — does not compete with main content
 *   - Quiet animation on first render
 *   - No pulsing rings, no notification badges, no decorative chrome
 *   - Sits above mobile bottom nav (z-index aware)
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { AssistantPanel } from "./AssistantPanel";

export function AssistantButton() {
    const [panelOpen, setPanelOpen] = useState(false);

    return (
        <>
            {/* Floating button */}
            <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.2 }}
                onClick={() => setPanelOpen(true)}
                className={`
                    fixed bottom-6 right-5 z-[150]
                    w-10 h-10 rounded-full
                    bg-[var(--bg-secondary)] border border-[var(--border-subtle)]
                    flex items-center justify-center
                    shadow-lg shadow-black/20
                    hover:bg-[var(--bg-fill)] transition-all duration-200
                    ${panelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                `}
                aria-label="Open dashboard intelligence"
                title="Dashboard Intelligence"
            >
                <Sparkles className="w-4 h-4 text-[var(--text-secondary)]" />
            </motion.button>

            {/* Panel */}
            <AssistantPanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
            />
        </>
    );
}
