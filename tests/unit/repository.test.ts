import { describe, it, expect } from 'vitest';
import type { PlayerState, SkillProgress } from '@/core/types';
import { newCard } from '@/core/srs/fsrs';
import {
  initialPlayerState,
  normalizePlayerState,
  normalizeSkillProgress,
} from '@/data/repository';

describe('normalizePlayerState', () => {
  it('fills Phase-4 fields on a v1 state and keeps earned progress', () => {
    // A player state as persisted by schema v1 (no learning-tier fields).
    const v1 = {
      playerLevel: 4, // old XP-derived level
      totalXP: 730,
      currentPlayingTier: 6,
      headTrackXP: 0,
      riffs: 55,
      streak: 3,
      streakFreezes: 1,
      lastSessionDate: '2026-07-20',
      cosmeticsOwned: [],
      equippedCosmetics: {},
      calibrationOffsetMs: -12,
    } as Partial<PlayerState>;

    const norm = normalizePlayerState(v1);
    // Nothing earned is deleted…
    expect(norm.totalXP).toBe(730);
    expect(norm.currentPlayingTier).toBe(6);
    expect(norm.riffs).toBe(55);
    expect(norm.streak).toBe(3);
    expect(norm.calibrationOffsetMs).toBe(-12);
    // …but level semantics change: Level = learning tier (gates passed + 1).
    expect(norm.learningTier).toBe(1);
    expect(norm.playerLevel).toBe(1);
    expect(norm.tierHandsXP).toBe(0);
    expect(norm.tierGatePassedAt).toEqual({});
    expect(norm.onboardedAt).toBeUndefined();
  });

  it('re-derives playerLevel from learningTier even if they drifted', () => {
    const state: PlayerState = {
      ...initialPlayerState(),
      learningTier: 3,
      playerLevel: 9,
    };
    expect(normalizePlayerState(state).playerLevel).toBe(3);
  });

  it('is a no-op on an already-current state', () => {
    const state: PlayerState = {
      ...initialPlayerState(),
      learningTier: 2,
      playerLevel: 2,
      tierHandsXP: 40,
      tierGatePassedAt: { 1: 1_700_000_000_000 },
      onboardedAt: 1_700_000_000_000,
      totalXP: 500,
    };
    expect(normalizePlayerState(state)).toEqual(state);
  });
});

describe('normalizeSkillProgress', () => {
  const MASTERED_AT = Date.parse('2026-07-10T12:00:00Z');
  const base: SkillProgress = {
    skillId: 's',
    handsLock: 0.9,
    headLock: 0.9,
    masteredAt: MASTERED_AT,
    freshness: newCard(MASTERED_AT),
    lastReviewed: MASTERED_AT,
  };

  it('seeds one evidence date for an already-Hands-mastered pre-v3 skill', () => {
    const norm = normalizeSkillProgress(base);
    expect(norm.handsEvidenceDates).toEqual(['2026-07-10']);
  });

  it('gives unmastered skills an empty evidence list', () => {
    const norm = normalizeSkillProgress({ ...base, handsLock: 0.5, masteredAt: undefined });
    expect(norm.handsEvidenceDates).toEqual([]);
  });

  it('never touches rows that already carry evidence', () => {
    const current = { ...base, handsEvidenceDates: ['2026-07-01', '2026-07-05'] };
    expect(normalizeSkillProgress(current)).toBe(current);
  });
});
