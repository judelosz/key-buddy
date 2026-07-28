/**
 * Repository interface — the persistence boundary (build-spec §2, §6). Services
 * and the store depend on this interface, not on Dexie, so a sync backend can
 * replace IndexedDB later without touching anything upstream.
 */
import type { Attempt, PlayerState, SkillProgress } from '@/core/types';
import type { LessonProgress, LessonResult, SongMastery } from '@/core/curriculum/types';
import type { PracticeSession } from '@/core/session/sessionTypes';
import type { AdaptationState } from '@/core/adaptive/adaptive';
import { isHandsMastered } from '@/core/progression/progressionService';

export interface Repository {
  loadPlayerState(): Promise<PlayerState | null>;
  savePlayerState(state: PlayerState): Promise<void>;

  loadAllSkillProgress(): Promise<SkillProgress[]>;
  saveSkillProgress(progress: SkillProgress[]): Promise<void>;

  getChartBestStars(chartId: string): Promise<number>;
  setChartBestStars(chartId: string, stars: number): Promise<void>;
  loadAllChartBest(): Promise<Record<string, number>>;

  /** Honest boss evidence: whether a chart has ever earned the mastery star
   * (chartBest stars alone can be earned assisted). */
  getChartMastery(chartId: string): Promise<boolean>;
  setChartMastery(chartId: string, masteryStar: boolean): Promise<void>;
  loadAllChartMastery(): Promise<Record<string, boolean>>;

  saveAttempt(attempt: Attempt): Promise<void>;
  loadRecentAttempts(limit?: number): Promise<Attempt[]>;

  saveLessonResult(result: LessonResult): Promise<void>;
  loadRecentLessonResults(limit?: number): Promise<LessonResult[]>;
  loadAllLessonProgress(): Promise<LessonProgress[]>;
  saveLessonProgress(progress: LessonProgress[]): Promise<void>;

  loadAllSongMastery(): Promise<SongMastery[]>;
  saveSongMastery(mastery: SongMastery): Promise<void>;

  /** Practice sessions — reporting/wrap bookkeeping only, never progression. */
  saveSession(session: PracticeSession): Promise<void>;
  loadRecentSessions(limit?: number): Promise<PracticeSession[]>;

  /** Per-item adaptive difficulty state, keyed by refId. */
  loadAllAdaptation(): Promise<AdaptationState[]>;
  saveAdaptation(state: AdaptationState): Promise<void>;

  clearAll(): Promise<void>;
}

export function initialPlayerState(): PlayerState {
  return {
    playerLevel: 1,
    totalXP: 0,
    currentPlayingTier: 1,
    learningTier: 1,
    tierHandsXP: 0,
    tierHeadXP: 0,
    tierXpBySong: {},
    tierGatePassedAt: {},
    headTrackXP: 0,
    riffs: 0,
    streak: 0,
    streakFreezes: 2, // start with a couple of freezes (doc 03 §5)
    cosmeticsOwned: [],
    equippedCosmetics: {},
    calibrationOffsetMs: 0,
  };
}

/**
 * Fill Phase-4 fields on a player state persisted by an older schema. Applied
 * on every load (belt-and-braces alongside the Dexie upgrade, and unit-testable
 * without IndexedDB). Level semantics changed in Phase 4 — playerLevel now
 * equals learningTier — so pre-migration users resume at learning tier 1 with
 * all XP/skills/unlocks intact.
 */
export function normalizePlayerState(raw: Partial<PlayerState>): PlayerState {
  const learningTier = raw.learningTier ?? 1;
  return {
    ...initialPlayerState(),
    ...raw,
    learningTier,
    tierHandsXP: raw.tierHandsXP ?? 0,
    tierHeadXP: raw.tierHeadXP ?? 0,
    tierXpBySong: raw.tierXpBySong ?? {},
    tierGatePassedAt: raw.tierGatePassedAt ?? {},
    playerLevel: learningTier,
  };
}

/**
 * Fill Phase-5 fields on a skill-progress row persisted by an older schema:
 * already-Hands-mastered skills get ONE seeded evidence date (from when they
 * mastered), so `assessment.repeatedSessions` can never retro-lock a skill the
 * player already earned. Applied on every load alongside the Dexie upgrade.
 */
export function normalizeSkillProgress(raw: SkillProgress): SkillProgress {
  if (raw.handsEvidenceDates !== undefined) return raw;
  const seedMs = raw.masteredAt ?? raw.lastReviewed;
  const seed =
    isHandsMastered(raw) && seedMs !== undefined
      ? [new Date(seedMs).toISOString().slice(0, 10)]
      : [];
  return { ...raw, handsEvidenceDates: seed };
}
