'use client';

import clsx from 'clsx';
import { type ReactNode, useEffect, useRef, useState } from 'react';

interface SectionRevealProps {
  variant?:
    | 'fadeIn'
    | 'fadeInUp'
    | 'scaleIn'
    | 'slideInUp'
    | 'slideInLeft'
    | 'slideInRight'
    | 'slideInDown';
  delay?: number;
  once?: boolean;
  className?: string;
  children: ReactNode;
}

export default function SectionReveal({
  children,
  className,
  variant = 'fadeInUp',
  delay = 0,
  once = true,
}: SectionRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once && ref.current) observer.unobserve(ref.current);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      },
    );

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, [once]);

  const delayStyle = delay ? { transitionDelay: `${delay}s` } : {};

  return (
    <div
      ref={ref}
      style={delayStyle}
      className={clsx(
        'relative will-change-[transform,opacity] transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        {
          'opacity-0': !isVisible,
          'opacity-100': isVisible,
          'translate-y-8': !isVisible && variant === 'fadeInUp',
          'translate-y-0':
            isVisible &&
            (variant === 'fadeInUp' || variant === 'slideInUp' || variant === 'slideInDown'),
          'scale-95': !isVisible && variant === 'scaleIn',
          'scale-100': isVisible && variant === 'scaleIn',
          '-translate-y-12': !isVisible && variant === 'slideInUp',
          'translate-y-12': !isVisible && variant === 'slideInDown',
          '-translate-x-12': !isVisible && variant === 'slideInLeft',
          'translate-x-12': !isVisible && variant === 'slideInRight',
          'translate-x-0': isVisible && (variant === 'slideInLeft' || variant === 'slideInRight'),
        },
        className,
      )}
    >
      {children}
    </div>
  );
}
