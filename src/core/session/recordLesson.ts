/**
 * recordLessonAttempt — the pure reducer for curriculum lessons. Exercise
 * lessons grade via the ExerciseEngine's result; chart/fragment lessons
 * compose recordChartAttempt (the single source of truth for Hands locks,
 * chart XP, streaks, and unlocks) and layer lesson bookkeeping, checkpoint
 * honesty, and gate evaluation on top.
 *
 * Checkpoint honesty: an independent lesson take that used a visual assist —
 * or a performance take that used any assist or was slowed — is `passed:
 * false` regardless of stars. The attempt still records normally; the lesson
 * just doesn't count as its checkpoint.
 */
import type { Attempt, Chart, PlayerState, Skill, SkillProgress, Song, Tier } from '@/core/types';
import type {
  CurriculumLesson,
  LessonProgress,
  LessonResult,
  Module,
  SongMastery,
  XpTrack,
} from '@/core/curriculum/types';
import type { ExerciseResult } from '@/core/exercise/types';
import {
  DELAYED_REVIEW_MIN_GAP_MS,
  applyExerciseAttempt,
  applyHeadAttempt,
  trackForExerciseType,
} from '@/core/progression/progressionService';
import { awardHeadXp, xpForLessonResult, type XpPurpose } from '@/core/rewards/lessonXp';
import { updateStreak } from '@/core/rewards/rewardService';
import { isDue, newCard, reviewCard, scoreToRating } from '@/core/srs/fsrs';
import { applyGateAdvance, type TierGateStatus } from '@/core/curriculum/tierGate';
import {
  recordChartAttempt,
  withEvidenceDate,
  type AttemptReward,
  type GateContext,
  type RecordAttemptResult,
} from './recordAttempt';

const VISUAL_ASSISTS = ['falling-notes', 'note-names'] as const;
const FUNCTIONAL_LOCK = 0.6;

/** Why (and inside which session) a lesson run happened. */
export interface SessionRunContext {
  sessionId: string;
  /** XP-bearing purpose; other purposes carry no special row. */
  purpose?: XpPurpose;
  /** Required for the remediation row — proves a recorded weakness. */
  addressedRecordedWeakness?: boolean;
}

export interface RecordLessonInput {
  lesson: CurriculumLesson;
  module: Module;
  /** Exercise lessons: the ExerciseEngine's result. */
  result?: ExerciseResult;
  /** Chart/fragment lessons: the scored take + the chart it was scored on. */
  chartOutcome?: { song: Song; chart: Chart; attempt: Attempt; prevBestStars: number };
  playerState: PlayerState;
  skillProgressById: ReadonlyMap<string, SkillProgress>;
  lessonProgressById: ReadonlyMap<string, LessonProgress>;
  songMastery?: SongMastery;
  gate: GateContext;
  allSkills: readonly Skill[];
  allSongs: readonly Song[];
  nowMs: number;
  todayISO: string;
  rand: number;
  sessionCtx?: SessionRunContext;
}

export interface LessonReward {
  xp: number;
  track: XpTrack;
  passed: boolean;
  scorePct: number;
  firstCompletion: boolean;
  tierAdvanced: boolean;
  newLearningTier: Tier;
  gateStatus: TierGateStatus | null;
  newlyUnlockedSongIds: string[];
  moduleCompleted: boolean;
  /** Chart lessons: the underlying chart reward (XP/riffs/encore/streak). */
  chartReward?: AttemptReward;
  /** Chart lessons: the scored take, so result screens can show the timing
   * detail (tip, weak bars, full report) without a second recording path. */
  attempt?: Attempt;
}

export interface RecordLessonOutcome {
  playerState: PlayerState;
  changedSkills: SkillProgress[];
  lessonResult: LessonResult;
  lessonProgress: LessonProgress;
  songMastery?: SongMastery;
  chart?: { chartBestStars: number; chartMasteryStar: boolean; attempt: Attempt };
  reward: LessonReward;
}

function skillProgressOr(
  map: ReadonlyMap<string, SkillProgress>,
  skillId: string,
  nowMs: number,
): SkillProgress {
  return map.get(skillId) ?? { skillId, headLock: 0, handsLock: 0, freshness: newCard(nowMs) };
}

/** Does a chart take satisfy the lesson's pass criteria AND its mode policy? */
export function chartLessonPassed(lesson: CurriculumLesson, attempt: Attempt): boolean {
  const c = lesson.passCriteria;
  if (c.minStars !== undefined && attempt.stars < c.minStars) return false;
  if (c.requiresMasteryStar && !attempt.masteryStar) return false;
  if (c.minScorePct !== undefined && attempt.notesCorrectPct < c.minScorePct) return false;
  if (lesson.mode === 'independent') {
    if (attempt.assistsUsed.some((a) => (VISUAL_ASSISTS as readonly string[]).includes(a))) {
      return false;
    }
  }
  if (lesson.mode === 'performance') {
    if (attempt.assistsUsed.length > 0 || !attempt.atTempo) return false;
  }
  return true;
}

