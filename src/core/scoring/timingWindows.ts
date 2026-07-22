/**
 * Tier-dependent timing windows (doc 03 §3.2). Windows tighten as the player
 * improves — this is both the scoring standard and part of the flow engine
 * (stricter = harder). Values are ± milliseconds around the target onset.
 *
 *   Grade    | Beginner (tier 1) | Advanced (tier 30)
 *   Perfect  | ±60 ms            | ±25 ms
 *   Great    | ±110 ms           | ±55 ms
 *   Good     | ±180 ms           | ±100 ms
 *
 * Between tiers we linearly interpolate. Beyond the Good window (but within the
 * match window) a note is Early/Late; beyond the match window it is a Miss.
 */
import type { Tier } from '@/core/types';

export interface TimingWindows {
  perfect: number;
  great: number;
  good: number;
}

const BEGINNER: TimingWindows = { perfect: 60, great: 110, good: 180 };
const ADVANCED: TimingWindows = { perfect: 25, great: 55, good: 100 };

const MIN_TIER = 1;
const MAX_TIER = 30;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function windowsForTier(tier: Tier): TimingWindows {
  const t = clamp((tier - MIN_TIER) / (MAX_TIER - MIN_TIER), 0, 1);
  return {
    perfect: lerp(BEGINNER.perfect, ADVANCED.perfect, t),
    great: lerp(BEGINNER.great, ADVANCED.great, t),
    good: lerp(BEGINNER.good, ADVANCED.good, t),
  };
}

/**
 * How far from the target onset a played note can be and still be considered
 * an attempt at THIS note (Early/Late) rather than a Miss. Generous but capped
 * at roughly a beat so a note played a beat away doesn't get credited.
 */
export function matchWindowMs(windows: TimingWindows, beatMs: number): number {
  return Math.min(beatMs, windows.good * 3);
}
