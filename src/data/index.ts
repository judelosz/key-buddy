import type { Attempt, PlayerState, SkillProgress } from '@/core/types';
import type { LessonProgress, LessonResult, SongMastery } from '@/core/curriculum/types';
import type { PracticeSession } from '@/core/session/sessionTypes';
import type { AdaptationState } from '@/core/adaptive/adaptive';
import type { Repository } from './repository';
import { AccountRepository } from './accountRepository';
import { legacyRepository } from './dexieRepository';

let active: Repository = legacyRepository;
let accountRepository: AccountRepository | null = null;

export function configureAccountRepository(userId: string): void {
  accountRepository = new AccountRepository(userId);
  active = accountRepository;
}

export function useLegacyRepository(): void {
  accountRepository = null;
  active = legacyRepository;
}

export function syncAccountProgress(): Promise<void> {
  return accountRepository?.flushPending() ?? Promise.resolve();
}

/** Stable proxy: domain/store imports never need to know which pianist is
 * active, while each authenticated account gets its own local and cloud data. */
export const repository: Repository = {
  loadPlayerState: () => active.loadPlayerState(),
  savePlayerState: (state: PlayerState) => active.savePlayerState(state),
  loadAllSkillProgress: () => active.loadAllSkillProgress(),
  saveSkillProgress: (progress: SkillProgress[]) => active.saveSkillProgress(progress),
  getChartBestStars: (chartId: string) => active.getChartBestStars(chartId),
  setChartBestStars: (chartId: string, stars: number) => active.setChartBestStars(chartId, stars),
  loadAllChartBest: () => active.loadAllChartBest(),
  getChartMastery: (chartId: string) => active.getChartMastery(chartId),
  setChartMastery: (chartId: string, masteryStar: boolean) =>
    active.setChartMastery(chartId, masteryStar),
  loadAllChartMastery: () => active.loadAllChartMastery(),
  saveAttempt: (attempt: Attempt) => active.saveAttempt(attempt),
  loadRecentAttempts: (limit?: number) => active.loadRecentAttempts(limit),
  saveLessonResult: (result: LessonResult) => active.saveLessonResult(result),
  loadRecentLessonResults: (limit?: number) => active.loadRecentLessonResults(limit),
  loadAllLessonProgress: () => active.loadAllLessonProgress(),
  saveLessonProgress: (progress: LessonProgress[]) => active.saveLessonProgress(progress),
  loadAllSongMastery: () => active.loadAllSongMastery(),
  saveSongMastery: (mastery: SongMastery) => active.saveSongMastery(mastery),
  saveSession: (session: PracticeSession) => active.saveSession(session),
  loadRecentSessions: (limit?: number) => active.loadRecentSessions(limit),
  loadAllAdaptation: () => active.loadAllAdaptation(),
  saveAdaptation: (state: AdaptationState) => active.saveAdaptation(state),
  clearAll: () => active.clearAll(),
};
