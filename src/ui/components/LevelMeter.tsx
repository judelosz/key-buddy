interface LevelMeterProps {
  level: number;
  /** 0–1 progress toward the next level band. */
  fraction: number;
  /** Outer diameter in px. */
  size?: number;
  /** True when XP alone won't advance the level (mastery gates remain). */
  gatesRemaining?: boolean;
}

/**
 * Circular level/tier meter. The ring shows XP progress within the current
 * tier band; when gates remain, the ring is visually capped so a full-looking
 * circle never promises a level-up that grinding can't deliver.
 */
export function LevelMeter({ level, fraction, size = 48, gatesRemaining = false }: LevelMeterProps) {
  const stroke = Math.max(3, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.min(Math.max(fraction, 0), gatesRemaining ? 0.92 : 1);
  const dash = c * shown;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Level ${level}, ${Math.round(fraction * 100)}% toward the next level`}
      title={
        gatesRemaining
          ? `Level ${level} — XP is filling, but advancement also needs the mastery gates`
          : `Level ${level}`
      }
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-sand"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="stroke-amber-deep transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display font-semibold tabular-nums text-ink" style={{ fontSize: size * 0.34 }}>
          {level}
        </span>
        <span className="text-ink-soft" style={{ fontSize: Math.max(7, size * 0.15) }}>
          LVL
        </span>
      </div>
    </div>
  );
}
