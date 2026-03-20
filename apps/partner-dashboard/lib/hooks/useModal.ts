import { useCallback, useState } from "react";

export const useModal = (initial = false) => {
  const [isOpen, setIsOpen] = useState(initial);
  const [stackDepth, setStackDepth] = useState(0);

  const open = useCallback(() => {
    setIsOpen(true);
    setStackDepth((depth) => depth + 1);
  }, []);

  const close = useCallback(() => {
    setStackDepth((depth) => Math.max(0, depth - 1));
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      setStackDepth((depth) => (next ? depth + 1 : Math.max(0, depth - 1)));
      return next;
    });
  }, []);

  return { isOpen, stackDepth, open, close, toggle };
};

export default useModal;
