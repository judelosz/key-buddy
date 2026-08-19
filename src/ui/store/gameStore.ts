import { create } from 'zustand';
import { inputService } from '@/input';
import { useAppStore } from '@/ui/store/appStore';
import type { Attempt, Chart, PlayerState, SkillProgress, Song } from '@/core/types';
import type {
  CurriculumLesson,
  LessonProgress,
  LessonResult,
  Module,
  SongMastery,
} from '@/core/curriculum/types';
import type { ExerciseResult } from '@/core/exercise/types';
import { getContent } from '@/core/content/bundled';
import {
  recordChartAttempt,
  type AttemptReward,
  type GateContext,
} from '@/core/session/recordAttempt';
import {
  recordLessonAttempt,
  type LessonReward,
  type SessionRunContext,
} from '@/core/session/recordLesson';
import {
  unlockedSongIds,
  songUnlockProgress,
  type UnlockProgress,
} from '@/core/progression/progressionService';
import {
  applyGateAdvance,
  gateRequirementsRemaining,
  type TierGateStatus,
} from '@/core/curriculum/tierGate';
import {
  moduleProgress,
  nextRecommendedLesson,
  type ModuleProgressSummary,
  type RecommendedLesson,
} from '@/core/curriculum/selectors';
import { dueItems } from '@/core/srs/fsrs';
import {
  initialSongMastery,
  nextEvidenceFor,
  SONG_MASTERY_LABELS,
} from '@/core/songMastery/songMastery';
import { buildSession, advanceSession, extendSession } from '@/core/session/sessionBuilder';
import {
  initialRunState,
  type SegmentOutcome,
  type SessionInputs,
  type SessionPlan,
  type SessionRunState,
  type SessionSegment,
} from '@/core/session/sessionTypes';
import {
  adaptAfterResult,
  initialAdaptation,
  type AdaptationOutcome,
  type AdaptationState,
} from '@/core/adaptive/adaptive';
import { initialPlayerState } from '@/data/repository';
import { repository } from '@/data';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;
const RECENT_CAP = 100;

export interface LevelMeterModel {
  level: number;
  tierHandsXP: number;
  band: number;
  /** What still blocks advancement — the meter must never imply XP suffices. */
  requirementsRemaining: string[];
}

/** What the finished (or abandoned) session shows on the wrap screen. */
export interface SessionSummary {
  sessionId: string;
  segmentsCompleted: number;
  xpHands: number;
  xpHead: number;
  songLevelUps: { songId: string; level: SongMastery['level'] }[];
  tierAdvanced: boolean;
  /** Skills due within the next 24 h — the honest "due tomorrow" line. */
  dueTomorrowCount: number;
  /** A hands segment was practiced — licenses the (true) sleep-consolidation
   * line on the wrap: "you'll be better at this tomorrow" (doc-08 §3.12). */
  practicedHands: boolean;
  /** Which level-gate items moved this session — the wrap's transparency
   * lines ("Practice band +12 · check quiz passed"). */
  gateProgress: string[];
}

export interface SessionPreview {
  total: number;
  reviews: number;
  hasNewMaterial: boolean;
}

export interface SongMasteryDetail {
  mastery: SongMastery;
  levelLabel: string;
  nextEvidence: string[];
}

interface SessionEvents {
  songLevelUps: { songId: string; level: SongMastery['level'] }[];
  tierAdvanced: boolean;
}

interface GameState {
  loaded: boolean;
  player: PlayerState;
  skillProgressById: Map<string, SkillProgress>;
  chartBestById: Map<string, number>;
  chartMasteryById: Map<string, boolean>;
  lessonProgressById: Map<string, LessonProgress>;
  songMasteryById: Map<string, SongMastery>;
  unlockedIds: Set<string>;
  lastReward: AttemptReward | null;
  lastLessonReward: LessonReward | null;
  recentResults: LessonResult[];
  recentAttempts: Attempt[];
  adaptationByRef: Map<string, AdaptationState>;
  lastAdaptation: AdaptationOutcome | null;
  activeSession: { plan: SessionPlan; runState: SessionRunState } | null;
  sessionEvents: SessionEvents;
  /** Gate snapshot at session start — the wrap diffs against it. */
  sessionStartGate: TierGateStatus | null;