function updatedLessonProgress(
  prev: LessonProgress | undefined,
  lessonId: string,
  scorePct: number,
  passed: boolean,
  nowMs: number,
  todayISO: string,
): LessonProgress {
  const sameDay = prev?.lastAttemptDate === todayISO;
  return {
    lessonId,
    completedAt: prev?.completedAt ?? (passed ? nowMs : undefined),
    bestScorePct: Math.max(prev?.bestScorePct ?? 0, scorePct),
    attempts: (prev?.attempts ?? 0) + 1,
    lastAttemptDate: todayISO,
    attemptsOnLastDate: sameDay ? (prev?.attemptsOnLastDate ?? 0) + 1 : 1,
  };
}

function moduleCompleted(
  module: Module,
  lessonProgressById: ReadonlyMap<string, LessonProgress>,
  updated: LessonProgress,
): boolean {
  return module.lessonIds.every((id) => {
    const p = id === updated.lessonId ? updated : lessonProgressById.get(id);
    return p?.completedAt !== undefined;
  });
}

export function recordLessonAttempt(input: RecordLessonInput): RecordLessonOutcome {
  const { lesson, module, nowMs, todayISO } = input;
  const prevProgress = input.lessonProgressById.get(lesson.id);

  // ── Chart/fragment lessons: delegate to the chart reducer ────────────────
  if (input.chartOutcome) {
    const { song, chart, attempt, prevBestStars } = input.chartOutcome;
    const passed = chartLessonPassed(lesson, attempt);
    const scorePct = attempt.notesCorrectPct;

    const chartResult: RecordAttemptResult = recordChartAttempt({
      song,
      chart,
      attempt,
      playerState: input.playerState,
      skillProgressById: input.skillProgressById,
      prevBestStars,
      allSkills: input.allSkills,
      allSongs: input.allSongs,
      nowMs,
      todayISO,
      rand: input.rand,
      gate: input.gate,
      songMastery: input.songMastery,
      // Scouting/stretch exploration must never advance SongMastery (§5.3).
      skipSongMastery: lesson.mode === 'scouting' || lesson.stretchBoss === true,
      sessionId: input.sessionCtx?.sessionId,
    });

    const lessonProgress = updatedLessonProgress(
      prevProgress, lesson.id, scorePct, passed, nowMs, todayISO,
    );
    // Re-run the gate with the lesson's own progress included — a checkpoint
    // lesson can be the gate's theory/ear assessment vehicle.
    const lessonProgressById = new Map(input.lessonProgressById).set(lesson.id, lessonProgress);
    const nextSkills = new Map(input.skillProgressById);
    for (const s of chartResult.changedSkills) nextSkills.set(s.skillId, s);
    const chartMasteryById = new Map(input.gate.chartMasteryById);
    if (chartResult.chartMasteryStar) chartMasteryById.set(attempt.refId, true);
    const advance = applyGateAdvance(
      chartResult.playerState,
      {
        tierGates: input.gate.tierGates,
        assessments: input.gate.assessments,
        lessonProgressById,
        chartMasteryById,
        skillProgressById: nextSkills,
        skillById: new Map(input.allSkills.map((s) => [s.id, s])),
      },
      nowMs,
    );

    const lessonResult: LessonResult = {
      id: `${lesson.id}-${nowMs}`,
      lessonId: lesson.id,
      moduleId: module.id,
      timestamp: nowMs,
      mode: lesson.mode,
      exerciseType: lesson.exerciseType,
      track: 'hands',
      scorePct,
      passed,
      xpAwarded: chartResult.reward.xp,
      attemptId: attempt.id,
      sessionId: input.sessionCtx?.sessionId,
    };

    const tierAdvanced = chartResult.reward.tierAdvanced || advance.tierAdvanced;
    return {
      playerState: advance.player,
      changedSkills: chartResult.changedSkills,
      lessonResult,
      lessonProgress,
      songMastery: chartResult.songMastery,
      chart: {
        chartBestStars: chartResult.chartBestStars,
        chartMasteryStar: chartResult.chartMasteryStar,
        attempt: chartResult.attempt,
      },
      reward: {
        xp: chartResult.reward.xp,
        track: 'hands',
        passed,
        scorePct,
        firstCompletion: prevProgress?.completedAt === undefined && passed,
        tierAdvanced,
        newLearningTier: advance.player.learningTier,
        gateStatus: advance.gateStatus,
        newlyUnlockedSongIds: chartResult.reward.newlyUnlockedSongIds,
        moduleCompleted:
          passed && moduleCompleted(module, input.lessonProgressById, lessonProgress),
        chartReward: chartResult.reward,
        attempt: chartResult.attempt,
      },
    };
  }

  // ── Exercise lessons ───────────────────────────────────────────────────────
  const result = input.result;
  if (!result) throw new Error(`Lesson ${lesson.id} recorded with neither result nor chartOutcome`);
  const scorePct = result.scorePct;
  const passed = scorePct >= (lesson.passCriteria.minScorePct ?? 0.8);
  const track = trackForExerciseType(lesson.exerciseType);
  const isScouting = lesson.mode === 'scouting';

  const prevSkills = lesson.skillIds.map((id) =>
    skillProgressOr(input.skillProgressById, id, nowMs),
  );
  const wasDue = prevSkills.some((p) => isDue(p.freshness, nowMs));

  const { xp } = xpForLessonResult(lesson, {
    passed,
    scorePct,
    firstCompletion: prevProgress?.completedAt === undefined && passed,
    attemptsTodayBefore:
      prevProgress?.lastAttemptDate === todayISO ? prevProgress.attemptsOnLastDate : 0,
    wasDue,
    freshness: prevSkills.map((p) => p.freshness),
    tier: module.tier,
    nowMs,
    purpose: input.sessionCtx?.purpose,
    addressedRecordedWeakness: input.sessionCtx?.addressedRecordedWeakness,
  });

  // Scouting (incl. stretch bosses) is exploration: no locks, no review cards.
  const rating = scoreToRating(scorePct);
  const changedSkills = isScouting
    ? []
    : prevSkills.map((prev) => {
        const withLock =
          track === 'hands'
            ? applyExerciseAttempt(prev, scorePct, lesson.mode, nowMs)
            : applyHeadAttempt(prev, scorePct, nowMs);
        const lockBefore = track === 'hands' ? prev.handsLock : prev.headLock;
        const delayedEnough =
          isDue(prev.freshness, nowMs) ||
          (prev.lastReviewed !== undefined &&
            nowMs - prev.lastReviewed >= DELAYED_REVIEW_MIN_GAP_MS);
        const passedDelayedReview = passed && lockBefore >= FUNCTIONAL_LOCK && delayedEnough;
        return {
          ...withLock,
          freshness: reviewCard(prev.freshness, rating, nowMs),
          lastReviewed: nowMs,
          delayedReviewPassedAt: passedDelayedReview ? nowMs : prev.delayedReviewPassedAt,
          handsEvidenceDates:
            passed && track === 'hands'
              ? withEvidenceDate(prev.handsEvidenceDates, todayISO)
              : prev.handsEvidenceDates,
        };
      });

  const nextSkills = new Map(input.skillProgressById);
  for (const s of changedSkills) nextSkills.set(s.skillId, s);

  const streak = updateStreak(input.playerState, todayISO);
  let nextPlayer: PlayerState = {
    ...input.playerState,
    streak: streak.streak,
    streakFreezes: streak.streakFreezes,
    lastSessionDate: streak.lastSessionDate,
  };
  if (track === 'hands') {
    nextPlayer = {
      ...nextPlayer,
      totalXP: nextPlayer.totalXP + xp,
      tierHandsXP: nextPlayer.tierHandsXP + xp,
    };
  } else {
    nextPlayer = awardHeadXp(nextPlayer, xp);
  }

  const lessonProgress = updatedLessonProgress(
    prevProgress, lesson.id, scorePct, passed, nowMs, todayISO,
  );
  const lessonProgressById = new Map(input.lessonProgressById).set(lesson.id, lessonProgress);

  const advance = applyGateAdvance(
    nextPlayer,
    {
      tierGates: input.gate.tierGates,
      assessments: input.gate.assessments,
      lessonProgressById,
      chartMasteryById: input.gate.chartMasteryById,
      skillProgressById: nextSkills,
      skillById: new Map(input.allSkills.map((s) => [s.id, s])),
    },
    nowMs,
  );

  const lessonResult: LessonResult = {
    id: `${lesson.id}-${nowMs}`,
    lessonId: lesson.id,
    moduleId: module.id,
    timestamp: nowMs,
    mode: lesson.mode,
    exerciseType: lesson.exerciseType,
    track,
    scorePct,
    passed,
    xpAwarded: xp,
    sessionId: input.sessionCtx?.sessionId,
  };

  return {
    playerState: advance.player,
    changedSkills,
    lessonResult,
    lessonProgress,
    reward: {
      xp,
      track,
      passed,
      scorePct,
      firstCompletion: prevProgress?.completedAt === undefined && passed,
      tierAdvanced: advance.tierAdvanced,
      newLearningTier: advance.player.learningTier,
      gateStatus: advance.gateStatus,
      newlyUnlockedSongIds: [],
      moduleCompleted:
        passed && moduleCompleted(module, input.lessonProgressById, lessonProgress),
    },
  };
}
