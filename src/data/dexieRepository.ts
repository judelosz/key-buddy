/**
 * Dexie/IndexedDB implementation of the Repository (build-spec §6 data layer).
 * Local-first, no backend for v1. The DB is opened lazily so importing this
 * module never touches IndexedDB until first use.
 *
 * Schema v2 (Phase 4): lessonResults, lessonProgress, songMastery, and
 * chartMastery tables; playerState gains the learning-tier fields (upgraded
 * in-place, and re-normalized on every load via normalizePlayerState).
 *
 * Schema v3 (Phase 5): sessions + adaptation tables, sessionId indexes on
 * attempts/lessonResults; upgrade normalizes playerState (tierXpBySong),
 * skillProgress (handsEvidenceDates seeding), songMastery (evidence-engine
 * shape) and deletes stretch-song mastery rows created by the Phase-4 bug
 * (a stretch fragment wrongly marked pinetops-boogie "Started").
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Attempt, PlayerState, SkillProgress } from '@/core/types';
import type { LessonProgress, LessonResult, SongMastery } from '@/core/curriculum/types';
import type { PracticeSession } from '@/core/session/sessionTypes';
import type { AdaptationState } from '@/core/adaptive/adaptive';
import { normalizeSongMastery } from '@/core/songMastery/songMastery';
import {
  mergeLegacySkillIds,
  normalizePlayerState,
  normalizeSkillProgress,
  type Repository,
} from './repository';

/** Stretch songs whose Phase-4 SongMastery rows were bogus (fragment-driven). */
const STRETCH_RESET_SONG_IDS = ['pinetops-boogie'];

const PLAYER_ID = 'singleton';

interface PlayerRow extends PlayerState {
  id: string;
}
interface ChartBestRow {
  chartId: string;
  stars: number;
}
interface ChartMasteryRow {
  chartId: string;
  masteryStar: boolean;
}

class PianoDB extends Dexie {
  playerState!: EntityTable<PlayerRow, 'id'>;
  skillProgress!: EntityTable<SkillProgress, 'skillId'>;
  chartBest!: EntityTable<ChartBestRow, 'chartId'>;
  attempts!: EntityTable<Attempt, 'id'>;
  lessonResults!: EntityTable<LessonResult, 'id'>;
  lessonProgress!: EntityTable<LessonProgress, 'lessonId'>;
  songMastery!: EntityTable<SongMastery, 'songId'>;
  chartMastery!: EntityTable<ChartMasteryRow, 'chartId'>;
  sessions!: EntityTable<PracticeSession, 'id'>;
  adaptation!: EntityTable<AdaptationState, 'refId'>;

  constructor() {
    super('piano-pro');
    this.version(1).stores({
      playerState: 'id',
      skillProgress: 'skillId',
      chartBest: 'chartId',
      attempts: 'id, timestamp, refId',
    });
    this.version(2)
      .stores({
        playerState: 'id',
        skillProgress: 'skillId',
        chartBest: 'chartId',
        attempts: 'id, timestamp, refId',
        lessonResults: 'id, lessonId, timestamp',
        lessonProgress: 'lessonId',
        songMastery: 'songId',
        chartMastery: 'chartId',
      })
      .upgrade((tx) =>
        tx
          .table<PlayerRow, string>('playerState')
          .toCollection()
          .modify((row) => {
            const normalized = normalizePlayerState(row);
            Object.assign(row, normalized);
          }),
      );
    this.version(3)
      .stores({
        playerState: 'id',
        skillProgress: 'skillId',
        chartBest: 'chartId',
        attempts: 'id, timestamp, refId, sessionId',
        lessonResults: 'id, lessonId, timestamp, sessionId',
        lessonProgress: 'lessonId',
        songMastery: 'songId',
        chartMastery: 'chartId',
        sessions: 'id, startedAt',
        adaptation: 'refId',
      })
      .upgrade(async (tx) => {
        await tx
          .table<PlayerRow, string>('playerState')
          .toCollection()
          .modify((row) => {
            Object.assign(row, normalizePlayerState(row));
          });
        await tx
          .table<SkillProgress, string>('skillProgress')
          .toCollection()
          .modify((row) => {
            Object.assign(row, normalizeSkillProgress(row));
          });
        await tx.table<SongMastery, string>('songMastery').where('songId').anyOf(STRETCH_RESET_SONG_IDS).delete();
        await tx
          .table<SongMastery, string>('songMastery')
          .toCollection()
          .modify((row) => {
            Object.assign(row, normalizeSongMastery(row));
          });
      });
  }
}

