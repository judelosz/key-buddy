import { describe, it, expect } from 'vitest';
import {
  ContentService,
  validateContent,
  type RawContent,
} from '@/core/content/contentService';
import { rawContent } from '@/core/content/bundled';

const empty: RawContent = {
  skills: [],
  songs: [],
  charts: [],
  fragments: [],
  minigames: [],
};

describe('validateContent', () => {
  it('passes the shipped bundle', () => {
    expect(validateContent(rawContent)).toEqual([]);
  });

  it('resolves every song chartId to a shipped chart (requireCharts)', () => {
    expect(validateContent(rawContent, true)).toEqual([]);
    expect(rawContent.charts.length).toBeGreaterThanOrEqual(3);
  });

  it('flags a missing prerequisite', () => {
    const problems = validateContent({
      ...empty,
      skills: [
        {
          id: 's1',
          name: 'S1',
          family: 'geography-mechanics',
          tier: 1,
          genre: 'foundation',
          prerequisites: ['does-not-exist'],
          description: '',
        },
      ],
    });
    expect(problems.some((p) => p.includes('missing prerequisite'))).toBe(true);
  });

  it('flags a song requiring an unknown skill', () => {
    const problems = validateContent({
      ...empty,
      songs: [
        {
          id: 'song1',
          title: 'Song 1',
          source: 'x',
          publicDomain: true,
          genre: 'blues',
          tier: 6,
          key: 'C',
          tempoTargetBPM: 80,
          timeSignature: { beatsPerBar: 4, beatUnit: 4 },
          feel: 'shuffle',
          requiredSkills: ['ghost-skill'],
          taughtSkills: [],
          arrangementLevels: ['simplified'],
          chartIds: [],
          fragmentIds: [],
        },
      ],
    });
    expect(problems.some((p) => p.includes('missing skill ghost-skill'))).toBe(true);
  });
});

describe('ContentService queries', () => {
  const svc = ContentService.createValidated(rawContent);

  it('finds a song by id', () => {
    expect(svc.getSong('ode-to-joy')?.title).toContain('Ode to Joy');
  });

  it('filters songs by genre', () => {
    const blues = svc.songsByGenre('blues');
    expect(blues.length).toBeGreaterThan(0);
    expect(blues.every((s) => s.genre === 'blues')).toBe(true);
  });

  it('always unlocks the entry song (no required skills)', () => {
    expect(svc.unlockedSongs(new Set()).map((s) => s.id)).toContain('ode-to-joy');
  });

  it('gates a song with required skills on mastery', () => {
    const blues = svc.getSong('12-bar-blues-c')!;
    expect(blues.requiredSkills.length).toBeGreaterThan(0);
    const none = new Set<string>();
    const all = new Set(blues.requiredSkills);
    expect(svc.unlockedSongs(none).map((s) => s.id)).not.toContain('12-bar-blues-c');
    expect(svc.unlockedSongs(all).map((s) => s.id)).toContain('12-bar-blues-c');
  });
});
