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

const chartFx = {
  id: 'chart', songId: 'entry', arrangementLevel: 'simplified' as const,
  timeSignature: { beatsPerBar: 4, beatUnit: 4 }, chordSymbols: [],
  notes: [{ id: 'n1', pitches: [60], startBeat: 0, durationBeats: 1, hand: 'right' as const }],
};

/** Sectioned two-bar chart with perfect grades — a qualifying-capable take. */
const sectionedChart = {
  ...chartFx,
  notes: [
    { id: 'n1', pitches: [60], startBeat: 0, durationBeats: 1, hand: 'right' as const },
    { id: 'n2', pitches: [64], startBeat: 4, durationBeats: 1, hand: 'right' as const },
  ],
  sections: [
    { id: 'A', label: 'A', startBar: 0, endBar: 0 },
    { id: 'B', label: 'B', startBar: 1, endBar: 1 },
  ],
};
const perfectGrades = [
  { noteEventId: 'n1', grade: 'perfect' as const, deviationMs: 5, pitchCorrect: true },
  { noteEventId: 'n2', grade: 'perfect' as const, deviationMs: 5, pitchCorrect: true },
];

const skills = [skill('a', 1), skill('b', 6)];
const entry = song('entry', 1, [], ['a', 'b']);
const gated = song('gated', 6, ['a', 'b'], []);

describe('recordChartAttempt', () => {
  it('a chart-level taughtSkills override credits ONLY the listed skills (arrangement honesty)', () => {
    // The simplified arrangement declares it teaches only 'a' — a mastery take
    // on it must not Hands-master 'b', which only the full arrangement plays.
    const res = recordChartAttempt({
      song: entry,
      chart: { ...chartFx, taughtSkills: ['a'] },
      attempt: attempt({ masteryStar: true, stars: 3 }),
      playerState: initialPlayerState(),
      skillProgressById: new Map(),
      prevBestStars: 0,
      allSkills: skills,
      allSongs: [entry, gated],
      nowMs: 1_000_000,
      todayISO: '2026-07-22',
      rand: 1,
    });
    const byId = new Map(res.changedSkills.map((s) => [s.skillId, s]));
    expect(isHandsMastered(byId.get('a')!)).toBe(true);
    expect(byId.has('b')).toBe(false);
    expect(res.reward.newlyUnlockedSongIds).not.toContain('gated');
  });

  it('mastering the entry song unlocks the gated song and rewards real progress', () => {
    const res = recordChartAttempt({
      song: entry,
      chart: chartFx,
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

  it('pays the song-qualifying bonus once per day on a sectioned chart', () => {
    const base = {
      song: entry, chart: sectionedChart, playerState: initialPlayerState(),
      skillProgressById: new Map(), prevBestStars: 0,
      allSkills: skills, allSongs: [entry, gated], nowMs: 1_000_000, todayISO: '2026-07-22', rand: 1,
    };
    const first = recordChartAttempt({
      ...base,
      attempt: attempt({ refId: 'chart', perNoteGrades: perfectGrades }),
    });
    expect(first.songMastery.qualifyingPerformances).toHaveLength(1);
    expect(first.reward.songBonusXp).toBeGreaterThanOrEqual(25);

    const second = recordChartAttempt({
      ...base,
      playerState: first.playerState,
      songMastery: first.songMastery,
      attempt: attempt({ id: 'a2', refId: 'chart', perNoteGrades: perfectGrades }),
    });
    expect(second.songMastery.qualifyingPerformances).toHaveLength(1); // same day
    expect(second.reward.songBonusXp).toBe(0);
  });

  it('caps one song\'s FULL-CHART contribution to the tier band at 50%', () => {
    const gate = {
      tierGates: [{
        tier: 1, coreSkillIds: ['a'], bossSongId: 'entry', bossChartId: 'chart',
        checkpointAssessmentIds: ['x'], requiresDelayedReview: true, handsXpBand: 40,
      }],
      assessments: [],
      lessonProgressById: new Map(),
      chartMasteryById: new Map(),
    };
    let player = initialPlayerState();
    let mastery;
    // Grind the same chart across days (fresh-ish each time via new days).
    for (let day = 0; day < 6; day++) {
      const res = recordChartAttempt({
        song: entry, chart: sectionedChart, playerState: player,
        skillProgressById: new Map(), prevBestStars: 3,
        allSkills: skills, allSongs: [entry], nowMs: 1_000_000 + day, todayISO: `2026-07-2${day}`,
        rand: 1, gate, songMastery: mastery,
        attempt: attempt({ id: `g${day}`, refId: 'chart', perNoteGrades: perfectGrades }),
      });
      player = res.playerState;
      mastery = res.songMastery;
    }
    // totalXP keeps growing, but the tier meter stops at 50% of the band.
    expect(player.tierHandsXP).toBeLessThanOrEqual(Math.round(0.5 * 40));
    expect(player.totalXP).toBeGreaterThan(player.tierHandsXP);
  });

  it('a section drill never creates chart bests, boss evidence, riffs, or qualifying', () => {
    const res = recordChartAttempt({
      song: entry, chart: sectionedChart, playerState: initialPlayerState(),
      skillProgressById: new Map(), prevBestStars: 1,
      allSkills: skills, allSongs: [entry], nowMs: 1_000_000, todayISO: '2026-07-22', rand: 1,
      attempt: attempt({
        refId: 'chart', sectionId: 'A', masteryStar: true, perNoteGrades: perfectGrades,
      }),
    });
    expect(res.attempt.masteryStar).toBe(false); // forced off for slices
    expect(res.chartMasteryStar).toBe(false);
    expect(res.chartBestStars).toBe(1); // unchanged
    expect(res.reward.riffs).toBe(0);
    expect(res.songMastery.qualifyingPerformances).toEqual([]);
    expect(res.songMastery.sectionProgress['A']?.passes).toBe(1); // section evidence only
  });

  it('fragment takes never touch SongMastery (stretch-boss honesty)', () => {
    const res = recordChartAttempt({
      song: entry, chart: chartFx, playerState: initialPlayerState(),
      skillProgressById: new Map(), prevBestStars: 0,
      allSkills: skills, allSongs: [entry], nowMs: 1_000_000, todayISO: '2026-07-22', rand: 1,
      attempt: attempt({ refKind: 'fragment', refId: 'frag-x' }),
    });
    expect(res.songMastery.level).toBe(0);
    expect(res.songMastery.lastAttemptId).toBeUndefined();
  });

  it('a repeat of an already-mastered chart pays almost nothing and unlocks nothing new', () => {
    const first = recordChartAttempt({
      song: entry, chart: chartFx, attempt: attempt(), playerState: initialPlayerState(),
      skillProgressById: new Map(), prevBestStars: 0,
      allSkills: skills, allSongs: [entry, gated], nowMs: 1_000_000, todayISO: '2026-07-22', rand: 1,
    });
    const map = new Map(first.changedSkills.map((s) => [s.skillId, s]));
    const second = recordChartAttempt({
      song: entry, chart: chartFx, attempt: attempt(), playerState: first.playerState,
      skillProgressById: map, prevBestStars: 3,
      allSkills: skills, allSongs: [entry, gated], nowMs: 1_000_500, todayISO: '2026-07-22', rand: 1,
    });
    expect(second.reward.newStar).toBe(false);
    expect(second.reward.riffs).toBe(0); // no improvement → no riffs
    expect(second.reward.xp).toBeLessThan(first.reward.xp / 2); // freshness collapses
    expect(second.reward.newlyUnlockedSongIds).toEqual([]);
  });
});
