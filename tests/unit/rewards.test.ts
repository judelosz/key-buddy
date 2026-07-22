import { describe, it, expect } from 'vitest';
import {
  difficultyMultiplier,
  freshnessMultiplier,
  levelForXp,
  performanceMultiplier,
  riffsForAttempt,
  rollEncoreBonus,
  spendRiffs,
  updateStreak,
  xpForAttempt,
} from '@/core/rewards/rewardService';
import { newCard, reviewCard, starsToRating } from '@/core/srs/fsrs';
import { Rating } from 'ts-fsrs';
import type { Attempt, PlayerState, Song } from '@/core/types';

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
const song = (tier: number): Song => ({
  id: 's', title: 'S', source: 't', publicDomain: true, genre: 'blues', tier,
  key: 'C', tempoTargetBPM: 80, timeSignature: { beatsPerBar: 4, beatUnit: 4 }, feel: 'shuffle',
  requiredSkills: [], taughtSkills: [], arrangementLevels: ['simplified'], chartIds: [], fragmentIds: [],
});
const player = (over: Partial<PlayerState> = {}): PlayerState => ({
  playerLevel: 1, totalXP: 0, currentPlayingTier: 1, learningTier: 1, tierHandsXP: 0,
  tierGatePassedAt: {}, headTrackXP: 0, riffs: 0,
  streak: 0, streakFreezes: 0, cosmeticsOwned: [], equippedCosmetics: {}, calibrationOffsetMs: 0, ...over,
});

describe('XP multipliers', () => {
  it('pays more for harder tiers', () => {
    expect(difficultyMultiplier(6)).toBeGreaterThan(difficultyMultiplier(1));
  });
  it('scales performance by stars and mastery', () => {
    expect(performanceMultiplier(attempt({ masteryStar: true }))).toBe(1.3);
    expect(performanceMultiplier(attempt({ stars: 1, masteryStar: false }))).toBe(0.35);
    expect(performanceMultiplier(attempt({ stars: 0, masteryStar: false }))).toBe(0);
  });
  it('treats a brand-new skill as valuable and a fresh mastered one as cheap', () => {
    const now = 0;
    const fresh = newCard(now);
    // Master it to high stability, then check it "now" (freshly reviewed → high recall).
    const mastered = reviewCard(reviewCard(fresh, Rating.Easy, now), Rating.Easy, now + 1000);
    expect(freshnessMultiplier(fresh, now)).toBeGreaterThan(1); // New material
    expect(freshnessMultiplier(mastered, now + 2000)).toBeLessThan(0.5); // just reviewed
  });
});

describe('xpForAttempt', () => {
  it('pays almost nothing to replay an easy, freshly-mastered skill', () => {
    const now = 0;
    const mastered = reviewCard(newCard(now), Rating.Easy, now);
    const replay = xpForAttempt(song(1), attempt({ masteryStar: true }), [mastered], now + 1000);
    const learnNew = xpForAttempt(song(1), attempt({ masteryStar: true }), [newCard(now)], now);
    expect(replay).toBeLessThan(learnNew);
    expect(replay).toBeLessThan(10);
  });
});

describe('levelForXp', () => {
  it('rises with cumulative playing XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(200)).toBeGreaterThan(levelForXp(0));
  });
});

describe('riffsForAttempt', () => {
  it('rewards a new star, not repetition', () => {
    expect(riffsForAttempt(attempt({ stars: 2 }), 1)).toBeGreaterThan(0);
    expect(riffsForAttempt(attempt({ stars: 2 }), 2)).toBe(0); // no improvement
  });
  it('gives a one-time bonus for the first 3-star', () => {
    expect(riffsForAttempt(attempt({ stars: 3 }), 2)).toBeGreaterThan(
      riffsForAttempt(attempt({ stars: 2 }), 1),
    );
  });
});

describe('spendRiffs (currency firewall)', () => {
  it('allows cosmetic/convenience sinks when affordable', () => {
    expect(spendRiffs({ riffs: 50 }, 20, 'cosmetic')).toEqual({ ok: true, riffs: 30 });
    expect(spendRiffs({ riffs: 50 }, 20, 'streak-freeze')).toEqual({ ok: true, riffs: 30 });
  });
  it('rejects overspending', () => {
    expect(spendRiffs({ riffs: 10 }, 20, 'cosmetic')).toEqual({ ok: false, riffs: 10 });
  });
});

describe('updateStreak', () => {
  it('increments on a consecutive day', () => {
    const r = updateStreak(player({ streak: 3, lastSessionDate: '2026-07-21' }), '2026-07-22');
    expect(r.streak).toBe(4);
  });
  it('does not double-count the same day', () => {
    const r = updateStreak(player({ streak: 3, lastSessionDate: '2026-07-22' }), '2026-07-22');
    expect(r.streak).toBe(3);
  });
  it('resets after a gap with no freeze', () => {
    const r = updateStreak(player({ streak: 9, lastSessionDate: '2026-07-19' }), '2026-07-22');
    expect(r.streak).toBe(1);
    expect(r.usedFreeze).toBe(false);
  });
  it('a freeze saves the streak across a gap', () => {
    const r = updateStreak(player({ streak: 9, streakFreezes: 1, lastSessionDate: '2026-07-20' }), '2026-07-22');
    expect(r.streak).toBe(10);
    expect(r.streakFreezes).toBe(0);
    expect(r.usedFreeze).toBe(true);
  });
});

describe('rollEncoreBonus', () => {
  it('can fire on a good take', () => {
    expect(rollEncoreBonus(attempt({ stars: 3, masteryStar: true }), 0).triggered).toBe(true);
  });
  it('never fires on a weak take, even with the luckiest roll', () => {
    expect(rollEncoreBonus(attempt({ stars: 1, masteryStar: false }), 0).triggered).toBe(false);
  });
});

describe('fsrs grade mapping', () => {
  it('maps stars to ratings', () => {
    expect(starsToRating(0)).toBe(Rating.Again);
    expect(starsToRating(3)).toBe(Rating.Easy);
  });
});
