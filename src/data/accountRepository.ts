import type { Attempt, PlayerState, SkillProgress } from '@/core/types';
import type { LessonProgress, LessonResult, SongMastery } from '@/core/curriculum/types';
import type { PracticeSession } from '@/core/session/sessionTypes';
import type { AdaptationState } from '@/core/adaptive/adaptive';
import type { Repository } from './repository';
import { CloudRepository } from './cloudRepository';
import { DexieRepository, legacyRepository, type SyncOperation } from './dexieRepository';
import { setSyncState } from './syncStore';
import { getSupabaseClient } from '@/auth/supabase';

type Source = 'unknown' | 'cloud' | 'account-local' | 'legacy';

type AccountOperation =
  | { kind: 'save-player'; payload: PlayerState }
  | { kind: 'save-skills'; payload: SkillProgress[] }
  | { kind: 'set-chart-stars'; payload: { chartId: string; stars: number } }
  | { kind: 'set-chart-mastery'; payload: { chartId: string; masteryStar: boolean } }
  | { kind: 'save-attempt'; payload: Attempt }
  | { kind: 'save-lesson-result'; payload: LessonResult }
  | { kind: 'save-lesson-progress'; payload: LessonProgress[] }
  | { kind: 'save-song-mastery'; payload: SongMastery }
  | { kind: 'save-session'; payload: PracticeSession }
  | { kind: 'save-adaptation'; payload: AdaptationState };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Cloud sync failed';
}

function operationPayload<T>(operation: SyncOperation): T {
  if (typeof operation.payload !== 'object' || operation.payload === null) {
    throw new Error(`Invalid queued ${operation.kind} operation`);
  }
  return operation.payload as T;
}

/** Local-first account repository: every write lands in the user's IndexedDB
 * first, then enters an idempotent write-behind queue for Supabase. On startup
 * the queue flushes before cloud state is pulled, so offline work wins over an
 * older server copy without making a stale clean cache authoritative. */
export class AccountRepository implements Repository {
  private readonly local: DexieRepository;
  private readonly cloud: CloudRepository;
  private source: Source = 'unknown';
  private flushPromise: Promise<void> | null = null;

  constructor(userId: string) {
    this.local = new DexieRepository(`piano-pro-account-${userId}`);
    this.cloud = new CloudRepository(getSupabaseClient(), userId);
  }

  private async applyOperation(operation: SyncOperation): Promise<void> {
    switch (operation.kind) {
      case 'save-player':
        return this.cloud.savePlayerState(operationPayload<PlayerState>(operation));
      case 'save-skills':
        return this.cloud.saveSkillProgress(operationPayload<SkillProgress[]>(operation));
      case 'set-chart-stars': {
        const payload = operationPayload<{ chartId: string; stars: number }>(operation);
        return this.cloud.setChartBestStars(payload.chartId, payload.stars);
      }
      case 'set-chart-mastery': {
        const payload = operationPayload<{ chartId: string; masteryStar: boolean }>(operation);
        return this.cloud.setChartMastery(payload.chartId, payload.masteryStar);
      }
      case 'save-attempt':
        return this.cloud.saveAttempt(operationPayload<Attempt>(operation));
      case 'save-lesson-result':
        return this.cloud.saveLessonResult(operationPayload<LessonResult>(operation));
      case 'save-lesson-progress':
        return this.cloud.saveLessonProgress(operationPayload<LessonProgress[]>(operation));
      case 'save-song-mastery':
        return this.cloud.saveSongMastery(operationPayload<SongMastery>(operation));
      case 'save-session':
        return this.cloud.saveSession(operationPayload<PracticeSession>(operation));
      case 'save-adaptation':
        return this.cloud.saveAdaptation(operationPayload<AdaptationState>(operation));
      default:
        throw new Error(`Unknown queued operation: ${operation.kind}`);
    }
  }

  private async doFlush(): Promise<void> {
    try {
      while (true) {
        const operations = await this.local.loadSyncOperations();
        if (operations.length === 0) break;
        setSyncState({ status: 'saving', pending: operations.length });
        for (const operation of operations) {
          await this.applyOperation(operation);
          await this.local.deleteSyncOperation(operation.id);
        }
      }
      setSyncState({ status: 'saved', pending: 0 });
    } catch (error) {
      const pending = (await this.local.loadSyncOperations()).length;
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setSyncState({
        status: offline ? 'offline' : 'error',
        pending,
        message: messageOf(error),
      });
    }
  }

