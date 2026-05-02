"use client";

import { useEffect, useRef } from "react";

interface FadeInSectionProps {
  children: React.ReactNode;
  delay?: number;   // ms
  className?: string;
}

/**
 * Wraps children in a div that fades + slides up into view when it
 * enters the viewport (IntersectionObserver → adds .is-visible).
 * The .reveal / .is-visible CSS lives in globals.css.
 */
export function FadeInSection({ children, delay = 0, className = "" }: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
