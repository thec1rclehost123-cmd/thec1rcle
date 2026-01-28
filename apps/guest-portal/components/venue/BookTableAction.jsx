"use client";

import { useState } from "react";
import { Play, Calendar } from "lucide-react";
import ReservationModal from "./ReservationModal";
import { AnimatePresence } from "framer-motion";

export default function BookTableAction({ venue, variant = "default" }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const buttonStyles = variant === "full"
        ? "w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl text-sm font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-[0_0_30px_rgba(99,102,241,0.2)]"
        : "px-6 py-2 bg-[#0A0A0A]/40 backdrop-blur-md border border-white/30 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-white hover:text-black transition-all";

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className={buttonStyles}
            >
                {variant === "full" ? (
                    <>
                        <Calendar className="h-4 w-4" />
                        Make a Reservation
                    </>
                ) : (
                    <>
                        <Play className="h-3 w-3 fill-current" /> Get Reservation
                    </>
                )}
            </button>

            <AnimatePresence>
                {isModalOpen && (
                    <ReservationModal
                        venue={venue}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
