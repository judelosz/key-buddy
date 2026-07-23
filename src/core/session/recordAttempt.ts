/**
 * recordChartAttempt — the pure reducer that turns a completed playing Attempt
 * into progression + reward + spaced-review updates. It composes the guardrail
 * services (Progression ★, Reward ★, FSRS) so all the honesty rules apply in one
 * place; the store just persists the result. Pure and unit-tested.
 *
 * Phase 5: the chart threads through for SongMastery section/transition
 * attribution; qualifying-performance, delayed-song-retrieval, and transfer
 * bonuses pay through songMasteryDelta; the per-song tier-XP cap keeps one
 * song from filling most of a tier band; section drills (attempt.sectionId)
 * accrue section evidence only — never chart bests, boss evidence, riffs, or
 * qualifying performances; fragment takes never touch SongMastery.
 */
import type {
  Attempt,
  Chart,
  PlayerState,
  Skill,
  SkillProgress,
  Song,
} from '@/core/types';
import type { SongMastery } from '@/core/curriculum/types';
import {
  DELAYED_REVIEW_MIN_GAP_MS,
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
import {
  DELAYED_SONG_REVIEW_XP,
  SONG_QUALIFYING_XP,
  SONG_TIER_XP_CAP_PCT,
  TRANSFER_XP,
} from '@/core/rewards/lessonXp';
import { isDue, newCard, reviewCard, starsToRating } from '@/core/srs/fsrs';
import {
  applyGateAdvance,
  type GateEvaluationInputs,
  type TierGateStatus,
} from '@/core/curriculum/tierGate';
import {
  DELAYED_SONG_GAP_MS,
  detectTransfer,
  initialSongMastery,
  normalizeSongMastery,
  songMasteryDelta,
  updateSongMastery,
} from '@/core/songMastery/songMastery';

/** A skill counts as "previously functional" for delayed-review evidence. */
const FUNCTIONAL_HANDS_LOCK = 0.6;
/** How many distinct evidence dates a skill keeps (repeatedSessions proof). */
const MAX_EVIDENCE_DATES = 10;

/** Gate context minus the skill map (the reducer supplies the updated map). */
export type GateContext = Omit<GateEvaluationInputs, 'skillProgressById' | 'skillById'>;

export interface RecordAttemptInput {
  song: Song;
  /** The chart the attempt was scored against (parent chart for drills). */
  chart: Chart;
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
  /** Scouting/stretch takes must never advance SongMastery (doc 06 §5.3). */
  skipSongMastery?: boolean;
  /** Stamped onto the attempt when the take happened inside a session. */
  sessionId?: string;
}

export interface AttemptReward {
  xp: number;
  /** Portion of xp from song evidence (qualifying / delayed / transfer). */
  songBonusXp: number;
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
  /** SongMastery level reached by this take, when it advanced. */
  songMasteryLeveledTo?: SongMastery['level'];
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

/** Append a distinct evidence date (bounded). */
export function withEvidenceDate(dates: string[] | undefined, todayISO: string): string[] {
  const prev = dates ?? [];
  if (prev.includes(todayISO)) return prev;
  return [...prev, todayISO].slice(-MAX_EVIDENCE_DATES);
}

/**
 * Cap one song's contribution to the tier band (doc 07 §2.1: "a single song
 * cannot supply most of a tier's XP"). Lifetime totalXP is never capped.
 */
function cappedTierXp(
  player: PlayerState,
  songId: string,
  xp: number,
  band: number | undefined,
): { tierXpAdd: number; tierXpBySong: Record<string, number> } {
  if (band === undefined) {
    return { tierXpAdd: xp, tierXpBySong: player.tierXpBySong };
  }
  const cap = Math.round(SONG_TIER_XP_CAP_PCT * band);
  const already = player.tierXpBySong[songId] ?? 0;
  const tierXpAdd = Math.max(0, Math.min(xp, cap - already));
  return {
    tierXpAdd,
    tierXpBySong: { ...player.tierXpBySong, [songId]: already + tierXpAdd },
  };
}

export function recordChartAttempt(input: RecordAttemptInput): RecordAttemptResult {
  const { song, chart, playerState, skillProgressById, prevBestStars, nowMs } = input;

  // A section drill can never be an at-tempo full-song mastery take, whatever
  // the slice scored — and it carries its session stamp.
  const isDrill = input.attempt.sectionId !== undefined;
  const attempt: Attempt = {
    ...input.attempt,
    masteryStar: isDrill ? false : input.attempt.masteryStar,
    sessionId: input.sessionId ?? input.attempt.sessionId,
  };

  // Freshness of the exercised skills BEFORE this take (drives XP weighting).
  const taught = song.taughtSkills.map((id) => skillProgressOr(skillProgressById, id, nowMs));
  const baseXp = xpForAttempt(song, attempt, taught.map((p) => p.freshness), nowMs);
  const encore = rollEncoreBonus(attempt, input.rand);
  // Drills reward practice via XP but never improvement riffs or chart bests.
  const baseRiffs = isDrill ? 0 : riffsForAttempt(attempt, prevBestStars);
  const riffs = baseRiffs + encore.riffs;

  // Update each exercised skill: open Hands lock + advance its FSRS card.
  // A due, previously functional skill passed at ≥2★ = delayed-review evidence.
  const rating = starsToRating(attempt.stars);
  const changedSkills = taught.map((prev) => {
    const withHands = applyPlayingAttempt(prev, attempt, nowMs);
    const delayedEnough =
      isDue(prev.freshness, nowMs) ||
      (prev.lastReviewed !== undefined && nowMs - prev.lastReviewed >= DELAYED_REVIEW_MIN_GAP_MS);
    const passedDelayedReview =
      attempt.stars >= 2 && prev.handsLock >= FUNCTIONAL_HANDS_LOCK && delayedEnough;
    return {
      ...withHands,
      freshness: reviewCard(prev.freshness, rating, nowMs),
      lastReviewed: nowMs,
      delayedReviewPassedAt: passedDelayedReview ? nowMs : prev.delayedReviewPassedAt,
      handsEvidenceDates:
        attempt.stars >= 2
          ? withEvidenceDate(prev.handsEvidenceDates, input.todayISO)
          : prev.handsEvidenceDates,
    };
  });

  // Progress map after the update, for tier + unlock recomputation.
  const nextMap = new Map(skillProgressById);
  for (const s of changedSkills) nextMap.set(s.skillId, s);

  const tier = computePlayingTier(input.allSkills, nextMap);
  const before = unlockedSongIds(input.allSongs, skillProgressById);
  const after = unlockedSongIds(input.allSongs, nextMap);
  const newlyUnlockedSongIds = [...after].filter((id) => !before.has(id));

  // ── SongMastery (never for fragments or scouting/stretch takes) ───────────
  const prevMastery = normalizeSongMastery(input.songMastery ?? initialSongMastery(song.id));
  let songMastery = prevMastery;
  let songBonusXp = 0;
  let songMasteryLeveledTo: SongMastery['level'] | undefined;
  if (attempt.refKind !== 'fragment' && !input.skipSongMastery) {
    const delayedContext =
      prevMastery.lastAttemptAt !== undefined &&
      nowMs - prevMastery.lastAttemptAt >= DELAYED_SONG_GAP_MS;
    songMastery = updateSongMastery(prevMastery, {
      kind: 'chart-attempt',
      attempt,
      chart,
      todayISO: input.todayISO,
      delayedContext,
      transfer: detectTransfer(prevMastery, attempt),
    });
    const delta = songMasteryDelta(prevMastery, songMastery);
    songBonusXp =
      (delta.newQualifyingDay ? SONG_QUALIFYING_XP : 0) +
      (delta.delayedRetrieval ? DELAYED_SONG_REVIEW_XP : 0) +
      (delta.newTransfer ? TRANSFER_XP : 0);
    songMasteryLeveledTo = delta.leveledTo;
  }

  const xp = baseXp + songBonusXp;
  const streak = updateStreak(playerState, input.todayISO);
  const totalXP = playerState.totalXP + xp;

  // Boss evidence for the gate: this chart's stored flag OR this very take.
  const chartMasteryStar =
    attempt.masteryStar || (input.gate?.chartMasteryById.get(attempt.refId) ?? false);

  // The tier band caps how much of it FULL-CHART takes on one song can fill
  // (the replay-grind vector). Fragment drills stay uncapped — they teach
  // varied skills and are already freshness-decayed.
  const band =
    attempt.refKind === 'chart'
      ? input.gate?.tierGates.find((g) => g.tier === playerState.learningTier)?.handsXpBand
      : undefined;
  const capped = cappedTierXp(playerState, song.id, xp, band);

  let nextPlayer: PlayerState = {
    ...playerState,
    totalXP,
    tierHandsXP: playerState.tierHandsXP + capped.tierXpAdd,
    tierXpBySong: capped.tierXpBySong,
    currentPlayingTier: tier,
    riffs: playerState.riffs + riffs,
    streak: streak.streak,
    streakFreezes: streak.streakFreezes,
    lastSessionDate: streak.lastSessionDate,
  };

  const skillById = new Map(input.allSkills.map((s) => [s.id, s]));
  let gateStatus: TierGateStatus | null = null;
  let tierAdvanced = false;
  if (input.gate) {
    const chartMasteryById = new Map(input.gate.chartMasteryById);
    if (attempt.masteryStar) chartMasteryById.set(attempt.refId, true);
    const advance = applyGateAdvance(
      nextPlayer,
      { ...input.gate, chartMasteryById, skillProgressById: nextMap, skillById },
      nowMs,
    );
    nextPlayer = advance.player;
    gateStatus = advance.gateStatus;
    tierAdvanced = advance.tierAdvanced;
  } else {
    nextPlayer = { ...nextPlayer, playerLevel: nextPlayer.learningTier };
  }

  return {
    playerState: nextPlayer,
    changedSkills,
    chartBestStars: isDrill ? prevBestStars : Math.max(prevBestStars, attempt.stars),
    chartMasteryStar,
    songMastery,
    attempt: { ...attempt, xpAwarded: xp, riffsAwarded: riffs },
    reward: {
      xp,
      songBonusXp,
      riffs,
      encoreRiffs: encore.riffs,
      encoreTriggered: encore.triggered,
      newStar: !isDrill && attempt.stars > prevBestStars,
      leveledUp: tierAdvanced,
      streak: streak.streak,
      usedFreeze: streak.usedFreeze,
      newlyUnlockedSongIds,
      tierAdvanced,
      gateStatus,
      songMasteryLeveledTo,
    },
  };
}
