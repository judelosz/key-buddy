import type { TierGateStatus } from '@/core/curriculum/tierGate';

/**
 * The five real level-gate requirements as ring segments. Replaces the old
 * single-fill LevelMeter: that ring showed only the Hands-XP band and needed a
 * visual "cap" so a full circle never promised a level-up XP can't deliver.
 * This ring IS the gate — full ring ⇔ the level-up actually fires — and the
 * theory/ear checkpoint segment is where Head work visibly counts.
 */
export interface GateRingSegments {
  /** Hands-XP band progress, 0–1 (continuous). */
  xpFraction: number;
  /** Core skills Hands-mastered, 0–1 (fractional). */
  coreSkillsFraction: number;
  bossPassed: boolean;
  /** The theory/ear checkpoint — the Head-driven segment. */
  checkpointPassed: boolean;
  /** Absent on momentum-schedule tiers (1–3): no spaced evidence required,
   * so the ring honestly renders four segments instead of five. */
  delayedReviewPassed?: boolean;
}

/** Derive the ring model from the store's gate status (null = all gates passed). */
export function gateRingSegments(status: TierGateStatus | null): GateRingSegments | null {
  if (!status) return null;
  return {
    xpFraction: Math.min(1, status.handsXp.current / Math.max(1, status.handsXp.band)),
    coreSkillsFraction:
      status.coreSkills.length === 0
        ? 1
        : status.coreSkills.filter((s) => s.mastered).length / status.coreSkills.length,
    bossPassed: status.bossPassed,
    checkpointPassed: status.checkpoints.length > 0 && status.checkpoints.every((c) => c.passed),
    ...(status.delayedReviewRequired ? { delayedReviewPassed: status.delayedReviewPassed } : {}),
  };
}

interface GateRingProps {
  level: number;
  /** null ⇒ every authored gate is passed — the ring renders full in mint. */
  segments: GateRingSegments | null;
  size?: number;
}

/** The XP band fills continuously and gets the biggest arc; the evidence
 * items split the rest equally (works for 4- and 5-segment gates). */
const XP_ARC_SHARE = 0.4;
/** Gap between segments, as a fraction of the full circle. */
const GAP = 0.015;

export function GateRing({ level, segments, size = 48 }: GateRingProps) {
  const stroke = Math.max(3, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const fills = segments
    ? [
        { fraction: segments.xpFraction, head: false, title: 'Practice XP band' },
        { fraction: segments.coreSkillsFraction, head: false, title: 'Core skills mastered' },
        { fraction: segments.bossPassed ? 1 : 0, head: false, title: 'Boss song mastery star' },
        { fraction: segments.checkpointPassed ? 1 : 0, head: true, title: 'Theory & ear checkpoint' },
        ...(segments.delayedReviewPassed !== undefined
          ? [{ fraction: segments.delayedReviewPassed ? 1 : 0, head: false, title: 'Delayed review' }]
          : []),
      ]
    : null;
  const doneCount = fills ? fills.filter((f) => f.fraction >= 1).length : (fills?.length ?? 5);

  // Each segment: a sand track arc plus a fill arc from the segment's start.
  let cursor = 0;
  const arcs =
    fills?.map((f, i) => {
      const share = i === 0 ? XP_ARC_SHARE : (1 - XP_ARC_SHARE) / (fills.length - 1);
      const span = Math.max(0, share - GAP);
      const start = cursor + GAP / 2;
      cursor += share;
      return { ...f, start, span };
    }) ?? [];

  const arc = (start: number, span: number) => ({
    strokeDasharray: `${span * c} ${c}`,
    strokeDashoffset: -(start * c),
  });

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Level ${level} — ${doneCount} of ${fills?.length ?? 5} gate requirements complete`}
      title={
        segments
          ? `Level ${level} — the ring is the level gate: XP band · core skills · boss star · theory/ear checkpoint · delayed review`
          : `Level ${level} — every authored gate passed`
      }
    >
      <svg width={size} height={size} className="-rotate-90">
        {segments === null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-mint-deep"
          />
        ) : (
          <>
            {arcs.map((a, i) => (
              <circle
                key={`track-${i}`}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={stroke}
                className="stroke-sand"
                style={arc(a.start, a.span)}
              />
            ))}
            {arcs
              .filter((a) => a.fraction > 0)
              .map((a, i) => (
                <circle
                  key={`fill-${i}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  className={`transition-[stroke-dasharray] duration-700 ${
                    a.head ? 'stroke-peri-deep' : 'stroke-amber-deep'
                  }`}
                  style={arc(a.start, a.span * Math.min(1, a.fraction))}
                />
              ))}
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-display font-semibold tabular-nums text-ink"
          style={{ fontSize: size * 0.34 }}
        >
          {level}
        </span>
        <span className="text-ink-soft" style={{ fontSize: Math.max(7, size * 0.15) }}>
          LVL
        </span>
      </div>
    </div>
  );
}
