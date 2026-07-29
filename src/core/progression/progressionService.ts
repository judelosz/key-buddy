/**
 * ProgressionService ★ — central home for the two-lock mastery model and the
 * skill-gated unlocks (build-spec §6.6, doc 04 §2, doc 03 §4.4).
 *
 * GUARDRAILS enforced here (see CLAUDE.md §4):
 *  - Hands lock opens ONLY from playing; Head lock ONLY from ear/theory work.
 *  - Keyboard EXERCISES can raise the Hands lock but are capped BELOW the
 *    mastery threshold — only an at-tempo, un-assisted performance take can
 *    Hands-master a skill.
 *  - A skill is GOLD only when BOTH locks pass threshold.
 *  - Playing tier derives ONLY from Hands mastery — never from Head/AFK progress.
 *  - Song unlocks require the required skills to be Hands-mastered (demonstrated
 *    playing skill), never currency or grind.
 *  - AFK preview ("Scouting") is capped at +1 tier above the playing tier.
 *
 * Pure functions over plain state so they are trivially unit-tested.
 */
import type { Attempt, Skill, SkillProgress, Song, Tier } from '@/core/types';
import type { ExerciseType, LessonMode, XpTrack } from '@/core/curriculum/types';

export const HANDS_THRESHOLD = 0.85;
export const HEAD_THRESHOLD = 0.85;
export const SCOUTING_LOOKAHEAD = 1; // +1 tier preview cap (doc 04 §3)

/**
 * Ceiling on what any exercise can do to the Hands lock — strictly below
 * HANDS_THRESHOLD, so drills alone can never Hands-master a skill.
 */
export const EXERCISE_HANDS_CAP = 0.8;

/**
 * A successful retrieval this long after the previous review of an already
 * functional skill counts as the tier gate's delayed-review evidence
 * (doc 07 gate step 5: "spaced evidence across separated sessions"). An
 * FSRS-due card passed also counts, whatever the gap.
 */
export const DELAYED_REVIEW_MIN_GAP_MS = 48 * 3_600_000;

/**
 * How much a playing attempt opens a skill's Hands lock. Only the mastery star
 * (3 stars, at target tempo, un-assisted) fully opens it — this is the
 * "mastery = at-tempo, un-assisted" guardrail made concrete.
 */
export function handsContribution(attempt: Attempt): number {
  if (attempt.masteryStar) return 1;
  if (attempt.stars === 3) return 0.8; // clean but slowed/assisted — not mastered
  if (attempt.stars === 2) return 0.6;
  if (attempt.stars === 1) return 0.4;
  return 0;
}

export function isHandsMastered(p: SkillProgress): boolean {
  return p.handsLock >= HANDS_THRESHOLD;
}
export function isHeadMastered(p: SkillProgress): boolean {
  return p.headLock >= HEAD_THRESHOLD;
}
export function isGold(p: SkillProgress): boolean {
  return isHandsMastered(p) && isHeadMastered(p);
}

/**
 * Apply a playing attempt to one skill's progress. Only touches the Hands lock.
 * Sets masteredAt when the skill first goes gold (needs Head lock too).
 */
export function applyPlayingAttempt(
  prev: SkillProgress,
  attempt: Attempt,
  nowMs: number,
): SkillProgress {
  const handsLock = Math.max(prev.handsLock, handsContribution(attempt));
  const next: SkillProgress = { ...prev, handsLock };
  if (!next.masteredAt && isGold(next)) next.masteredAt = nowMs;
  return next;
}

/**
 * Which XP track an exercise type feeds. HARD-CODED in core — never authored
 * in content — so a content file can't route ear/theory work into Hands
 * (guardrail #1). Keyboard exercises (you physically play) are Hands; ear,
 * theory, and listening are Head. AFK/woodshed variants re-route to Head in
 * Phase 6 by mode, not by editing this map.
 */
export function trackForExerciseType(t: ExerciseType): XpTrack {
  switch (t) {
    case 'play-chart':
    case 'fragment':
    case 'note-id':
    case 'build-chord':
    case 'rhythm-tap':
      return 'hands';
    default:
      return 'head';
  }
}

/**
 * How much a HEAD (ear/theory) result opens the Head lock. Only strong results
 * approach mastery; weak passes leave the lock visibly unfinished.
 */
export function headContribution(scorePct: number): number {
  if (scorePct >= 0.95) return 1;
  if (scorePct >= 0.85) return HEAD_THRESHOLD;
  if (scorePct >= 0.7) return 0.6;
  if (scorePct >= 0.5) return 0.35;
  return 0.15;
}

