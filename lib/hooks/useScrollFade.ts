import { useAnimation, useInView } from "framer-motion";
import { useEffect, useRef } from "react";

interface UseScrollFadeOptions {
  amount?: number;
  once?: boolean;
  delay?: number;
  margin?: string;
}

export const useScrollFade = ({ amount = 0.25, once = true, delay = 0, margin = "0px 0px -10% 0px" }: UseScrollFadeOptions = {}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const controls = useAnimation();
  const inView = useInView(ref, { amount, once, margin: margin as any });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    } else if (!once) {
      controls.start("hidden");
    }
  }, [controls, inView, once]);

  return { ref, controls, delay };
};

export default useScrollFade;
