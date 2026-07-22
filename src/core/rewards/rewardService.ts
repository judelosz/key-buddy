/**
 * RewardService ★ — XP, Riffs, streaks, and the ethical variable-reward layer
 * (build-spec §6.7, doc 03 §4). Central home for the economy honesty guardrails:
 *
 *  #1  Player Level derives ONLY from playing (Hands) XP. `headTrackXP` is
 *      accumulated separately (awardHeadXp) and never feeds levelForXp.
 *  #2  Currency firewall: Riffs buy ONLY cosmetics/convenience. There is NO
 *      function that converts Riffs → stars/XP/unlocks (see RIFF_SINKS).
 *  #5  XP = difficulty × freshness × performance, so replaying easy mastered
 *      content pays almost nothing.
 *  #6  Variable "encore" bonuses trigger ONLY on good playing — never on mere
 *      completion, app-open, or payment.
 *
 * Pure functions; randomness is injected for deterministic tests.
 */
import type { Attempt, FsrsState, PlayerState, Song } from '@/core/types';
import { retrievability } from '@/core/srs/fsrs';

export const BASE_XP = 20;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Harder tiers pay more (doc 03 §4.1). */
export function difficultyMultiplier(tier: number): number {
  return 1 + (tier - 1) * 0.12;
}

/**
 * A decaying skill (low retrievability / due for review) is worth a large
 * multiplier; a freshly-mastered skill replayed is worth almost nothing. A
 * brand-new skill being learned is genuinely valuable.
 */
export function freshnessMultiplier(freshness: FsrsState, nowMs: number): number {
  if (freshness.state === 0) return 1.5; // New — learning new material
  const r = retrievability(freshness, nowMs);
  return clamp(0.15 + (1 - r) * 1.85, 0.15, 2);
}

export function performanceMultiplier(attempt: Attempt): number {
  if (attempt.masteryStar) return 1.3;
  return [0, 0.35, 0.7, 1][attempt.stars];
}

/** XP for a take, averaged over the freshness of the skills it exercises. */
export function xpForAttempt(
  song: Song,
  attempt: Attempt,
  taughtFreshness: FsrsState[],
  nowMs: number,
): number {
  const fresh =
    taughtFreshness.length === 0
      ? 1
      : taughtFreshness.reduce((s, f) => s + freshnessMultiplier(f, nowMs), 0) /
        taughtFreshness.length;
  const xp =
    BASE_XP * difficultyMultiplier(song.tier) * fresh * performanceMultiplier(attempt);
  return Math.round(xp);
}

/** Player Level from cumulative PLAYING XP only (never Head XP). */
export function levelForXp(playingXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, playingXp) / 50)) + 1;
}

const levelStartXp = (level: number): number => 50 * (level - 1) ** 2;

/** XP into the current level and the span to the next — for progress bars. */
export function levelForXpBounds(
  totalXp: number,
  level: number,
): { intoLevel: number; span: number } {
  const start = levelStartXp(level);
  const next = levelStartXp(level + 1);
  return { intoLevel: Math.max(0, totalXp - start), span: Math.max(1, next - start) };
}

// ─── Riffs (soft currency) ──────────────────────────────────────────────────

export const NEW_STAR_RIFFS = 10;
export const FIRST_3STAR_BONUS = 25;

/** Riffs reward IMPROVEMENT (a new star), not repetition. */
export function riffsForAttempt(attempt: Attempt, prevBestStars: number): number {
  let riffs = 0;
  if (attempt.stars > prevBestStars) riffs += NEW_STAR_RIFFS * attempt.stars;
  if (attempt.stars === 3 && prevBestStars < 3) riffs += FIRST_3STAR_BONUS;
  return riffs;
}

/**
 * The ONLY things Riffs can buy — cosmetics and convenience. There is
 * deliberately no 'stars' / 'xp' / 'unlock' sink. `spendRiffs` accepts only
 * these, so no code path can pay to skip getting good (guardrail #2).
 */
export const RIFF_SINKS = ['cosmetic', 'streak-freeze', 'hint', 'slow-down'] as const;
export type RiffSink = (typeof RIFF_SINKS)[number];

export function spendRiffs(
  wallet: Pick<PlayerState, 'riffs'>,
  cost: number,
  sink: RiffSink,
): { ok: boolean; riffs: number } {
  if (!RIFF_SINKS.includes(sink)) return { ok: false, riffs: wallet.riffs };
  if (cost < 0 || wallet.riffs < cost) return { ok: false, riffs: wallet.riffs };
  return { ok: true, riffs: wallet.riffs - cost };
}

// ─── Streaks (doc 03 §5) ────────────────────────────────────────────────────

const dayNumber = (iso: string): number => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

export interface StreakResult {
  streak: number;
  streakFreezes: number;
  lastSessionDate: string;
  usedFreeze: boolean;
}

/** Advance the streak for a session completed on `todayISO` (YYYY-MM-DD). */
export function updateStreak(state: PlayerState, todayISO: string): StreakResult {
  const base = {
    streak: state.streak,
    streakFreezes: state.streakFreezes,
    lastSessionDate: todayISO,
    usedFreeze: false,
  };
  if (!state.lastSessionDate) return { ...base, streak: 1 };
  if (state.lastSessionDate === todayISO) return { ...base, streak: state.streak };

  const diff = dayNumber(todayISO) - dayNumber(state.lastSessionDate);
  if (diff === 1) return { ...base, streak: state.streak + 1 };
  // Missed one or more days: a freeze saves the streak, else it resets.
  if (state.streakFreezes > 0) {
    return { ...base, streak: state.streak + 1, streakFreezes: state.streakFreezes - 1, usedFreeze: true };
  }
  return { ...base, streak: 1 };
}

// ─── Variable reward layer (ethical dopamine, doc 03 §4.5) ──────────────────

export const ENCORE_CHANCE = 0.25;
export const ENCORE_RIFFS = 15;

export interface EncoreResult {
  triggered: boolean;
  riffs: number;
}

/**
 * A surprise bonus that can fire ONLY on a good take (≥2 stars or mastery).
 * The trigger is always good playing; only whether it fires is uncertain.
 * `rand` is injected (0–1) so tests are deterministic.
 */
export function rollEncoreBonus(attempt: Attempt, rand: number): EncoreResult {
  const goodPlaying = attempt.masteryStar || attempt.stars >= 2;
  if (!goodPlaying) return { triggered: false, riffs: 0 };
  if (rand < ENCORE_CHANCE) return { triggered: true, riffs: ENCORE_RIFFS };
  return { triggered: false, riffs: 0 };
}
