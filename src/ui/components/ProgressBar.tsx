interface ProgressBarProps {
  /** 0–1. At exactly zero the bar hides (an empty track reads as broken). */
  fraction: number;
  className?: string;
}

/** The shared unlock/progress bar (Free Play cards, Progress next-unlocks). */
export function ProgressBar({ fraction, className = '' }: ProgressBarProps) {
  if (fraction <= 0) return null;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-sand ${className}`}>
      <div
        className="h-full rounded-full bg-mint-deep/70 transition-[width] duration-700"
        style={{ width: `${Math.round(Math.min(1, fraction) * 100)}%` }}
      />
    </div>
  );
}
