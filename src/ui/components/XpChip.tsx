import { Brain, Hand } from 'lucide-react';
import { useCountUp } from '@/ui/hooks/useCountUp';

interface XpChipProps {
  xp: number;
  track: 'hands' | 'head';
  /** Compact = session result density; default = result-screen density. */
  size?: 'md' | 'sm';
}

/**
 * The one XP reward chip (lesson result, session result, session wrap).
 * Keeps "+N XP" in a single text node — e2e specs match /\+\d+ XP/.
 */
export function XpChip({ xp, track, size = 'md' }: XpChipProps) {
  const value = useCountUp(xp);
  const pad = size === 'md' ? 'px-5 py-2.5' : 'px-5 py-2';
  return (
    <div className={`flex items-center gap-2 rounded-full bg-surface shadow-soft ${pad}`}>
      {track === 'hands' ? (
        <Hand size={16} className="text-amber-ink" />
      ) : (
        <Brain size={16} className="text-peri-ink" />
      )}
      <span className="font-display text-lg font-semibold tabular-nums text-ink">
        +{value} XP
      </span>
      <span className="text-xs text-ink-soft">{track === 'hands' ? 'Hands' : 'Head'}</span>
    </div>
  );
}
