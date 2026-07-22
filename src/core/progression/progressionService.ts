/**
 * ProgressionService ★ — central home for the two-lock mastery model and the
 * skill-gated unlocks (build-spec §6.6, doc 04 §2, doc 03 §4.4).
 *
 * GUARDRAILS enforced here (see CLAUDE.md §4):
 *  - Hands lock opens ONLY from playing attempts; Head lock ONLY from AFK.
 *  - A skill is GOLD only when BOTH locks pass threshold.
 *  - Playing tier derives ONLY from Hands mastery — never from Head/AFK progress.
 *  - Song unlocks require the required skills to be Hands-mastered (demonstrated
 *    playing skill), never currency or grind.
 *  - Hands mastery requires the at-tempo, un-assisted mastery star.
 *  - AFK preview ("Scouting") is capped at +1 tier above the playing tier.
 *
 * Pure functions over plain state so they are trivially unit-tested.
 */
import type { Attempt, Skill, SkillProgress, Song, Tier } from '@/core/types';

export const HANDS_THRESHOLD = 0.85;
export const HEAD_THRESHOLD = 0.85;
export const SCOUTING_LOOKAHEAD = 1; // +1 tier preview cap (doc 04 §3)

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

/** A song is unlocked when every required skill is Hands-mastered. */
export function isSongUnlocked(
  song: Song,
  progressById: ReadonlyMap<string, SkillProgress>,
): boolean {
  const mastered = handsMasteredSet(progressById);
  return song.requiredSkills.every((id) => mastered.has(id));
}

export interface UnlockProgress {
  songId: string;
  masteredCount: number;
  requiredCount: number;
  remainingSkillIds: string[];
  unlocked: boolean;
}

/** Progress toward unlocking a song — powers the "N skills away" endowed bar. */
export function songUnlockProgress(
  song: Song,
  progressById: ReadonlyMap<string, SkillProgress>,
): UnlockProgress {
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
): Set<string> {
  return new Set(songs.filter((s) => isSongUnlocked(s, progressById)).map((s) => s.id));
}
