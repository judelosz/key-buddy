import type { LessonMode } from '@/core/curriculum/types';

export const MODE_LABELS: Record<LessonMode, string> = {
  guided: 'Guided',
  supported: 'Supported',
  independent: 'Independent',
  performance: 'Checkpoint',
  scouting: 'Boss Challenge',
  woodshed: 'Woodshed',
};

const MODE_STYLES: Record<LessonMode, string> = {
  guided: 'bg-sand text-ink-soft',
  supported: 'bg-sand text-ink-soft',
  independent: 'bg-ink text-paper',
  performance: 'bg-rose-soft text-rose-ink ring-1 ring-rose-deep/30',
  scouting: 'bg-peri-soft text-peri-ink',
  woodshed: 'bg-peri-soft text-peri-ink',
};

export function ModeChip({ mode }: { mode: LessonMode }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 font-display text-xs font-semibold ${MODE_STYLES[mode]}`}
    >
      {MODE_LABELS[mode]}
    </span>
  );
}