  flushPending(): Promise<void> {
    this.flushPromise ??= this.doFlush().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private async enqueue(operation: AccountOperation): Promise<void> {
    await this.local.enqueueSyncOperation({
      id: crypto.randomUUID(),
      kind: operation.kind,
      payload: operation.payload,
      createdAt: Date.now(),
    });
    await this.flushPending();
  }

  private async importPlayer(state: PlayerState): Promise<void> {
    await this.local.savePlayerState(state);
    await this.enqueue({ kind: 'save-player', payload: state });
  }

  async loadPlayerState(): Promise<PlayerState | null> {
    await this.flushPending();
    const accountLocal = await this.local.loadPlayerState();
    try {
      const cloud = await this.cloud.loadPlayerState();
      if (cloud) {
        this.source = 'cloud';
        await this.local.savePlayerState(cloud);
        return cloud;
      }
      if (accountLocal) {
        this.source = 'account-local';
        await this.importPlayer(accountLocal);
        return accountLocal;
      }
      const legacy = await legacyRepository.loadPlayerState();
      if (legacy) {
        this.source = 'legacy';
        await this.importPlayer(legacy);
        return legacy;
      }
      this.source = 'cloud';
      return null;
    } catch (error) {
      const legacy = accountLocal ? null : await legacyRepository.loadPlayerState();
      this.source = accountLocal ? 'account-local' : legacy ? 'legacy' : 'cloud';
      setSyncState({ status: 'offline', pending: 0, message: messageOf(error) });
      return accountLocal ?? legacy;
    }
  }

  async savePlayerState(state: PlayerState): Promise<void> {
    await this.local.savePlayerState(state);
    await this.enqueue({ kind: 'save-player', payload: state });
  }

  private async sourceSkills(): Promise<SkillProgress[]> {
    return this.source === 'legacy'
      ? legacyRepository.loadAllSkillProgress()
      : this.local.loadAllSkillProgress();
  }

  async loadAllSkillProgress(): Promise<SkillProgress[]> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadAllSkillProgress();
        await this.local.saveSkillProgress(rows);
        return rows;
      } catch {
        return this.local.loadAllSkillProgress();
      }
    }
    const rows = await this.sourceSkills();
    await this.local.saveSkillProgress(rows);
    await this.enqueue({ kind: 'save-skills', payload: rows });
    return rows;
  }

  async saveSkillProgress(progress: SkillProgress[]): Promise<void> {
    await this.local.saveSkillProgress(progress);
    await this.enqueue({ kind: 'save-skills', payload: progress });
  }

  async getChartBestStars(chartId: string): Promise<number> {
    return (await this.loadAllChartBest())[chartId] ?? 0;
  }

  async setChartBestStars(chartId: string, stars: number): Promise<void> {
    await this.local.setChartBestStars(chartId, stars);
    await this.enqueue({ kind: 'set-chart-stars', payload: { chartId, stars } });
  }

  async loadAllChartBest(): Promise<Record<string, number>> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadAllChartBest();
        await Promise.all(Object.entries(rows).map(([id, stars]) => this.local.setChartBestStars(id, stars)));
        return rows;
      } catch {
        return this.local.loadAllChartBest();
      }
    }
    const rows =
      this.source === 'legacy'
        ? await legacyRepository.loadAllChartBest()
        : await this.local.loadAllChartBest();
    for (const [chartId, stars] of Object.entries(rows)) {
      await this.local.setChartBestStars(chartId, stars);
      await this.enqueue({ kind: 'set-chart-stars', payload: { chartId, stars } });
    }
    return rows;
  }

  async getChartMastery(chartId: string): Promise<boolean> {
    return (await this.loadAllChartMastery())[chartId] ?? false;
  }

  async setChartMastery(chartId: string, masteryStar: boolean): Promise<void> {
    await this.local.setChartMastery(chartId, masteryStar);
    await this.enqueue({ kind: 'set-chart-mastery', payload: { chartId, masteryStar } });
  }

  async loadAllChartMastery(): Promise<Record<string, boolean>> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadAllChartMastery();
        await Promise.all(
          Object.entries(rows).map(([id, mastered]) => this.local.setChartMastery(id, mastered)),
        );
        return rows;
      } catch {
        return this.local.loadAllChartMastery();
      }
    }
    const rows =
      this.source === 'legacy'
        ? await legacyRepository.loadAllChartMastery()
        : await this.local.loadAllChartMastery();
    for (const [chartId, masteryStar] of Object.entries(rows)) {
      await this.local.setChartMastery(chartId, masteryStar);
      await this.enqueue({ kind: 'set-chart-mastery', payload: { chartId, masteryStar } });
    }
    return rows;
  }

  async saveAttempt(attempt: Attempt): Promise<void> {
    await this.local.saveAttempt(attempt);
    await this.enqueue({ kind: 'save-attempt', payload: attempt });
  }

  async loadRecentAttempts(limit = 50): Promise<Attempt[]> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadRecentAttempts(limit);
        await Promise.all(rows.map((row) => this.local.saveAttempt(row)));
        return rows;
      } catch {
        return this.local.loadRecentAttempts(limit);
      }
    }
    const rows =
      this.source === 'legacy'
        ? await legacyRepository.loadRecentAttempts(limit)
        : await this.local.loadRecentAttempts(limit);
    for (const row of rows) {
      await this.local.saveAttempt(row);
      await this.enqueue({ kind: 'save-attempt', payload: row });
    }
    return rows;
  }

  async saveLessonResult(result: LessonResult): Promise<void> {
    await this.local.saveLessonResult(result);
    await this.enqueue({ kind: 'save-lesson-result', payload: result });
  }

  async loadRecentLessonResults(limit = 100): Promise<LessonResult[]> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadRecentLessonResults(limit);
        await Promise.all(rows.map((row) => this.local.saveLessonResult(row)));
        return rows;
      } catch {
        return this.local.loadRecentLessonResults(limit);
      }
    }
    const rows =
      this.source === 'legacy'
        ? await legacyRepository.loadRecentLessonResults(limit)
        : await this.local.loadRecentLessonResults(limit);
    for (const row of rows) {
      await this.local.saveLessonResult(row);
      await this.enqueue({ kind: 'save-lesson-result', payload: row });
    }
    return rows;
  }

  async loadAllLessonProgress(): Promise<LessonProgress[]> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadAllLessonProgress();
        await this.local.saveLessonProgress(rows);
        return rows;
      } catch {
        return this.local.loadAllLessonProgress();
      }
    }
    const rows =
      this.source === 'legacy'
        ? await legacyRepository.loadAllLessonProgress()
        : await this.local.loadAllLessonProgress();
    await this.local.saveLessonProgress(rows);
    await this.enqueue({ kind: 'save-lesson-progress', payload: rows });
    return rows;
  }

  async saveLessonProgress(progress: LessonProgress[]): Promise<void> {
    await this.local.saveLessonProgress(progress);
    await this.enqueue({ kind: 'save-lesson-progress', payload: progress });
  }

  async loadAllSongMastery(): Promise<SongMastery[]> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadAllSongMastery();
        await Promise.all(rows.map((row) => this.local.saveSongMastery(row)));
        return rows;
      } catch {
        return this.local.loadAllSongMastery();
      }
    }
    const rows =
      this.source === 'legacy'
        ? await legacyRepository.loadAllSongMastery()
        : await this.local.loadAllSongMastery();
    for (const row of rows) {
      await this.local.saveSongMastery(row);
      await this.enqueue({ kind: 'save-song-mastery', payload: row });
    }
    return rows;
  }

  async saveSongMastery(mastery: SongMastery): Promise<void> {
    await this.local.saveSongMastery(mastery);
    await this.enqueue({ kind: 'save-song-mastery', payload: mastery });
  }

  async saveSession(session: PracticeSession): Promise<void> {
    await this.local.saveSession(session);
    await this.enqueue({ kind: 'save-session', payload: session });
  }

  async loadRecentSessions(limit = 30): Promise<PracticeSession[]> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadRecentSessions(limit);
        await Promise.all(rows.map((row) => this.local.saveSession(row)));
        return rows;
      } catch {
        return this.local.loadRecentSessions(limit);
      }
    }
    const rows =
      this.source === 'legacy'
        ? await legacyRepository.loadRecentSessions(limit)
        : await this.local.loadRecentSessions(limit);
    for (const row of rows) {
      await this.local.saveSession(row);
      await this.enqueue({ kind: 'save-session', payload: row });
    }
    return rows;
  }

  async loadAllAdaptation(): Promise<AdaptationState[]> {
    if (this.source === 'cloud') {
      try {
        const rows = await this.cloud.loadAllAdaptation();
        await Promise.all(rows.map((row) => this.local.saveAdaptation(row)));
        return rows;
      } catch {
        return this.local.loadAllAdaptation();
      }
    }
    const rows =
      this.source === 'legacy'
        ? await legacyRepository.loadAllAdaptation()
        : await this.local.loadAllAdaptation();
    for (const row of rows) {
      await this.local.saveAdaptation(row);
      await this.enqueue({ kind: 'save-adaptation', payload: row });
    }
    return rows;
  }

  async saveAdaptation(state: AdaptationState): Promise<void> {
    await this.local.saveAdaptation(state);
    await this.enqueue({ kind: 'save-adaptation', payload: state });
  }

  async clearAll(): Promise<void> {
    setSyncState({ status: 'saving', pending: 0 });
    await this.cloud.clearAll();
    await this.local.clearAll();
    setSyncState({ status: 'saved', pending: 0 });
  }
}
