/**
 * recordChartAttempt — the pure reducer that turns a completed playing Attempt
 * into progression + reward + spaced-review updates. It composes the guardrail
 * services (Progression ★, Reward ★, FSRS) so all the honesty rules apply in one
 * place; the store just persists the result. Pure and unit-tested.
 */
import type {
  Attempt,
  PlayerState,
  Skill,
  SkillProgress,
  Song,
} from '@/core/types';
import {
  applyPlayingAttempt,
  computePlayingTier,
  unlockedSongIds,
} from '@/core/progression/progressionService';
import {
  levelForXp,
  riffsForAttempt,
  rollEncoreBonus,
  updateStreak,
  xpForAttempt,
} from '@/core/rewards/rewardService';
import { newCard, reviewCard, starsToRating } from '@/core/srs/fsrs';

export interface RecordAttemptInput {
  song: Song;
  attempt: Attempt;
  playerState: PlayerState;
  skillProgressById: ReadonlyMap<string, SkillProgress>;
  prevBestStars: number;
  allSkills: readonly Skill[];
  allSongs: readonly Song[];
  nowMs: number;
  todayISO: string;
  rand: number; // injected for the variable-reward roll
}

export interface AttemptReward {
  xp: number;
  riffs: number;
  encoreRiffs: number;
  encoreTriggered: boolean;
  newStar: boolean;
  leveledUp: boolean;
  streak: number;
  usedFreeze: boolean;
  newlyUnlockedSongIds: string[];
}

export interface RecordAttemptResult {
  playerState: PlayerState;
  changedSkills: SkillProgress[];
  chartBestStars: number;
  attempt: Attempt;
  reward: AttemptReward;
}

function skillProgressOr(
  map: ReadonlyMap<string, SkillProgress>,
  skillId: string,
  nowMs: number,
): SkillProgress {
  return (
    map.get(skillId) ?? {
      skillId,
      headLock: 0,
      handsLock: 0,
      freshness: newCard(nowMs),
    }
  );
}

export function recordChartAttempt(input: RecordAttemptInput): RecordAttemptResult {
  const { song, attempt, playerState, skillProgressById, prevBestStars, nowMs } = input;

  // Freshness of the exercised skills BEFORE this take (drives XP weighting).
  const taught = song.taughtSkills.map((id) => skillProgressOr(skillProgressById, id, nowMs));
  const xp = xpForAttempt(song, attempt, taught.map((p) => p.freshness), nowMs);
  const encore = rollEncoreBonus(attempt, input.rand);
  const baseRiffs = riffsForAttempt(attempt, prevBestStars);
  const riffs = baseRiffs + encore.riffs;

  // Update each exercised skill: open Hands lock + advance its FSRS card.
  const rating = starsToRating(attempt.stars);
  const changedSkills = taught.map((prev) => {
    const withHands = applyPlayingAttempt(prev, attempt, nowMs);
    return {
      ...withHands,
      freshness: reviewCard(prev.freshness, rating, nowMs),
      lastReviewed: nowMs,
    };
  });

  // Progress map after the update, for tier + unlock recomputation.
  const nextMap = new Map(skillProgressById);
  for (const s of changedSkills) nextMap.set(s.skillId, s);

  const tier = computePlayingTier(input.allSkills, nextMap);
  const before = unlockedSongIds(input.allSongs, skillProgressById);
  const after = unlockedSongIds(input.allSongs, nextMap);
  const newlyUnlockedSongIds = [...after].filter((id) => !before.has(id));

  const streak = updateStreak(playerState, input.todayISO);
  const totalXP = playerState.totalXP + xp;
  const playerLevel = levelForXp(totalXP);

  const nextPlayer: PlayerState = {
    ...playerState,
    totalXP,
    playerLevel,
    currentPlayingTier: tier,
    riffs: playerState.riffs + riffs,
    streak: streak.streak,
    streakFreezes: streak.streakFreezes,
    lastSessionDate: streak.lastSessionDate,
  };

  return {
    playerState: nextPlayer,
    changedSkills,
    chartBestStars: Math.max(prevBestStars, attempt.stars),
    attempt: { ...attempt, xpAwarded: xp, riffsAwarded: riffs },
    reward: {
      xp,
      riffs,
      encoreRiffs: encore.riffs,
      encoreTriggered: encore.triggered,
      newStar: attempt.stars > prevBestStars,
      leveledUp: playerLevel > playerState.playerLevel,
      streak: streak.streak,
      usedFreeze: streak.usedFreeze,
      newlyUnlockedSongIds,
    },
  };
}
