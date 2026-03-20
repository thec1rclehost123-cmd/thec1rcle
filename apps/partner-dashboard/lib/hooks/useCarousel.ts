import { useCallback, useEffect, useRef, useState } from "react";

interface UseCarouselOptions {
  total: number;
  autoplay?: boolean;
  interval?: number;
  loop?: boolean;
}

export const useCarousel = ({ total, autoplay = true, interval = 6000, loop = true }: UseCarouselOptions) => {
  const [index, setIndex] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const goTo = useCallback(
    (nextIndex: number) => {
      setIndex((prev) => {
        if (!loop) {
          return Math.max(0, Math.min(total - 1, nextIndex));
        }
        if (nextIndex < 0) {
          return total - 1;
        }
        if (nextIndex >= total) {
          return 0;
        }
        return nextIndex;
      });
    },
    [loop, total]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (!autoplay || total <= 1) {
      return;
    }
    if (timer.current) {
      clear();
    }
    timer.current = setInterval(() => {
      setIndex((prev) => {
        const nextIndex = prev + 1;
        if (!loop && nextIndex >= total) {
          return prev;
        }
        return nextIndex % total;
      });
    }, interval);

    return () => clear();
  }, [autoplay, interval, loop, total, clear]);

  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;
    return () => clear();
  }, [clear]);

  return { index, goTo, next, prev, pause: clear };
};

export default useCarousel;
