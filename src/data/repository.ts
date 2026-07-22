/**
 * Repository interface — the persistence boundary (build-spec §2, §6). Services
 * and the store depend on this interface, not on Dexie, so a sync backend can
 * replace IndexedDB later without touching anything upstream.
 */
import type { Attempt, PlayerState, SkillProgress } from '@/core/types';

export interface Repository {
  loadPlayerState(): Promise<PlayerState | null>;
  savePlayerState(state: PlayerState): Promise<void>;

  loadAllSkillProgress(): Promise<SkillProgress[]>;
  saveSkillProgress(progress: SkillProgress[]): Promise<void>;

  getChartBestStars(chartId: string): Promise<number>;
  setChartBestStars(chartId: string, stars: number): Promise<void>;
  loadAllChartBest(): Promise<Record<string, number>>;

  saveAttempt(attempt: Attempt): Promise<void>;
  loadRecentAttempts(limit?: number): Promise<Attempt[]>;

  clearAll(): Promise<void>;
}

export function initialPlayerState(): PlayerState {
  return {
    playerLevel: 1,
    totalXP: 0,
    currentPlayingTier: 1,
    headTrackXP: 0,
    riffs: 0,
    streak: 0,
    streakFreezes: 2, // start with a couple of freezes (doc 03 §5)
    cosmeticsOwned: [],
    equippedCosmetics: {},
    calibrationOffsetMs: 0,
  };
}
