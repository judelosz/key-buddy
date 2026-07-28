import { useEffect, useMemo, useState } from 'react';
import { prefersReducedMotion } from '@/ui/hooks/useCountUp';

/**
 * The "loud-once" celebration tier (design system §4a): a single full-screen
 * confetti burst reserved for tier gates. Warm moments use chip pop/shimmer;
 * ordinary passes stay quiet. Renders nothing under reduced motion, and
 * removes itself after one pass — celebration, never wallpaper.
 */
export function Celebration({ show }: { show: boolean }) {
  const [alive, setAlive] = useState(false);

  useEffect(() => {
    if (!show || prefersReducedMotion()) return;
    setAlive(true);
    const t = window.setTimeout(() => setAlive(false), 2600);
    return () => window.clearTimeout(t);
  }, [show]);

  // Deterministic-ish scatter, computed once per mount.
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: (i * 37 + 11) % 100,
        delay: ((i * 53) % 40) / 50, // 0–0.8 s
        duration: 1.6 + ((i * 29) % 10) / 10, // 1.6–2.5 s
        size: 7 + ((i * 13) % 8),
        rotate: (i * 47) % 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );

  if (!alive) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-4%] block animate-confetti rounded-[3px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Parlor Pastel accents at full saturation — the one place they get loud. */
const CONFETTI_COLORS = ['#F4A9B8', '#F6D08A', '#A9DBC4', '#B7C0F0', '#C79445', '#7681CE'];
