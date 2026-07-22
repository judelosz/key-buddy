import { describe, it, expect } from 'vitest';
import {
  applyPlayingAttempt,
  computePlayingTier,
  handsContribution,
  isGold,
  isHandsMastered,
  isSongUnlocked,
  scoutingTierCap,
  songUnlockProgress,
} from '@/core/progression/progressionService';
import { newCard } from '@/core/srs/fsrs';
import type { Attempt, Skill, SkillProgress, Song } from '@/core/types';

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a', refId: 'c', refKind: 'chart', timestamp: 0, perNoteGrades: [],
    timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
    wrongNotes: [],
    extraNotes: 0,
    notesCorrectPct: 1, goodOrBetterPct: 1, greatOrBetterPct: 1,
    stars: 3, masteryStar: true, atTempo: true, tempoBPM: 100, assistsUsed: [],
    xpAwarded: 0, riffsAwarded: 0, ...over,
  };
}
function sp(over: Partial<SkillProgress> = {}): SkillProgress {
  return { skillId: 's', headLock: 0, handsLock: 0, freshness: newCard(0), ...over };
}
const skill = (id: string, tier: number): Skill => ({
  id, name: id, family: 'chords-voicings', tier, genre: 'foundation', prerequisites: [], description: '',
});

describe('handsContribution', () => {
  it('fully opens the Hands lock only on the mastery star', () => {
    expect(handsContribution(attempt({ masteryStar: true }))).toBe(1);
    expect(handsContribution(attempt({ stars: 3, masteryStar: false }))).toBe(0.8);
    expect(handsContribution(attempt({ stars: 2, masteryStar: false }))).toBe(0.6);
    expect(handsContribution(attempt({ stars: 0, masteryStar: false }))).toBe(0);
  });
});

describe('two-lock mastery', () => {
  it('a mastery-star take opens Hands but does not gold without Head', () => {
    const after = applyPlayingAttempt(sp(), attempt({ masteryStar: true }), 1000);
    expect(isHandsMastered(after)).toBe(true);
    expect(isGold(after)).toBe(false); // Head lock still closed
    expect(after.masteredAt).toBeUndefined();
  });

  it('golds only when both locks pass threshold', () => {
    const after = applyPlayingAttempt(sp({ headLock: 1 }), attempt({ masteryStar: true }), 1000);
    expect(isGold(after)).toBe(true);
    expect(after.masteredAt).toBe(1000);
  });
});

describe('computePlayingTier', () => {
  const skills = [skill('a', 1), skill('b', 6), skill('c', 12)];
  it('is the highest Hands-mastered tier', () => {
    const m = new Map([
      ['a', sp({ skillId: 'a', handsLock: 1 })],
      ['b', sp({ skillId: 'b', handsLock: 1 })],
    ]);
    expect(computePlayingTier(skills, m)).toBe(6);
  });

  it('never counts Head-only progress', () => {
    const m = new Map([['c', sp({ skillId: 'c', headLock: 1, handsLock: 0 })]]);
    expect(computePlayingTier(skills, m)).toBe(1); // head lock alone does not raise tier
  });
});

describe('skill-gated unlocks', () => {
  const song: Song = {
    id: 'x', title: 'X', source: 't', publicDomain: true, genre: 'blues', tier: 6,
    key: 'C', tempoTargetBPM: 80, timeSignature: { beatsPerBar: 4, beatUnit: 4 }, feel: 'shuffle',
    requiredSkills: ['a', 'b'], taughtSkills: [], arrangementLevels: ['simplified'],
    chartIds: [], fragmentIds: [],
  };

  it('locks a song until every required skill is Hands-mastered', () => {
    const partial = new Map([['a', sp({ skillId: 'a', handsLock: 1 })]]);
    expect(isSongUnlocked(song, partial)).toBe(false);
    expect(songUnlockProgress(song, partial)).toMatchObject({
      masteredCount: 1, requiredCount: 2, remainingSkillIds: ['b'], unlocked: false,
    });
  });

  it('unlocks once all required skills are Hands-mastered', () => {
    const full = new Map([
      ['a', sp({ skillId: 'a', handsLock: 1 })],
      ['b', sp({ skillId: 'b', handsLock: 1 })],
    ]);
    expect(isSongUnlocked(song, full)).toBe(true);
  });
});

describe('scouting preview cap', () => {
  it('is exactly +1 tier', () => {
    expect(scoutingTierCap(5)).toBe(6);
  });
});
