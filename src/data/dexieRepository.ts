/**
 * Dexie/IndexedDB implementation of the Repository (build-spec §6 data layer).
 * Local-first, no backend for v1. The DB is opened lazily so importing this
 * module never touches IndexedDB until first use.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Attempt, PlayerState, SkillProgress } from '@/core/types';
import type { Repository } from './repository';

const PLAYER_ID = 'singleton';

interface PlayerRow extends PlayerState {
  id: string;
}
interface ChartBestRow {
  chartId: string;
  stars: number;
}

class PianoDB extends Dexie {
  playerState!: EntityTable<PlayerRow, 'id'>;
  skillProgress!: EntityTable<SkillProgress, 'skillId'>;
  chartBest!: EntityTable<ChartBestRow, 'chartId'>;
  attempts!: EntityTable<Attempt, 'id'>;

  constructor() {
    super('piano-pro');
    this.version(1).stores({
      playerState: 'id',
      skillProgress: 'skillId',
      chartBest: 'chartId',
      attempts: 'id, timestamp, refId',
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
    return state;
  }

  async savePlayerState(state: PlayerState): Promise<void> {
    await this.get().playerState.put({ ...state, id: PLAYER_ID });
  }

  async loadAllSkillProgress(): Promise<SkillProgress[]> {
    return this.get().skillProgress.toArray();
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

  async saveAttempt(attempt: Attempt): Promise<void> {
    await this.get().attempts.put(attempt);
  }

  async loadRecentAttempts(limit = 50): Promise<Attempt[]> {
    return this.get().attempts.orderBy('timestamp').reverse().limit(limit).toArray();
  }

  async clearAll(): Promise<void> {
    const db = this.get();
    await Promise.all([
      db.playerState.clear(),
      db.skillProgress.clear(),
      db.chartBest.clear(),
      db.attempts.clear(),
    ]);
  }
}

export const repository: Repository = new DexieRepository();
