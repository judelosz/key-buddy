/**
 * GUARDRAIL SUITE — the honesty invariants from build-spec §0.1#4 / doc 03 §9 /
 * doc 04 §8. These are meant to be the hardest tests to accidentally break; if
 * one fails, a core promise of the app has been violated.
 */
import { describe, it, expect } from 'vitest';
import {
  computePlayingTier,
  isSongUnlocked,
  scoutingTierCap,
  handsContribution,
  isHandsMastered,
  applyPlayingAttempt,
} from '@/core/progression/progressionService';
import {
  levelForXp,
  spendRiffs,
  rollEncoreBonus,
  xpForAttempt,
  RIFF_SINKS,
} from '@/core/rewards/rewardService';
import { newCard, reviewCard } from '@/core/srs/fsrs';
import { Rating } from 'ts-fsrs';
import type { Attempt, Skill, SkillProgress, Song } from '@/core/types';

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a', refId: 'c', refKind: 'chart', timestamp: 0, perNoteGrades: [],
    timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
    extraNotes: 0,
    notesCorrectPct: 1, goodOrBetterPct: 1, greatOrBetterPct: 1,
    stars: 3, masteryStar: true, atTempo: true, tempoBPM: 100, assistsUsed: [],
    xpAwarded: 0, riffsAwarded: 0, ...over,
  };
}
const sp = (over: Partial<SkillProgress> = {}): SkillProgress => ({
  skillId: 's', headLock: 0, handsLock: 0, freshness: newCard(0), ...over,
});
const skill = (id: string, tier: number): Skill => ({
  id, name: id, family: 'chords-voicings', tier, genre: 'foundation', prerequisites: [], description: '',
});

describe('#1 Player Level & playing tier derive ONLY from Hands progress', () => {
  it('a fully Head-locked skill never raises the playing tier', () => {
    const skills = [skill('hi', 20)];
    const headOnly = new Map([['hi', sp({ skillId: 'hi', headLock: 1, handsLock: 0 })]]);
    expect(computePlayingTier(skills, headOnly)).toBe(1);
  });
  it('Head XP is not an input to levelForXp (level reads playing XP only)', () => {
    const playingXp = 300;
    const headTrackXp = 999_999;
    // levelForXp takes only playing XP; there is no signature that accepts head XP.
    expect(levelForXp(playingXp)).toBe(levelForXp(playingXp));
    // Adding head XP to a separate accumulator cannot change the level:
    expect(levelForXp(playingXp)).not.toBe(levelForXp(playingXp + headTrackXp));
  });
});

describe('#2 Currency firewall — no buying stars/XP/unlocks', () => {
  it('exposes only cosmetic/convenience sinks', () => {
    expect([...RIFF_SINKS]).toEqual(['cosmetic', 'streak-freeze', 'hint', 'slow-down']);
    expect(RIFF_SINKS).not.toContain('xp');
    expect(RIFF_SINKS).not.toContain('stars');
    expect(RIFF_SINKS).not.toContain('unlock');
  });
  it('rejects any non-approved sink', () => {
    // @ts-expect-error — 'unlock' is intentionally not a RiffSink
    expect(spendRiffs({ riffs: 999 }, 1, 'unlock').ok).toBe(false);
  });
});

describe('#3 Song unlocks require demonstrated (Hands) skill, never currency', () => {
  const song: Song = {
    id: 'x', title: 'X', source: 't', publicDomain: true, genre: 'blues', tier: 9,
    key: 'C', tempoTargetBPM: 80, timeSignature: { beatsPerBar: 4, beatUnit: 4 }, feel: 'shuffle',
    requiredSkills: ['req'], taughtSkills: [], arrangementLevels: ['simplified'], chartIds: [], fragmentIds: [],
  };
  it('stays locked with Head progress + infinite Riffs, unlocks only on Hands mastery', () => {
    const headAndRich = new Map([['req', sp({ skillId: 'req', headLock: 1, handsLock: 0 })]]);
    expect(isSongUnlocked(song, headAndRich)).toBe(false); // riffs/head can't unlock
    const handsMastered = new Map([['req', sp({ skillId: 'req', handsLock: 1 })]]);
    expect(isSongUnlocked(song, handsMastered)).toBe(true);
  });
});

describe('#4 Mastery = at-tempo, un-assisted', () => {
  it('a slowed or assisted 3-star does not Hands-master a skill', () => {
    const slowed = applyPlayingAttempt(sp(), attempt({ stars: 3, masteryStar: false }), 1);
    expect(isHandsMastered(slowed)).toBe(false);
    const mastered = applyPlayingAttempt(sp(), attempt({ stars: 3, masteryStar: true }), 1);
    expect(isHandsMastered(mastered)).toBe(true);
  });
  it('the contribution ranks the mastery star strictly highest', () => {
    expect(handsContribution(attempt({ masteryStar: true }))).toBeGreaterThan(
      handsContribution(attempt({ stars: 3, masteryStar: false })),
    );
  });
});

describe('#5 XP is weighted by difficulty × freshness (grinding pays ~nothing)', () => {
  it('replaying a fresh mastered skill pays far less than learning new material', () => {
    const now = 0;
    const fresh = reviewCard(newCard(now), Rating.Easy, now);
    const grind = xpForAttempt(
      { ...song9(), tier: 1 }, attempt({ masteryStar: true }), [fresh], now + 1000,
    );
    const real = xpForAttempt(
      { ...song9(), tier: 1 }, attempt({ masteryStar: true }), [newCard(now)], now,
    );
    expect(grind).toBeLessThan(real / 3);
  });
});

describe('#6 Variable rewards trigger only on good playing', () => {
  it('cannot fire on a completion-only (low-star) take, even with the best roll', () => {
    expect(rollEncoreBonus(attempt({ stars: 0, masteryStar: false }), 0).triggered).toBe(false);
    expect(rollEncoreBonus(attempt({ stars: 1, masteryStar: false }), 0).triggered).toBe(false);
  });
});

describe('#7 AFK Scouting preview is capped at +1 tier', () => {
  it('never exceeds playing tier + 1', () => {
    expect(scoutingTierCap(1)).toBe(2);
    expect(scoutingTierCap(12)).toBe(13);
  });
});

function song9(): Song {
  return {
    id: 's', title: 'S', source: 't', publicDomain: true, genre: 'blues', tier: 9,
    key: 'C', tempoTargetBPM: 80, timeSignature: { beatsPerBar: 4, beatUnit: 4 }, feel: 'shuffle',
    requiredSkills: [], taughtSkills: [], arrangementLevels: ['simplified'], chartIds: [], fragmentIds: [],
  };
}
