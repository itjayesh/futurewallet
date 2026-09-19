"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Ease used across the app: quick start, soft landing. */
const EASE = [0.16, 1, 0.3, 1] as const;

/** Numbers that count up (and re-count when the value changes). Static under reduced motion. */
export function CountUp({ value, format, duration = 0.9, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = format(v);
      },
      onComplete: () => {
        from.current = value;
      },
    });
    return () => {
      controls.stop();
      from.current = value;
    };
    // `format` is expected to be a stable module-level function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, duration]);

  return (
    <span ref={ref} className={className}>
      {format(reduce ? value : 0)}
    </span>
  );
}

/** Fades and lifts children in, one after another. `index` sets the order. */
export function Reveal({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Writes text out a few characters at a time. Give it `key={text}` so it restarts when the text changes. Shows it all at once under reduced motion. */
export function Typewriter({ text, className, charsPerSecond = 90 }: { text: string; className?: string; charsPerSecond?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.min(text.length, Math.floor(((now - start) / 1000) * charsPerSecond));
      setShown(n);
      if (n < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, reduce, charsPerSecond]);

  const visible = reduce ? text.length : shown;
  return (
    <p className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, visible)}</span>
      {visible < text.length ? <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-future" /> : null}
    </p>
  );
}

/** Fades screens in when the route changes. */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div key={routeKey} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE }} className="space-y-6">
      {children}
    </motion.div>
  );
}

export { motion, useReducedMotion };

/** Fades and lifts children in the first time they scroll into view. */
export function InView({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** A panel that pops in when it appears (a result, a confirmation, a message). */
export function Pop({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease: EASE }}>
      {children}
    </motion.div>
  );
}

export { AnimatePresence } from "motion/react";