  init: () => Promise<void>;
  /** Clears in-memory state before a different authenticated pianist loads. */
  resetForAccount: () => void;
  recordAttempt: (
    song: Song,
    chart: Chart,
    attempt: Attempt,
    opts?: { sessionId?: string; skipSongMastery?: boolean },
  ) => Promise<AttemptReward>;
  recordLesson: (
    lesson: CurriculumLesson,
    module: Module,
    payload:
      | { result: ExerciseResult }
      | { song: Song; chart: Chart; attempt: Attempt },
    sessionCtx?: SessionRunContext,
  ) => Promise<LessonReward>;
  markSongPreviewed: (songId: string) => Promise<void>;
  /** Persists the measured input-latency offset so it survives reloads. */
  setCalibrationOffset: (offsetMs: number) => Promise<void>;
  /** Marks first-run onboarding done (persists onboardedAt; no-op on replay). */
  completeOnboarding: () => Promise<void>;

  startSession: () => Promise<SessionPlan>;
  completeSegment: (
    outcome: SegmentOutcome,
  ) => Promise<{ next: SessionSegment | null; injected?: SessionSegment }>;
  skipSegment: (segmentId: string) => Promise<{ next: SessionSegment | null }>;
  endSession: () => Promise<SessionSummary | null>;

  isUnlocked: (songId: string) => boolean;
  unlockProgress: (song: Song) => UnlockProgress;
  bestStars: (chartId: string) => number;
  moduleProgressFor: (moduleId: string) => ModuleProgressSummary | null;
  nextLesson: () => RecommendedLesson | null;
  tierGateStatus: () => TierGateStatus | null;
  levelMeter: () => LevelMeterModel;
  songMasteryFor: (songId: string) => SongMastery;
  dueReviewSkillIds: () => string[];
  /** Current (or mode-default) adaptive settings for a lesson's next run. */
  adaptationFor: (lesson: CurriculumLesson) => AdaptationState;
  /** Which CTA leads the Missions hero (user decision: context-dependent). */
  missionsHero: () => 'new-material' | 'practice-session';
  sessionPreview: () => SessionPreview;
  songMasteryDetail: (songId: string) => SongMasteryDetail;
}

/** Single-flight init: concurrent callers (app mount, dev seam) share one load
 * so a late-resolving duplicate can't overwrite fresher state. */
let initPromise: Promise<void> | null = null;

