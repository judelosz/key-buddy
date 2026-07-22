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

  it('gates song unlocks on mastered skills', () => {
    const ode = svc.getSong('ode-to-joy')!;
    const withoutAll = new Set(['geo-note-names']);
    const withAll = new Set(ode.requiredSkills);
    expect(svc.unlockedSongs(withoutAll).map((s) => s.id)).not.toContain('ode-to-joy');
    expect(svc.unlockedSongs(withAll).map((s) => s.id)).toContain('ode-to-joy');
  });
});