export class DexieRepository implements Repository {
  private db: PianoDB | null = null;

  private get(): PianoDB {
    this.db ??= new PianoDB();
    return this.db;
  }

  async loadPlayerState(): Promise<PlayerState | null> {
    const row = await this.get().playerState.get(PLAYER_ID);
    if (!row) return null;
    const { id: _id, ...state } = row;
    void _id;
    return normalizePlayerState(state);
  }

  async savePlayerState(state: PlayerState): Promise<void> {
    await this.get().playerState.put({ ...state, id: PLAYER_ID });
  }

  async loadAllSkillProgress(): Promise<SkillProgress[]> {
    const rows = await this.get().skillProgress.toArray();
    return mergeLegacySkillIds(rows.map(normalizeSkillProgress));
  }

  async saveSkillProgress(progress: SkillProgress[]): Promise<void> {
    if (progress.length === 0) return;
    await this.get().skillProgress.bulkPut(progress);
  }

  async getChartBestStars(chartId: string): Promise<number> {
    const row = await this.get().chartBest.get(chartId);
    return row?.stars ?? 0;
  }

  async setChartBestStars(chartId: string, stars: number): Promise<void> {
    await this.get().chartBest.put({ chartId, stars });
  }

  async loadAllChartBest(): Promise<Record<string, number>> {
    const rows = await this.get().chartBest.toArray();
    return Object.fromEntries(rows.map((r) => [r.chartId, r.stars]));
  }

  async getChartMastery(chartId: string): Promise<boolean> {
    const row = await this.get().chartMastery.get(chartId);
    return row?.masteryStar ?? false;
  }

  async setChartMastery(chartId: string, masteryStar: boolean): Promise<void> {
    await this.get().chartMastery.put({ chartId, masteryStar });
  }

  async loadAllChartMastery(): Promise<Record<string, boolean>> {
    const rows = await this.get().chartMastery.toArray();
    return Object.fromEntries(rows.map((r) => [r.chartId, r.masteryStar]));
  }

  async saveAttempt(attempt: Attempt): Promise<void> {
    await this.get().attempts.put(attempt);
  }

  async loadRecentAttempts(limit = 50): Promise<Attempt[]> {
    return this.get().attempts.orderBy('timestamp').reverse().limit(limit).toArray();
  }

  async saveLessonResult(result: LessonResult): Promise<void> {
    await this.get().lessonResults.put(result);
  }

  async loadRecentLessonResults(limit = 100): Promise<LessonResult[]> {
    return this.get().lessonResults.orderBy('timestamp').reverse().limit(limit).toArray();
  }

  async loadAllLessonProgress(): Promise<LessonProgress[]> {
    return this.get().lessonProgress.toArray();
  }

  async saveLessonProgress(progress: LessonProgress[]): Promise<void> {
    if (progress.length === 0) return;
    await this.get().lessonProgress.bulkPut(progress);
  }

  async loadAllSongMastery(): Promise<SongMastery[]> {
    const rows = await this.get().songMastery.toArray();
    return rows.map(normalizeSongMastery);
  }

  async saveSongMastery(mastery: SongMastery): Promise<void> {
    await this.get().songMastery.put(mastery);
  }

  async saveSession(session: PracticeSession): Promise<void> {
    await this.get().sessions.put(session);
  }

  async loadRecentSessions(limit = 30): Promise<PracticeSession[]> {
    return this.get().sessions.orderBy('startedAt').reverse().limit(limit).toArray();
  }

  async loadAllAdaptation(): Promise<AdaptationState[]> {
    return this.get().adaptation.toArray();
  }

  async saveAdaptation(state: AdaptationState): Promise<void> {
    await this.get().adaptation.put(state);
  }

  async clearAll(): Promise<void> {
    const db = this.get();
    await Promise.all([
      db.playerState.clear(),
      db.skillProgress.clear(),
      db.chartBest.clear(),
      db.attempts.clear(),
      db.lessonResults.clear(),
      db.lessonProgress.clear(),
      db.songMastery.clear(),
      db.chartMastery.clear(),
      db.sessions.clear(),
      db.adaptation.clear(),
    ]);
  }
}

export const repository: Repository = new DexieRepository();
