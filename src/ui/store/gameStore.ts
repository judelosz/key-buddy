import { create } from 'zustand';
import type { Attempt, Chart, PlayerState, SkillProgress, Song } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { recordChartAttempt, type AttemptReward } from '@/core/session/recordAttempt';
import { unlockedSongIds, songUnlockProgress, type UnlockProgress } from '@/core/progression/progressionService';
import { initialPlayerState } from '@/data/repository';
import { repository } from '@/data/dexieRepository';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface GameState {
  loaded: boolean;
  player: PlayerState;
  skillProgressById: Map<string, SkillProgress>;
  chartBestById: Map<string, number>;
  unlockedIds: Set<string>;
  lastReward: AttemptReward | null;

  init: () => Promise<void>;
  recordAttempt: (song: Song, chart: Chart, attempt: Attempt) => Promise<AttemptReward>;
  /** Marks first-run onboarding done (persists onboardedAt; no-op on replay). */
  completeOnboarding: () => Promise<void>;
  isUnlocked: (songId: string) => boolean;
  unlockProgress: (song: Song) => UnlockProgress;
  bestStars: (chartId: string) => number;
}

/** Single-flight init: concurrent callers (app mount, dev seam) share one load
 * so a late-resolving duplicate can't overwrite fresher state. */
let initPromise: Promise<void> | null = null;

export const useGameStore = create<GameState>((set, get) => ({
  loaded: false,
  player: initialPlayerState(),
  skillProgressById: new Map(),
  chartBestById: new Map(),
  unlockedIds: new Set(),
  lastReward: null,

  init: () => {
    initPromise ??= (async () => {
      const content = getContent();
      let player = await repository.loadPlayerState();
      if (!player) {
        player = initialPlayerState();
        await repository.savePlayerState(player);
      }
      const progressList = await repository.loadAllSkillProgress();
      const skillProgressById = new Map(progressList.map((p) => [p.skillId, p]));
      const chartBest = await repository.loadAllChartBest();
      const chartBestById = new Map(Object.entries(chartBest));
      const unlockedIds = unlockedSongIds(content.songs, skillProgressById);
      set({ loaded: true, player, skillProgressById, chartBestById, unlockedIds });
    })();
    return initPromise;
  },

  recordAttempt: async (song, chart, attempt) => {
    const content = getContent();
    const { player, skillProgressById, chartBestById } = get();
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
    });

    const nextSkills = new Map(skillProgressById);
    for (const s of res.changedSkills) nextSkills.set(s.skillId, s);
    const nextBest = new Map(chartBestById).set(chart.id, res.chartBestStars);
    const unlockedIds = unlockedSongIds(content.songs, nextSkills);

    set({
      player: res.playerState,
      skillProgressById: nextSkills,
      chartBestById: nextBest,
      unlockedIds,
      lastReward: res.reward,
    });

    // Persist (fire-and-forget the writes together).
    await Promise.all([
      repository.savePlayerState(res.playerState),
      repository.saveSkillProgress(res.changedSkills),
      repository.setChartBestStars(chart.id, res.chartBestStars),
      repository.saveAttempt(res.attempt),
    ]);

    return res.reward;
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
}));
