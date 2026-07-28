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
  applyExerciseAttempt,
  EXERCISE_HANDS_CAP,
  HANDS_THRESHOLD,
} from '@/core/progression/progressionService';
import {
  levelForXp,
  spendRiffs,
  rollEncoreBonus,
  xpForAttempt,
  RIFF_SINKS,
} from '@/core/rewards/rewardService';
import { awardHeadXp } from '@/core/rewards/lessonXp';
import { applyGateAdvance } from '@/core/curriculum/tierGate';
import type { Assessment, TierGate } from '@/core/curriculum/types';
import { newCard, reviewCard } from '@/core/srs/fsrs';
import { Rating } from 'ts-fsrs';
import type { Attempt, PlayerState, Skill, SkillProgress, Song } from '@/core/types';
import { initialPlayerState } from '@/data/repository';

const basePlayer = (): PlayerState => initialPlayerState();

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
const sp = (over: Partial<SkillProgress> = {}): SkillProgress => ({
  skillId: 's', headLock: 0, handsLock: 0, freshness: newCard(0), ...over,
});
const skill = (id: string, tier: number): Skill => ({
  id, name: id, family: 'chords-voicings', tier, genre: 'foundation', prerequisites: [], description: '',
});

describe('#1 Head evidence can GATE but never SUBSTITUTE (level & tier from Hands)', () => {
  // Phase-4 refinement: a tier gate may REQUIRE a theory/ear checkpoint
  // (necessary condition), but Head/theory work alone can never raise
  // learningTier, playerLevel, or currentPlayingTier.
  it('a fully Head-locked skill never raises the playing tier', () => {
    const skills = [skill('hi', 20)];
    const headOnly = new Map([['hi', sp({ skillId: 'hi', headLock: 1, handsLock: 0 })]]);
    expect(computePlayingTier(skills, headOnly)).toBe(1);
  });
  it('perfect Head evidence everywhere cannot advance the learning tier', () => {
    const gate: TierGate = {
      tier: 1,
      coreSkillIds: ['s1'],
      bossSongId: 'boss',
      bossChartId: 'boss--simplified',
      checkpointAssessmentIds: ['assess'],
      requiresDelayedReview: false,
      handsXpBand: 1, // trivially reachable — Hands mastery is what's missing
    };
    const assessments: Assessment[] = [
      { id: 'assess', scope: 'tier', tier: 1, lessonId: 'quiz', passScorePct: 0.8, remediationLessonIds: [] },
    ];
    // 100% on the theory/ear checkpoint, Head lock maxed, boss never mastered.
    const player: PlayerState = { ...basePlayer(), tierHandsXP: 999 };
    const { player: after, tierAdvanced } = applyGateAdvance(
      player,
      {
        tierGates: [gate],
        assessments,
        skillProgressById: new Map([['s1', sp({ skillId: 's1', headLock: 1 })]]),
        lessonProgressById: new Map([
          ['quiz', { lessonId: 'quiz', bestScorePct: 1, attempts: 9, attemptsOnLastDate: 1 }],
        ]),
        chartMasteryById: new Map(),
      },
      0,
    );
    expect(tierAdvanced).toBe(false);
    expect(after.learningTier).toBe(1);
    expect(after.playerLevel).toBe(1);
  });
  it('Head XP accumulates on its own track and never moves level or tier', () => {
    const before = basePlayer();
    const after = awardHeadXp(before, 999_999);
    expect(after.headTrackXP).toBe(999_999);
    // The per-tier display meter fills too — and a maxed-out head band still
    // changes NO gate input (2026-07-28: headXpBand is display-only).
    expect(after.tierHeadXP).toBe(999_999);
    expect(after.totalXP).toBe(before.totalXP);
    expect(after.tierHandsXP).toBe(before.tierHandsXP);
    expect(after.playerLevel).toBe(before.playerLevel);
    expect(after.learningTier).toBe(before.learningTier);
    // The legacy XP-level curve still ignores head XP by construction.
    expect(levelForXp(300)).not.toBe(levelForXp(300 + 999_999));
  });
});

describe('#1b Exercises can never Hands-master a skill (cap < threshold)', () => {
  it('a perfect independent exercise stays below the mastery threshold', () => {
    expect(EXERCISE_HANDS_CAP).toBeLessThan(HANDS_THRESHOLD);
    const p = applyExerciseAttempt(sp(), 1, 'independent', 1);
    expect(isHandsMastered(p)).toBe(false);
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
