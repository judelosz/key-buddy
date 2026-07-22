import { describe, it, expect } from 'vitest';
import { recordChartAttempt } from '@/core/session/recordAttempt';
import { initialPlayerState } from '@/data/repository';
import { isHandsMastered } from '@/core/progression/progressionService';
import type { Attempt, Skill, Song } from '@/core/types';

const skill = (id: string, tier: number): Skill => ({
  id, name: id, family: 'chords-voicings', tier, genre: 'foundation', prerequisites: [], description: '',
});
const song = (id: string, tier: number, req: string[], taught: string[]): Song => ({
  id, title: id, source: 't', publicDomain: true, genre: 'foundation', tier,
  key: 'C', tempoTargetBPM: 90, timeSignature: { beatsPerBar: 4, beatUnit: 4 }, feel: 'straight',
  requiredSkills: req, taughtSkills: taught, arrangementLevels: ['simplified'], chartIds: [], fragmentIds: [],
});
function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a', refId: 'chart', refKind: 'chart', timestamp: 0, perNoteGrades: [],
    timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
    wrongNotes: [],
    extraNotes: 0,
    notesCorrectPct: 1, goodOrBetterPct: 1, greatOrBetterPct: 1,
    stars: 3, masteryStar: true, atTempo: true, tempoBPM: 90, assistsUsed: [],
    xpAwarded: 0, riffsAwarded: 0, ...over,
  };
}

const skills = [skill('a', 1), skill('b', 6)];
const entry = song('entry', 1, [], ['a', 'b']);
const gated = song('gated', 6, ['a', 'b'], []);

describe('recordChartAttempt', () => {
  it('mastering the entry song unlocks the gated song and rewards real progress', () => {
    const res = recordChartAttempt({
      song: entry,
      attempt: attempt({ masteryStar: true, stars: 3 }),
      playerState: initialPlayerState(),
      skillProgressById: new Map(),
      prevBestStars: 0,
      allSkills: skills,
      allSongs: [entry, gated],
      nowMs: 1_000_000,
      todayISO: '2026-07-22',
      rand: 1, // no encore, keeps assertions deterministic
    });

    // Skills a & b are now Hands-mastered.
    const byId = new Map(res.changedSkills.map((s) => [s.skillId, s]));
    expect(isHandsMastered(byId.get('a')!)).toBe(true);
    expect(isHandsMastered(byId.get('b')!)).toBe(true);

    // Gated song is newly unlocked; tier rises to b's tier; rewards given.
    expect(res.reward.newlyUnlockedSongIds).toContain('gated');
    expect(res.playerState.currentPlayingTier).toBe(6);
    expect(res.reward.xp).toBeGreaterThan(0);
    expect(res.reward.riffs).toBeGreaterThan(0);
    expect(res.reward.newStar).toBe(true);
    expect(res.playerState.streak).toBe(1);
    expect(res.chartBestStars).toBe(3);
    expect(res.attempt.xpAwarded).toBe(res.reward.xp);
  });

  it('a repeat of an already-mastered chart pays almost nothing and unlocks nothing new', () => {
    const first = recordChartAttempt({
      song: entry, attempt: attempt(), playerState: initialPlayerState(),
      skillProgressById: new Map(), prevBestStars: 0,
      allSkills: skills, allSongs: [entry, gated], nowMs: 1_000_000, todayISO: '2026-07-22', rand: 1,
    });
    const map = new Map(first.changedSkills.map((s) => [s.skillId, s]));
    const second = recordChartAttempt({
      song: entry, attempt: attempt(), playerState: first.playerState,
      skillProgressById: map, prevBestStars: 3,
      allSkills: skills, allSongs: [entry, gated], nowMs: 1_000_500, todayISO: '2026-07-22', rand: 1,
    });
    expect(second.reward.newStar).toBe(false);
    expect(second.reward.riffs).toBe(0); // no improvement → no riffs
    expect(second.reward.xp).toBeLessThan(first.reward.xp / 2); // freshness collapses
    expect(second.reward.newlyUnlockedSongIds).toEqual([]);
  });
});