/** Apply an ear/theory result to one skill. Touches ONLY the Head lock. */
export function applyHeadAttempt(
  prev: SkillProgress,
  scorePct: number,
  nowMs: number,
): SkillProgress {
  const headLock = Math.max(prev.headLock, headContribution(scorePct));
  const next: SkillProgress = { ...prev, headLock };
  if (!next.masteredAt && isGold(next)) next.masteredAt = nowMs;
  return next;
}

/**
 * How much a KEYBOARD EXERCISE opens the Hands lock: mode-scaled and capped at
 * EXERCISE_HANDS_CAP (< HANDS_THRESHOLD). Scouting/woodshed exercises
 * contribute nothing — exploration is never mastery evidence.
 */
export function exerciseHandsContribution(scorePct: number, mode: LessonMode): number {
  const cap =
    mode === 'guided' ? 0.4
    : mode === 'supported' ? 0.6
    : mode === 'independent' || mode === 'performance' ? EXERCISE_HANDS_CAP
    : 0; // scouting / woodshed
  return cap * Math.min(Math.max(scorePct, 0), 1);
}

/** Apply a keyboard-exercise result to one skill. Touches ONLY the Hands lock. */
export function applyExerciseAttempt(
  prev: SkillProgress,
  scorePct: number,
  mode: LessonMode,
  nowMs: number,
): SkillProgress {
  const handsLock = Math.max(prev.handsLock, exerciseHandsContribution(scorePct, mode));
  const next: SkillProgress = { ...prev, handsLock };
  if (!next.masteredAt && isGold(next)) next.masteredAt = nowMs;
  return next;
}

/**
 * Playing tier = the highest tier among Hands-mastered skills (min 1). Reads
 * ONLY the Hands lock, so Head/AFK progress can never raise it.
 */
export function computePlayingTier(
  skills: readonly Skill[],
  progressById: ReadonlyMap<string, SkillProgress>,
): Tier {
  let tier = 1;
  for (const skill of skills) {
    const p = progressById.get(skill.id);
    if (p && isHandsMastered(p) && skill.tier > tier) tier = skill.tier;
  }
  return tier;
}

/** The Scouting preview ceiling — AFK may reach this tier but never gold it. */
export function scoutingTierCap(playingTier: Tier): Tier {
  return playingTier + SCOUTING_LOOKAHEAD;
}

function handsMasteredSet(progressById: ReadonlyMap<string, SkillProgress>): Set<string> {
  const set = new Set<string>();
  for (const [id, p] of progressById) if (isHandsMastered(p)) set.add(id);
  return set;
}

/**
 * A song is unlocked when every required skill is Hands-mastered — except
 * challenge songs, which unlock when the learning tier reaches their
 * challengeTier. Both paths are pure Hands evidence (tier gates are
 * hands-locked), so guardrail #3 holds either way.
 */
export function isSongUnlocked(
  song: Song,
  progressById: ReadonlyMap<string, SkillProgress>,
  learningTier: Tier,
): boolean {
  if (song.challengeTier !== undefined) return learningTier >= song.challengeTier;
  const mastered = handsMasteredSet(progressById);
  return song.requiredSkills.every((id) => mastered.has(id));
}

export interface UnlockProgress {
  songId: string;
  masteredCount: number;
  requiredCount: number;
  remainingSkillIds: string[];
  unlocked: boolean;
  /** Set for challenge songs — the level that unlocks them (no skill list). */
  challengeTier?: Tier;
}

/** Progress toward unlocking a song — powers the "N skills away" endowed bar. */
export function songUnlockProgress(
  song: Song,
  progressById: ReadonlyMap<string, SkillProgress>,
  learningTier: Tier,
): UnlockProgress {
  if (song.challengeTier !== undefined) {
    return {
      songId: song.id,
      masteredCount: 0,
      requiredCount: 0,
      remainingSkillIds: [],
      unlocked: learningTier >= song.challengeTier,
      challengeTier: song.challengeTier,
    };
  }
  const mastered = handsMasteredSet(progressById);
  const remaining = song.requiredSkills.filter((id) => !mastered.has(id));
  return {
    songId: song.id,
    masteredCount: song.requiredSkills.length - remaining.length,
    requiredCount: song.requiredSkills.length,
    remainingSkillIds: remaining,
    unlocked: remaining.length === 0,
  };
}

export function unlockedSongIds(
  songs: readonly Song[],
  progressById: ReadonlyMap<string, SkillProgress>,
  learningTier: Tier,
): Set<string> {
  return new Set(
    songs.filter((s) => isSongUnlocked(s, progressById, learningTier)).map((s) => s.id),
  );
}
