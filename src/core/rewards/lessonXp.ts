/**
 * Lesson XP (doc 07 §2.1): guided first-completion 5 · supported pass 10 ·
 * independent checkpoint 20 · performance 30 · due-review 12 · remediation 15
 * (only when it addresses a RECORDED weakness) · changed-context transfer 20 ·
 * stretch-boss/scouting exploration 8 — scaled by difficulty × freshness ×
 * performance quality with hard same-day diminishing returns. Failing pays
 * nothing; repeating pays almost nothing. Song-qualifying (25) and delayed
 * song review (30) live in the chart reducer via songMasteryDelta.
 */
import type { FsrsState, PlayerState, Tier } from '@/core/types';
import type { CurriculumLesson, LessonMode, XpTrack } from '@/core/curriculum/types';
import { trackForExerciseType } from '@/core/progression/progressionService';
import { difficultyMultiplier, freshnessMultiplier } from './rewardService';

export const LESSON_BASE_XP: Record<LessonMode, number> = {
  guided: 5,
  supported: 10,
  independent: 20,
  performance: 30,
  scouting: 8, // stretch Boss Challenges: exploration signal, doc 07 "5–15"
  woodshed: 8, // AFK (Phase 6)
};

export const DUE_REVIEW_XP = 12;
export const REMEDIATION_XP = 15;
export const TRANSFER_XP = 20;
export const SONG_QUALIFYING_XP = 25;
export const DELAYED_SONG_REVIEW_XP = 30;
/** One song's Hands XP may fill at most this share of a tier's band. */
export const SONG_TIER_XP_CAP_PCT = 0.5;

/** Session purposes that carry their own XP row (see SessionSegment.purpose). */
export type XpPurpose = 'remediation' | 'transfer-reentry';

/**
 * Same-day repetition decay: first meaningful result pays fully, the second
 * 30%, the third 10%, anything after that nothing. `attemptsBeforeToday` is
 * how many attempts already happened today before this one.
 */
export function repeatFactor(attemptsTodayBefore: number): number {
  return [1, 0.3, 0.1][attemptsTodayBefore] ?? 0;
}

export interface LessonXpContext {
  passed: boolean;
  scorePct: number;
  firstCompletion: boolean;
  /** Attempts already made on this lesson today, before this one. */
  attemptsTodayBefore: number;
  /** True when any of the lesson's skills was due for review. */
  wasDue: boolean;
  /** Freshness of the lesson's skills (pre-result). */
  freshness: FsrsState[];
  tier: Tier;
  nowMs: number;
  /** Why the session queued this run (session segments only). */
  purpose?: XpPurpose;
  /** Remediation pays only when the caller PROVES a recorded weakness
   * (recent failure / weak section) — no farming by relabeling. */
  addressedRecordedWeakness?: boolean;
}

export function xpForLessonResult(
  lesson: CurriculumLesson,
  ctx: LessonXpContext,
): { xp: number; track: XpTrack } {
  const track = trackForExerciseType(lesson.exerciseType);
  if (!ctx.passed) return { xp: 0, track };
  // Guided lessons are worth XP once — they're introduction, not practice.
  if (lesson.mode === 'guided' && !ctx.firstCompletion) return { xp: 0, track };

  let base = LESSON_BASE_XP[lesson.mode];
  if (ctx.wasDue) base = Math.max(base, DUE_REVIEW_XP);
  if (ctx.purpose === 'remediation' && ctx.addressedRecordedWeakness) {
    base = Math.max(base, REMEDIATION_XP);
  }
  if (ctx.purpose === 'transfer-reentry') base = Math.max(base, TRANSFER_XP);

  const fresh =
    ctx.freshness.length === 0
      ? 1
      : ctx.freshness.reduce((s, f) => s + freshnessMultiplier(f, ctx.nowMs), 0) /
        ctx.freshness.length;
  const performance = 0.5 + 0.5 * Math.min(Math.max(ctx.scorePct, 0), 1);
  const xp = base * difficultyMultiplier(ctx.tier) * fresh * performance * repeatFactor(ctx.attemptsTodayBefore);
  return { xp: Math.round(xp), track };
}

/**
 * Head XP accumulates on its own track ONLY — it never touches totalXP,
 * tierHandsXP, playerLevel, or any tier field (guardrail #1).
 */
export function awardHeadXp(state: PlayerState, xp: number): PlayerState {
  return { ...state, headTrackXP: state.headTrackXP + Math.max(0, xp) };
}