export const useGameStore = create<GameState>((set, get) => {
  const gateContext = (): GateContext => {
    const content = getContent();
    return {
      tierGates: content.tierGates,
      assessments: content.assessments,
      lessonProgressById: get().lessonProgressById,
      chartMasteryById: get().chartMasteryById,
    };
  };

  const sessionInputs = (): SessionInputs => {
    const s = get();
    return {
      content: getContent(),
      player: s.player,
      skillProgressById: s.skillProgressById,
      lessonProgressById: s.lessonProgressById,
      songMasteryById: s.songMasteryById,
      recentResults: s.recentResults,
      recentAttempts: s.recentAttempts,
      adaptationByRef: s.adaptationByRef,
      nowMs: Date.now(),
      rand: Math.random,
    };
  };

  /** Fold a result into the per-item adaptive state (persisted per refId). */
  const updateAdaptation = (
    refId: string,
    lesson: CurriculumLesson | null,
    outcome: { scorePct: number; passed: boolean; stars?: number; atTempo?: boolean },
  ): Promise<void> => {
    const now = Date.now();
    const prev = get().adaptationByRef.get(refId) ?? initialAdaptation(refId, lesson, now);
    const out = adaptAfterResult(prev, outcome, now);
    set({
      adaptationByRef: new Map(get().adaptationByRef).set(refId, out.next),
      lastAdaptation: out,
    });
    return repository.saveAdaptation(out.next);
  };

  /** Accumulate wrap-screen events while a session is running. */
  const trackSessionEvents = (
    sessionId: string | undefined,
    songId: string | undefined,
    leveledTo: SongMastery['level'] | undefined,
    tierAdvanced: boolean,
  ): void => {
    const s = get();
    if (!sessionId || s.activeSession?.plan.sessionId !== sessionId) return;
    if (leveledTo === undefined && !tierAdvanced) return;
    set({
      sessionEvents: {
        songLevelUps:
          leveledTo !== undefined && songId !== undefined
            ? [...s.sessionEvents.songLevelUps, { songId, level: leveledTo }]
            : s.sessionEvents.songLevelUps,
        tierAdvanced: s.sessionEvents.tierAdvanced || tierAdvanced,
      },
    });
  };

  /** XP this session earned so far, split by track (attempts linked to a
   * lesson result are counted once, through the result). */
  const xpForSession = (sessionId: string): { xpHands: number; xpHead: number } => {
    const s = get();
    const results = s.recentResults.filter((r) => r.sessionId === sessionId);
    const linked = new Set(results.map((r) => r.attemptId).filter(Boolean));
    const sum = (rows: { xpAwarded: number }[]) => rows.reduce((a, r) => a + r.xpAwarded, 0);
    return {
      xpHands:
        sum(results.filter((r) => r.track === 'hands')) +
        sum(s.recentAttempts.filter((a) => a.sessionId === sessionId && !linked.has(a.id))),
      xpHead: sum(results.filter((r) => r.track === 'head')),
    };
  };

  return {
    loaded: false,
    player: initialPlayerState(),
    skillProgressById: new Map(),
    chartBestById: new Map(),
    chartMasteryById: new Map(),
    lessonProgressById: new Map(),
    songMasteryById: new Map(),
    unlockedIds: new Set(),
    lastReward: null,
    lastLessonReward: null,
    recentResults: [],
    recentAttempts: [],
    adaptationByRef: new Map(),
    lastAdaptation: null,
    activeSession: null,
    sessionEvents: { songLevelUps: [], tierAdvanced: false },
    sessionStartGate: null,

    init: () => {
      initPromise ??= (async () => {
        const content = getContent();
        let player = await repository.loadPlayerState();
        if (!player) {
          player = initialPlayerState();
          await repository.savePlayerState(player);
        }
        const [
          progressList,
          chartBest,
          chartMastery,
          lessonProgress,
          songMastery,
          recentResults,
          recentAttempts,
          adaptation,
        ] = await Promise.all([
          repository.loadAllSkillProgress(),
          repository.loadAllChartBest(),
          repository.loadAllChartMastery(),
          repository.loadAllLessonProgress(),
          repository.loadAllSongMastery(),
          repository.loadRecentLessonResults(RECENT_CAP),
          repository.loadRecentAttempts(RECENT_CAP),
          repository.loadAllAdaptation(),
        ]);
        // Rehydrate the measured input-latency offset — without this the
        // calibration only holds for the session in which it was measured.
        inputService.setCalibrationOffset(player.calibrationOffsetMs);
        useAppStore.getState().setCalibrationOffsetMs(Math.round(player.calibrationOffsetMs));
        const skillProgressById = new Map(progressList.map((p) => [p.skillId, p]));
        set({
          loaded: true,
          player,
          skillProgressById,
          chartBestById: new Map(Object.entries(chartBest)),
          chartMasteryById: new Map(Object.entries(chartMastery)),
          lessonProgressById: new Map(lessonProgress.map((p) => [p.lessonId, p])),
          songMasteryById: new Map(songMastery.map((m) => [m.songId, m])),
          unlockedIds: unlockedSongIds(content.songs, skillProgressById, player.learningTier),
          recentResults,
          recentAttempts,
          adaptationByRef: new Map(adaptation.map((a) => [a.refId, a])),
        });
      })();
      return initPromise;
    },

    resetForAccount: () => {
      initPromise = null;
      set({
        loaded: false,
        player: initialPlayerState(),
        skillProgressById: new Map(),
        chartBestById: new Map(),
        chartMasteryById: new Map(),
        lessonProgressById: new Map(),
        songMasteryById: new Map(),
        unlockedIds: new Set(),
        lastReward: null,
        lastLessonReward: null,
        recentResults: [],
        recentAttempts: [],
        adaptationByRef: new Map(),
        lastAdaptation: null,
        activeSession: null,
        sessionEvents: { songLevelUps: [], tierAdvanced: false },
        sessionStartGate: null,
      });
    },

    recordAttempt: async (song, chart, attempt, opts) => {
      const content = getContent();
      const { player, skillProgressById, chartBestById, chartMasteryById, songMasteryById } =
        get();
      const prevBestStars = chartBestById.get(chart.id) ?? 0;

      const res = recordChartAttempt({
        song,
        chart,
        attempt,
        playerState: player,
        skillProgressById,
        prevBestStars,
        allSkills: content.skills,
        allSongs: content.songs,
        nowMs: Date.now(),
        todayISO: todayISO(),
        rand: Math.random(),
        gate: gateContext(),
        songMastery: songMasteryById.get(song.id),
        skipSongMastery: opts?.skipSongMastery,
        sessionId: opts?.sessionId,
      });

      const nextSkills = new Map(skillProgressById);
      for (const s of res.changedSkills) nextSkills.set(s.skillId, s);
      const nextBest = new Map(chartBestById).set(chart.id, res.chartBestStars);
      const nextMastery = new Map(chartMasteryById).set(chart.id, res.chartMasteryStar);
      const nextSongMastery = new Map(songMasteryById).set(song.id, res.songMastery);

      set({
        player: res.playerState,
        skillProgressById: nextSkills,
        chartBestById: nextBest,
        chartMasteryById: nextMastery,
        songMasteryById: nextSongMastery,
        unlockedIds: unlockedSongIds(content.songs, nextSkills, res.playerState.learningTier),
        lastReward: res.reward,
        recentAttempts: [res.attempt, ...get().recentAttempts].slice(0, RECENT_CAP),
      });
      trackSessionEvents(
        opts?.sessionId,
        song.id,
        res.reward.songMasteryLeveledTo,
        res.reward.tierAdvanced,
      );

      const adaptRef =
        res.attempt.sectionId !== undefined ? `${chart.id}#${res.attempt.sectionId}` : chart.id;
      await Promise.all([
        repository.savePlayerState(res.playerState),
        repository.saveSkillProgress(res.changedSkills),
        repository.setChartBestStars(chart.id, res.chartBestStars),
        repository.setChartMastery(chart.id, res.chartMasteryStar),
        repository.saveSongMastery(res.songMastery),
        repository.saveAttempt(res.attempt),
        updateAdaptation(adaptRef, null, {
          scorePct: res.attempt.notesCorrectPct,
          passed: res.attempt.stars >= 2,
          stars: res.attempt.stars,
          atTempo: res.attempt.atTempo,
        }),
      ]);

      return res.reward;
    },

    recordLesson: async (lesson, module, payload, sessionCtx) => {
      const content = getContent();
      const state = get();
      const outcome = recordLessonAttempt({
        lesson,
        module,
        result: 'result' in payload ? payload.result : undefined,
        chartOutcome:
          'song' in payload
            ? {
                song: payload.song,
                chart: payload.chart,
                attempt: payload.attempt,
                prevBestStars: state.chartBestById.get(payload.attempt.refId) ?? 0,
              }
            : undefined,
        playerState: state.player,
        skillProgressById: state.skillProgressById,
        lessonProgressById: state.lessonProgressById,
        songMastery: 'song' in payload ? state.songMasteryById.get(payload.song.id) : undefined,
        gate: gateContext(),
        allSkills: content.skills,
        allSongs: content.songs,
        nowMs: Date.now(),
        todayISO: todayISO(),
        rand: Math.random(),
        sessionCtx,
      });

      const nextSkills = new Map(state.skillProgressById);
      for (const s of outcome.changedSkills) nextSkills.set(s.skillId, s);
      const nextLessonProgress = new Map(state.lessonProgressById).set(
        lesson.id,
        outcome.lessonProgress,
      );

      const writes: Promise<void>[] = [
        repository.savePlayerState(outcome.playerState),
        repository.saveSkillProgress(outcome.changedSkills),
        repository.saveLessonResult(outcome.lessonResult),
        repository.saveLessonProgress([outcome.lessonProgress]),
      ];

      let nextBest = state.chartBestById;
      let nextChartMastery = state.chartMasteryById;
      let nextSongMastery = state.songMasteryById;
      if (outcome.chart) {
        nextBest = new Map(nextBest).set(outcome.chart.attempt.refId, outcome.chart.chartBestStars);
        nextChartMastery = new Map(nextChartMastery).set(
          outcome.chart.attempt.refId,
          outcome.chart.chartMasteryStar,
        );
        writes.push(
          repository.setChartBestStars(outcome.chart.attempt.refId, outcome.chart.chartBestStars),
          repository.setChartMastery(outcome.chart.attempt.refId, outcome.chart.chartMasteryStar),
          repository.saveAttempt(outcome.chart.attempt),
        );
      }
      if (outcome.songMastery) {
        nextSongMastery = new Map(nextSongMastery).set(
          outcome.songMastery.songId,
          outcome.songMastery,
        );
        writes.push(repository.saveSongMastery(outcome.songMastery));
      }

      set({
        player: outcome.playerState,
        skillProgressById: nextSkills,
        lessonProgressById: nextLessonProgress,
        chartBestById: nextBest,
        chartMasteryById: nextChartMastery,
        songMasteryById: nextSongMastery,
        unlockedIds: unlockedSongIds(content.songs, nextSkills, outcome.playerState.learningTier),
        lastLessonReward: outcome.reward,
        recentResults: [outcome.lessonResult, ...get().recentResults].slice(0, RECENT_CAP),
        recentAttempts: outcome.chart
          ? [outcome.chart.attempt, ...get().recentAttempts].slice(0, RECENT_CAP)
          : get().recentAttempts,
      });
      trackSessionEvents(
        sessionCtx?.sessionId,
        'song' in payload ? payload.song.id : undefined,
        outcome.reward.chartReward?.songMasteryLeveledTo,
        outcome.reward.tierAdvanced,
      );

      writes.push(
        updateAdaptation(lesson.id, lesson, {
          scorePct: outcome.reward.scorePct,
          passed: outcome.reward.passed,
          stars: outcome.chart?.attempt.stars,
          atTempo: outcome.chart?.attempt.atTempo,
        }),
      );
      await Promise.all(writes);
      return outcome.reward;
    },

    markSongPreviewed: async (songId) => {
      const { songMasteryById } = get();
      if (songMasteryById.has(songId)) return;
      const mastery = initialSongMastery(songId);
      set({ songMasteryById: new Map(songMasteryById).set(songId, mastery) });
      await repository.saveSongMastery(mastery);
    },

    setCalibrationOffset: async (offsetMs) => {
      const next = { ...get().player, calibrationOffsetMs: offsetMs };
      set({ player: next });
      await repository.savePlayerState(next);
    },

    completeOnboarding: async () => {
      const { player } = get();
      if (player.onboardedAt !== undefined) return;
      const next = { ...player, onboardedAt: Date.now() };
      set({ player: next });
      await repository.savePlayerState(next);
    },

    startSession: async () => {
      // No path around the UI gate: sessions open once Tier 1 is passed.
      if (get().player.learningTier < 2) {
        throw new Error('Daily practice unlocks when Tier 1 is passed');
      }
      const plan = buildSession(sessionInputs());
      set({
        activeSession: { plan, runState: initialRunState() },
        sessionEvents: { songLevelUps: [], tierAdvanced: false },
        // Snapshot the gate so the wrap can show exactly what moved.
        sessionStartGate: get().tierGateStatus(),
      });
      await repository.saveSession({
        id: plan.sessionId,
        startedAt: plan.startedAt,
        segmentsCompleted: 0,
        xpHands: 0,
        xpHead: 0,
      });
      return plan;
    },

    completeSegment: async (outcome) => {
      const active = get().activeSession;
      if (!active) return { next: null };
      const inputs = sessionInputs();
      const advanced = advanceSession(active.plan, active.runState, outcome, inputs);
      const plan = extendSession(advanced.plan, advanced.state, inputs);
      set({ activeSession: { plan, runState: advanced.state } });
      await repository.saveSession({
        id: plan.sessionId,
        startedAt: plan.startedAt,
        segmentsCompleted: advanced.state.completed.length,
        ...xpForSession(plan.sessionId),
      });
      return { next: plan.queue[0] ?? null, injected: advanced.injected };
    },

    skipSegment: async (segmentId) => {
      const res = await get().completeSegment({
        segmentId,
        passed: false,
        scorePct: 0,
        skippedByUser: true,
      });
      return { next: res.next };
    },

    endSession: async () => {
      const s = get();
      const active = s.activeSession;
      if (!active) return null;
      const xp = xpForSession(active.plan.sessionId);
      const now = Date.now();

      // Which gate items moved this sitting (transparency: every session
      // visibly lands on the level-up math).
      const before = s.sessionStartGate;
      const after = s.tierGateStatus();
      const gateProgress: string[] = [];
      if (s.sessionEvents.tierAdvanced) {
        gateProgress.push('Gate opened — you leveled up!');
      } else if (before && after && before.tier === after.tier) {
        const xpDelta = after.handsXp.current - before.handsXp.current;
        if (xpDelta > 0) {
          gateProgress.push(
            `Practice band +${xpDelta} XP (${after.handsXp.current}/${after.handsXp.band})`,
          );
        }
        const masteredDelta =
          after.coreSkills.filter((c) => c.mastered).length -
          before.coreSkills.filter((c) => c.mastered).length;
        if (masteredDelta > 0) {
          gateProgress.push(`+${masteredDelta} core skill${masteredDelta === 1 ? '' : 's'} mastered`);
        }
        if (!before.bossPassed && after.bossPassed) gateProgress.push('Boss mastery star earned');
        if (
          !before.checkpoints.every((c) => c.passed) &&
          after.checkpoints.every((c) => c.passed)
        ) {
          gateProgress.push('Theory & ear checkpoint passed');
        }
        if (after.delayedReviewRequired && !before.delayedReviewPassed && after.delayedReviewPassed) {
          gateProgress.push('“Review after a delay” gate item done');
        }
      }

      const summary: SessionSummary = {
        sessionId: active.plan.sessionId,
        segmentsCompleted: active.runState.completed.length,
        ...xp,
        songLevelUps: s.sessionEvents.songLevelUps,
        tierAdvanced: s.sessionEvents.tierAdvanced,
        dueTomorrowCount: [...s.skillProgressById.values()].filter(
          (p) => p.freshness.due <= now + DAY_MS,
        ).length,
        practicedHands: xp.xpHands > 0,
        gateProgress,
      };
      set({
        activeSession: null,
        sessionEvents: { songLevelUps: [], tierAdvanced: false },
        sessionStartGate: null,
      });
      await repository.saveSession({
        id: active.plan.sessionId,
        startedAt: active.plan.startedAt,
        endedAt: now,
        segmentsCompleted: summary.segmentsCompleted,
        xpHands: summary.xpHands,
        xpHead: summary.xpHead,
      });
      return summary;
    },

    isUnlocked: (songId) => get().unlockedIds.has(songId),
    unlockProgress: (song) =>
      songUnlockProgress(song, get().skillProgressById, get().player.learningTier),
    bestStars: (chartId) => get().chartBestById.get(chartId) ?? 0,

    moduleProgressFor: (moduleId) => {
      const module = getContent().getModule(moduleId);
      return module ? moduleProgress(module, get().lessonProgressById) : null;
    },

    nextLesson: () =>
      nextRecommendedLesson(
        getContent(),
        get().lessonProgressById,
        get().player.learningTier,
        get().skillProgressById,
        Date.now(),
      ),

    tierGateStatus: () => {
      const state = get();
      const { gateStatus } = applyGateAdvance(
        state.player,
        {
          tierGates: getContent().tierGates,
          assessments: getContent().assessments,
          skillProgressById: state.skillProgressById,
          lessonProgressById: state.lessonProgressById,
          chartMasteryById: state.chartMasteryById,
        },
        0, // read-only evaluation; nowMs only stamps an advance, which we discard
      );
      return gateStatus;
    },

    levelMeter: () => {
      const state = get();
      const status = get().tierGateStatus();
      return {
        level: state.player.learningTier,
        tierHandsXP: state.player.tierHandsXP,
        band: status?.handsXp.band ?? 100,
        requirementsRemaining: status ? gateRequirementsRemaining(status) : [],
      };
    },

    songMasteryFor: (songId) => get().songMasteryById.get(songId) ?? initialSongMastery(songId),

    dueReviewSkillIds: () =>
      dueItems([...get().skillProgressById.values()], Date.now()).map((p) => p.skillId),

    adaptationFor: (lesson) =>
      get().adaptationByRef.get(lesson.id) ?? initialAdaptation(lesson.id, lesson, Date.now()),

    missionsHero: () => {
      // Daily practice unlocks with Tier 1 (momentum schedule) — until then
      // the hero always leads with path material.
      if (get().player.learningTier < 2) return 'new-material';
      const rec = get().nextLesson();
      return rec && rec.review !== true ? 'new-material' : 'practice-session';
    },

    sessionPreview: () => {
      const queue = buildSession(sessionInputs()).queue;
      return {
        total: queue.length,
        reviews: queue.filter((s) => s.purpose === 'due-review' || s.purpose === 'theory-ear')
          .length,
        hasNewMaterial: queue.some(
          (s) => s.purpose === 'new-material' || s.purpose === 'independent-check',
        ),
      };
    },

    songMasteryDetail: (songId) => {
      const content = getContent();
      const mastery = get().songMasteryFor(songId);
      const song = content.getSong(songId);
      const chart = song?.chartIds[0] ? content.getChart(song.chartIds[0]) : undefined;
      return {
        mastery,
        levelLabel: SONG_MASTERY_LABELS[mastery.level],
        nextEvidence: nextEvidenceFor(mastery, chart),
      };
    },
  };
});
