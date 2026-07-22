/**
 * recordChartAttempt — the pure reducer that turns a completed playing Attempt
 * into progression + reward + spaced-review updates. It composes the guardrail
 * services (Progression ★, Reward ★, FSRS) so all the honesty rules apply in one
 * place; the store just persists the result. Pure and unit-tested.
 *
 * Phase 4: playerLevel := learningTier (tier gates passed + 1) via the shared
 * applyGateAdvance step — a Free Play boss take counts toward the gate exactly
 * like a Missions take. Hands XP also fills tierHandsXP (the meter), chart
 * mastery-star evidence and SongMastery are updated, and a due, previously
 * functional skill passed at ≥2 stars records delayed-review evidence.
 */
import type {
  Attempt,
  PlayerState,
  Skill,
  SkillProgress,
  Song,
} from '@/core/types';
import type { SongMastery } from '@/core/curriculum/types';
import {
  applyPlayingAttempt,
  computePlayingTier,
  unlockedSongIds,
} from '@/core/progression/progressionService';
import {
  riffsForAttempt,
  rollEncoreBonus,
  updateStreak,
  xpForAttempt,
} from '@/core/rewards/rewardService';
import { isDue, newCard, reviewCard, starsToRating } from '@/core/srs/fsrs';
import {
  applyGateAdvance,
  type GateEvaluationInputs,
  type TierGateStatus,
} from '@/core/curriculum/tierGate';
import { initialSongMastery, updateSongMastery } from '@/core/songMastery/songMastery';

/** A skill counts as "previously functional" for delayed-review evidence. */
const FUNCTIONAL_HANDS_LOCK = 0.6;

/** Gate context minus the skill map (the reducer supplies the updated map). */
export type GateContext = Omit<GateEvaluationInputs, 'skillProgressById'>;

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
  /** Tier-gate evaluation context; omit to skip gate work (e.g. bare tests). */
  gate?: GateContext;
  /** Current SongMastery record for this song (created when absent). */
  songMastery?: SongMastery;
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
  tierAdvanced: boolean;
  gateStatus: TierGateStatus | null;
}

export interface RecordAttemptResult {
  playerState: PlayerState;
  changedSkills: SkillProgress[];
  chartBestStars: number;
  /** True once this chart has ever earned the mastery star (boss evidence). */
  chartMasteryStar: boolean;
  songMastery: SongMastery;
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
  // A due, previously functional skill passed at ≥2★ = delayed-review evidence.
  const rating = starsToRating(attempt.stars);
  const changedSkills = taught.map((prev) => {
    const withHands = applyPlayingAttempt(prev, attempt, nowMs);
    const passedDelayedReview =
      attempt.stars >= 2 &&
      prev.handsLock >= FUNCTIONAL_HANDS_LOCK &&
      isDue(prev.freshness, nowMs);
    return {
      ...withHands,
      freshness: reviewCard(prev.freshness, rating, nowMs),
      lastReviewed: nowMs,
      delayedReviewPassedAt: passedDelayedReview ? nowMs : prev.delayedReviewPassedAt,
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

  // Boss evidence for the gate: this chart's stored flag OR this very take.
  const chartMasteryStar =
    attempt.masteryStar || (input.gate?.chartMasteryById.get(attempt.refId) ?? false);

  let nextPlayer: PlayerState = {
    ...playerState,
    totalXP,
    tierHandsXP: playerState.tierHandsXP + xp,
    currentPlayingTier: tier,
    riffs: playerState.riffs + riffs,
    streak: streak.streak,
    streakFreezes: streak.streakFreezes,
    lastSessionDate: streak.lastSessionDate,
  };

  let gateStatus: TierGateStatus | null = null;
  let tierAdvanced = false;
  if (input.gate) {
    const chartMasteryById = new Map(input.gate.chartMasteryById);
    if (attempt.masteryStar) chartMasteryById.set(attempt.refId, true);
    const advance = applyGateAdvance(
      nextPlayer,
      { ...input.gate, chartMasteryById, skillProgressById: nextMap },
      nowMs,
    );
    nextPlayer = advance.player;
    gateStatus = advance.gateStatus;
    tierAdvanced = advance.tierAdvanced;
  } else {
    nextPlayer = { ...nextPlayer, playerLevel: nextPlayer.learningTier };
  }

  const songMastery = updateSongMastery(input.songMastery ?? initialSongMastery(song.id), {
    kind: 'chart-attempt',
    attempt,
    todayISO: input.todayISO,
  });

  return {
    playerState: nextPlayer,
    changedSkills,
    chartBestStars: Math.max(prevBestStars, attempt.stars),
    chartMasteryStar,
    songMastery,
    attempt: { ...attempt, xpAwarded: xp, riffsAwarded: riffs },
    reward: {
      xp,
      riffs,
      encoreRiffs: encore.riffs,
      encoreTriggered: encore.triggered,
      newStar: attempt.stars > prevBestStars,
      leveledUp: tierAdvanced,
      streak: streak.streak,
      usedFreeze: streak.usedFreeze,
      newlyUnlockedSongIds,
      tierAdvanced,
      gateStatus,
    },
  };
}
