import type { SupabaseClient } from '@supabase/supabase-js';
import type { Attempt, PlayerState, SkillProgress } from '@/core/types';
import type { LessonProgress, LessonResult, SongMastery } from '@/core/curriculum/types';
import type { PracticeSession } from '@/core/session/sessionTypes';
import type { AdaptationState } from '@/core/adaptive/adaptive';
import {
  mergeLegacySkillIds,
  normalizePlayerState,
  normalizeSkillProgress,
  type Repository,
} from './repository';
import { normalizeSongMastery } from '@/core/songMastery/songMastery';

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label} payload received from cloud storage`);
  }
}

function payloadAs<T>(value: unknown, label: string): T {
  assertObject(value, label);
  return value as T;
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Supabase/Postgres implementation. RLS still checks ownership on every query;
 * userId is included to make the intended access path explicit and indexable. */
export class CloudRepository implements Repository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async loadPlayerState(): Promise<PlayerState | null> {
    const { data, error } = await this.client
      .from('player_state')
      .select('data')
      .eq('user_id', this.userId)
      .maybeSingle();
    throwIfError(error);
    return data ? normalizePlayerState(payloadAs<Partial<PlayerState>>(data.data, 'player state')) : null;
  }

  async savePlayerState(state: PlayerState): Promise<void> {
    const { error } = await this.client
      .from('player_state')
      .upsert({ user_id: this.userId, data: state }, { onConflict: 'user_id' });
    throwIfError(error);
  }

  async loadAllSkillProgress(): Promise<SkillProgress[]> {
    const { data, error } = await this.client
      .from('skill_progress')
      .select('data')
      .eq('user_id', this.userId);
    throwIfError(error);
    const rows = (data ?? []).map((row) =>
      normalizeSkillProgress(payloadAs<SkillProgress>(row.data, 'skill progress')),
    );
    return mergeLegacySkillIds(rows);
  }

  async saveSkillProgress(progress: SkillProgress[]): Promise<void> {
    if (progress.length === 0) return;
    const rows = progress.map((item) => ({
      user_id: this.userId,
      skill_id: item.skillId,
      data: item,
    }));
    const { error } = await this.client
      .from('skill_progress')
      .upsert(rows, { onConflict: 'user_id,skill_id' });
    throwIfError(error);
  }

  private async chartRow(chartId: string): Promise<{ bestStars: number; masteryStar: boolean }> {
    const { data, error } = await this.client
      .from('chart_progress')
      .select('best_stars, mastery_star')
      .eq('user_id', this.userId)
      .eq('chart_id', chartId)
      .maybeSingle();
    throwIfError(error);
    return { bestStars: data?.best_stars ?? 0, masteryStar: data?.mastery_star ?? false };
  }

  async getChartBestStars(chartId: string): Promise<number> {
    return (await this.chartRow(chartId)).bestStars;
  }

  async setChartBestStars(chartId: string, stars: number): Promise<void> {
    const { error } = await this.client.rpc('set_chart_best', {
      p_chart_id: chartId,
      p_stars: stars,
    });
    throwIfError(error);
  }

  async loadAllChartBest(): Promise<Record<string, number>> {
    const { data, error } = await this.client
      .from('chart_progress')
      .select('chart_id, best_stars')
      .eq('user_id', this.userId);
    throwIfError(error);
    return Object.fromEntries((data ?? []).map((row) => [row.chart_id, row.best_stars]));
  }

  async getChartMastery(chartId: string): Promise<boolean> {
    return (await this.chartRow(chartId)).masteryStar;
  }

  async setChartMastery(chartId: string, masteryStar: boolean): Promise<void> {
    const { error } = await this.client.rpc('set_chart_mastery', {
      p_chart_id: chartId,
      p_mastery_star: masteryStar,
    });
    throwIfError(error);
  }

  async loadAllChartMastery(): Promise<Record<string, boolean>> {
    const { data, error } = await this.client
      .from('chart_progress')
      .select('chart_id, mastery_star')
      .eq('user_id', this.userId);
    throwIfError(error);
    return Object.fromEntries((data ?? []).map((row) => [row.chart_id, row.mastery_star]));
  }

  async saveAttempt(attempt: Attempt): Promise<void> {
    const { error } = await this.client.from('attempts').upsert(
      {
        user_id: this.userId,
        attempt_id: attempt.id,
        ref_id: attempt.refId,
        session_id: attempt.sessionId ?? null,
        occurred_at: new Date(attempt.timestamp).toISOString(),
        data: attempt,
      },
      { onConflict: 'user_id,attempt_id' },
    );
    throwIfError(error);
  }

  async loadRecentAttempts(limit = 50): Promise<Attempt[]> {
    const { data, error } = await this.client
      .from('attempts')
      .select('data')
      .eq('user_id', this.userId)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    throwIfError(error);
    return (data ?? []).map((row) => payloadAs<Attempt>(row.data, 'attempt'));
  }

  async saveLessonResult(result: LessonResult): Promise<void> {
    const { error } = await this.client.from('lesson_results').upsert(
      {
        user_id: this.userId,
        result_id: result.id,
        lesson_id: result.lessonId,
        session_id: result.sessionId ?? null,
        occurred_at: new Date(result.timestamp).toISOString(),
        data: result,
      },
      { onConflict: 'user_id,result_id' },
    );
    throwIfError(error);
  }

  async loadRecentLessonResults(limit = 100): Promise<LessonResult[]> {
    const { data, error } = await this.client
      .from('lesson_results')
      .select('data')
      .eq('user_id', this.userId)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    throwIfError(error);
    return (data ?? []).map((row) => payloadAs<LessonResult>(row.data, 'lesson result'));
  }

  async loadAllLessonProgress(): Promise<LessonProgress[]> {
    const { data, error } = await this.client
      .from('lesson_progress')
      .select('data')
      .eq('user_id', this.userId);
    throwIfError(error);
    return (data ?? []).map((row) => payloadAs<LessonProgress>(row.data, 'lesson progress'));
  }

  async saveLessonProgress(progress: LessonProgress[]): Promise<void> {
    if (progress.length === 0) return;
    const rows = progress.map((item) => ({
      user_id: this.userId,
      lesson_id: item.lessonId,
      data: item,
    }));
    const { error } = await this.client
      .from('lesson_progress')
      .upsert(rows, { onConflict: 'user_id,lesson_id' });
    throwIfError(error);
  }

  async loadAllSongMastery(): Promise<SongMastery[]> {
    const { data, error } = await this.client
      .from('song_mastery')
      .select('data')
      .eq('user_id', this.userId);
    throwIfError(error);
    return (data ?? []).map((row) =>
      normalizeSongMastery(payloadAs<SongMastery>(row.data, 'song mastery')),
    );
  }

  async saveSongMastery(mastery: SongMastery): Promise<void> {
    const { error } = await this.client.from('song_mastery').upsert(
      { user_id: this.userId, song_id: mastery.songId, data: mastery },
      { onConflict: 'user_id,song_id' },
    );
    throwIfError(error);
  }

  async saveSession(session: PracticeSession): Promise<void> {
    const { error } = await this.client.from('practice_sessions').upsert(
      {
        user_id: this.userId,
        session_id: session.id,
        started_at: new Date(session.startedAt).toISOString(),
        data: session,
      },
      { onConflict: 'user_id,session_id' },
    );
    throwIfError(error);
  }

  async loadRecentSessions(limit = 30): Promise<PracticeSession[]> {
    const { data, error } = await this.client
      .from('practice_sessions')
      .select('data')
      .eq('user_id', this.userId)
      .order('started_at', { ascending: false })
      .limit(limit);
    throwIfError(error);
    return (data ?? []).map((row) => payloadAs<PracticeSession>(row.data, 'practice session'));
  }

  async loadAllAdaptation(): Promise<AdaptationState[]> {
    const { data, error } = await this.client
      .from('adaptation_state')
      .select('data')
      .eq('user_id', this.userId);
    throwIfError(error);
    return (data ?? []).map((row) => payloadAs<AdaptationState>(row.data, 'adaptation state'));
  }

  async saveAdaptation(state: AdaptationState): Promise<void> {
    const { error } = await this.client.from('adaptation_state').upsert(
      { user_id: this.userId, ref_id: state.refId, data: state },
      { onConflict: 'user_id,ref_id' },
    );
    throwIfError(error);
  }

  async clearAll(): Promise<void> {
    const tables = [
      'adaptation_state',
      'practice_sessions',
      'song_mastery',
      'lesson_progress',
      'lesson_results',
      'attempts',
      'chart_progress',
      'skill_progress',
      'player_state',
    ] as const;
    for (const table of tables) {
      const { error } = await this.client.from(table).delete().eq('user_id', this.userId);
      throwIfError(error);
    }
  }
}
