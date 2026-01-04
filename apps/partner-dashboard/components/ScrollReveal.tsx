"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const variants = {
    hidden: { opacity: 0, y: 20, filter: "blur(10px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export default function ScrollReveal({ children, className = "", delay = 0 }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={variants}
            transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9], delay }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
