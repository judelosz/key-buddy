const TONES = {
  mint: 'bg-mint-deep/70',
  amber: 'bg-amber-deep',
  peri: 'bg-peri-deep',
} as const;

interface ProgressBarProps {
  /** 0–1. At exactly zero the bar hides (an empty track reads as broken)
   * unless `showEmpty` keeps the track visible (labeled meters). */
  fraction: number;
  tone?: keyof typeof TONES;
  showEmpty?: boolean;
  className?: string;
}

/** The shared unlock/progress bar (Free Play cards, Progress meters). */
export function ProgressBar({
  fraction,
  tone = 'mint',
  showEmpty = false,
  className = '',
}: ProgressBarProps) {
  if (fraction <= 0 && !showEmpty) return null;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-sand ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-700 ${TONES[tone]}`}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }}
      />
    </div>
  );
}
