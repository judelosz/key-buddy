import { describe, it, expect } from 'vitest';
import type { PlayerState, SkillProgress } from '@/core/types';
import { newCard } from '@/core/srs/fsrs';
import {
  initialPlayerState,
  normalizePlayerState,
  mergeLegacySkillIds,
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

describe('mergeLegacySkillIds — the 2026-07-28 tier-1 skill merge', () => {
  const T0 = Date.parse('2026-07-10T12:00:00Z');
  const row = (over: Partial<SkillProgress>): SkillProgress => ({
    skillId: 's',
    handsLock: 0,
    headLock: 0,
    freshness: newCard(T0),
    handsEvidenceDates: [],
    ...over,
  });

  it('folds a stored rhythm-time-sig-44 row into rhythm-steady-pulse without losing evidence', () => {
    const legacy = row({
      skillId: 'rhythm-time-sig-44',
      handsLock: 0.9,
      headLock: 0.4,
      handsEvidenceDates: ['2026-07-08'],
      freshness: { ...newCard(T0), due: T0 + 1000 }, // due sooner
    });
    const survivor = row({
      skillId: 'rhythm-steady-pulse',
      handsLock: 0.6,
      headLock: 0.8,
      handsEvidenceDates: ['2026-07-09'],
      freshness: { ...newCard(T0), due: T0 + 999_999 },
    });
    const merged = mergeLegacySkillIds([legacy, survivor]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      skillId: 'rhythm-steady-pulse',
      handsLock: 0.9,
      headLock: 0.8,
      handsEvidenceDates: ['2026-07-08', '2026-07-09'],
    });
    expect(merged[0].freshness.due).toBe(T0 + 1000); // sooner-due card wins
  });

  it('renames a lone legacy row and leaves unrelated rows alone', () => {
    const merged = mergeLegacySkillIds([
      row({ skillId: 'rhythm-time-sig-44', handsLock: 0.7 }),
      row({ skillId: 'geo-note-names', handsLock: 0.3 }),
    ]);
    expect(merged.map((r) => r.skillId).sort()).toEqual([
      'geo-note-names',
      'rhythm-steady-pulse',
    ]);
    expect(merged.find((r) => r.skillId === 'rhythm-steady-pulse')?.handsLock).toBe(0.7);
  });
});
