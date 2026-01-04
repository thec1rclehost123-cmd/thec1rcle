import { useCallback } from "react";
import { useMotionValue, useSpring, type MotionValue } from "framer-motion";

export interface UseParallaxTiltOptions {
  intensity?: number;
  scale?: number;
}

export const useParallaxTilt = ({ intensity = 12, scale = 1.02 }: UseParallaxTiltOptions = {}) => {
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const handleMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const midX = bounds.width / 2;
      const midY = bounds.height / 2;

      rotateX.set(((y - midY) / midY) * -intensity);
      rotateY.set(((x - midX) / midX) * intensity);
    },
    [intensity, rotateX, rotateY]
  );

  const reset = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const animatedRotateX = useSpring(rotateX, { stiffness: 150, damping: 12 });
  const animatedRotateY = useSpring(rotateY, { stiffness: 150, damping: 12 });

  return {
    rotateX: animatedRotateX as MotionValue<number>,
    rotateY: animatedRotateY as MotionValue<number>,
    scale,
    handleMove,
    handleLeave: reset,
  };
};

export default useParallaxTilt;
