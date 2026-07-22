import { create } from 'zustand';
import type { Attempt, Chart, PlayerState, SkillProgress, Song } from '@/core/types';
import type {
  CurriculumLesson,
  LessonProgress,
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
import { recordLessonAttempt, type LessonReward } from '@/core/session/recordLesson';
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
import { initialSongMastery } from '@/core/songMastery/songMastery';
import { initialPlayerState } from '@/data/repository';
import { repository } from '@/data/dexieRepository';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface LevelMeterModel {
  level: number;
  tierHandsXP: number;
  band: number;
  /** What still blocks advancement — the meter must never imply XP suffices. */
  requirementsRemaining: string[];
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

  init: () => Promise<void>;
  recordAttempt: (song: Song, chart: Chart, attempt: Attempt) => Promise<AttemptReward>;
  recordLesson: (
    lesson: CurriculumLesson,
    module: Module,
    payload:
      | { result: ExerciseResult }
      | { song: Song; attempt: Attempt },
  ) => Promise<LessonReward>;
  markSongPreviewed: (songId: string) => Promise<void>;
  /** Marks first-run onboarding done (persists onboardedAt; no-op on replay). */
  completeOnboarding: () => Promise<void>;

  isUnlocked: (songId: string) => boolean;
  unlockProgress: (song: Song) => UnlockProgress;
  bestStars: (chartId: string) => number;
  moduleProgressFor: (moduleId: string) => ModuleProgressSummary | null;
  nextLesson: () => RecommendedLesson | null;
  tierGateStatus: () => TierGateStatus | null;
  levelMeter: () => LevelMeterModel;
  songMasteryFor: (songId: string) => SongMastery;
  dueReviewSkillIds: () => string[];
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

    init: () => {
      initPromise ??= (async () => {
        const content = getContent();
        let player = await repository.loadPlayerState();
        if (!player) {
          player = initialPlayerState();
          await repository.savePlayerState(player);
        }
        const [progressList, chartBest, chartMastery, lessonProgress, songMastery] =
          await Promise.all([
            repository.loadAllSkillProgress(),
            repository.loadAllChartBest(),
            repository.loadAllChartMastery(),
            repository.loadAllLessonProgress(),
            repository.loadAllSongMastery(),
          ]);
        const skillProgressById = new Map(progressList.map((p) => [p.skillId, p]));
        set({
          loaded: true,
          player,
          skillProgressById,
          chartBestById: new Map(Object.entries(chartBest)),
          chartMasteryById: new Map(Object.entries(chartMastery)),
          lessonProgressById: new Map(lessonProgress.map((p) => [p.lessonId, p])),
          songMasteryById: new Map(songMastery.map((m) => [m.songId, m])),
          unlockedIds: unlockedSongIds(content.songs, skillProgressById),
        });
      })();
      return initPromise;
    },

    recordAttempt: async (song, chart, attempt) => {
      const content = getContent();
      const { player, skillProgressById, chartBestById, chartMasteryById, songMasteryById } =
        get();
      const prevBestStars = chartBestById.get(chart.id) ?? 0;

      const res = recordChartAttempt({
        song,
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
        unlockedIds: unlockedSongIds(content.songs, nextSkills),
        lastReward: res.reward,
      });

      await Promise.all([
        repository.savePlayerState(res.playerState),
        repository.saveSkillProgress(res.changedSkills),
        repository.setChartBestStars(chart.id, res.chartBestStars),
        repository.setChartMastery(chart.id, res.chartMasteryStar),
        repository.saveSongMastery(res.songMastery),
        repository.saveAttempt(res.attempt),
      ]);

      return res.reward;
    },

    recordLesson: async (lesson, module, payload) => {
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
        unlockedIds: unlockedSongIds(content.songs, nextSkills),
        lastLessonReward: outcome.reward,
      });

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

    completeOnboarding: async () => {
      const { player } = get();
      if (player.onboardedAt !== undefined) return;
      const next = { ...player, onboardedAt: Date.now() };
      set({ player: next });
      await repository.savePlayerState(next);
    },

    isUnlocked: (songId) => get().unlockedIds.has(songId),
    unlockProgress: (song) => songUnlockProgress(song, get().skillProgressById),
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
  };
});
