"use client";

import { useEffect, useRef } from "react";

type Direction = "up" | "fade" | "scale";

interface FadeInSectionProps {
  children: React.ReactNode;
  /** Delay in ms before the transition starts (for stagger effects). */
  delay?: number;
  /** Animation style. Default: "up" (fade + slide up). */
  direction?: Direction;
  className?: string;
}

const directionClass: Record<Direction, string> = {
  up:    "reveal",
  fade:  "reveal-fade",
  scale: "reveal-scale",
};

/**
 * Wraps children in a div that animates into view when it enters the
 * viewport (IntersectionObserver → adds .is-visible).
 * CSS lives in globals.css.
 */
export function FadeInSection({
  children,
  delay = 0,
  direction = "up",
  className = "",
}: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) el.style.transitionDelay = `${delay}ms`;
          el.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const base = directionClass[direction];

  return (
    <div ref={ref} className={`${base} ${className}`}>
      {children}
    </div>
  );
}
