import { useEffect, useRef, useState } from 'react';

/** Shared JS-side reduced-motion check — the CSS gate in index.css can't
 * reach rAF-driven motion (count-ups, canvas, celebration overlays). */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animate a number from 0 up to `target` with an ease-out curve. Used by the
 * reward chips and stat tiles for a bit of game-y juice. Jumps straight to the
 * target when the user prefers reduced motion.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || target === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic
      setValue(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
