import { describe, it, expect } from 'vitest';
import type { Chart, Fragment, Skill, Song } from '@/core/types';
import type {
  Assessment,
  CurriculumLesson,
  Module,
  TheoryConcept,
  TierGate,
} from '@/core/curriculum/types';
import { validateContent, type RawContent } from '@/core/content/contentService';

// ─── Fixture builders ────────────────────────────────────────────────────────

const skill = (id: string, over: Partial<Skill> = {}): Skill => ({
  id,
  name: id,
  family: 'geography-mechanics',
  tier: 1,
  genre: 'foundation',
  prerequisites: [],
  description: '',
  arc: 'foundation',
  strand: 'technique',
  outcome: `outcome of ${id}`,
  moduleId: 'mod-1',
  assessment: {
    minStars: 3,
    minNotesCorrectPct: 0.9,
    minGoodOrBetterPct: 0.75,
    requiresAtTempo: true,
    requiresNoAssists: true,
  },
  ...over,
});

const song = (id: string, over: Partial<Song> = {}): Song => ({
  id,
  title: id,
  source: 'traditional',
  publicDomain: true,
  genre: 'foundation',
  tier: 1,
  key: 'C',
  tempoTargetBPM: 96,
  timeSignature: { beatsPerBar: 4, beatUnit: 4 },
  feel: 'straight',
  requiredSkills: [],
  taughtSkills: [],
  arrangementLevels: ['simplified'],
  chartIds: [`${id}--simplified`],
  fragmentIds: [],
  ...over,
});

const chart = (id: string, songId: string): Chart => ({
  id,
  songId,
  arrangementLevel: 'simplified',
  timeSignature: { beatsPerBar: 4, beatUnit: 4 },
  chordSymbols: [],
  notes: [{ id: 'n1', pitches: [60], startBeat: 0, durationBeats: 1, hand: 'right' }],
});

const fragment = (id: string, sourceSongId: string): Fragment => ({
  id,
  sourceSongId,
  label: id,
  skillTags: [],
  chart: {
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    chordSymbols: [],
    notes: [{ id: 'n1', pitches: [60], startBeat: 0, durationBeats: 1, hand: 'right' }],
  },
});

const lesson = (id: string, over: Partial<CurriculumLesson> = {}): CurriculumLesson => ({
  id,
  moduleId: 'mod-1',
  order: 0,
  title: id,
  mode: 'guided',
  exerciseType: 'note-id',
  skillIds: ['skill-a'],
  prompt: 'do the thing',
  successRule: 'do it well',
  passCriteria: { minScorePct: 0.8 },
  assistOptions: [],
  generatorParams: { pitchPool: ['C'], count: 3 },
  ...over,
});

const moduleFx = (id: string, over: Partial<Module> = {}): Module => ({
  id,
  arc: 'foundation',
  tier: 1,
  title: id,
  promise: 'learn a thing',
  prerequisiteModuleIds: [],
  lessonIds: ['lesson-1'],
  coreSkillIds: ['skill-a'],
  ...over,
});

const gate = (over: Partial<TierGate> = {}): TierGate => ({
  tier: 1,
  coreSkillIds: ['skill-a'],
  bossSongId: 'boss-song',
  bossChartId: 'boss-song--simplified',
  checkpointAssessmentIds: ['assess-1'],
  requiresDelayedReview: true,
  handsXpBand: 100,
  ...over,
});

const assessment = (id: string, over: Partial<Assessment> = {}): Assessment => ({
  id,
  scope: 'tier',
  tier: 1,
  lessonId: 'lesson-checkpoint',
  passScorePct: 0.8,
  remediationLessonIds: [],
  ...over,
});

const concept = (id: string, over: Partial<TheoryConcept> = {}): TheoryConcept => ({
  id,
  name: id,
  explanation: 'because',
  examples: [],
  linkedSkillIds: [],
  linkedSongIds: [],
  questions: [
    { id: `${id}-q1`, promptText: '2 + 2?', choices: ['3', '4'], answerIndex: 1, explanation: 'it is 4' },
  ],
  ...over,
});

/** A minimal fully-valid curriculum: one module, two lessons, one gate. */
function validBundle(): RawContent {
  return {
    skills: [skill('skill-a')],
    songs: [song('boss-song')],
    charts: [chart('boss-song--simplified', 'boss-song')],
    fragments: [],
    minigames: [],
    modules: [
      moduleFx('mod-1', {
        lessonIds: ['lesson-1', 'lesson-checkpoint'],
        bossLessonId: 'lesson-checkpoint',
      }),
    ],
    lessons: [
      lesson('lesson-1'),
      lesson('lesson-checkpoint', {
        order: 1,
        mode: 'independent',
        exerciseType: 'theory-quiz',
        theoryConceptId: 'concept-1',
        generatorParams: undefined,
      }),
    ],
    assessments: [assessment('assess-1')],
    theoryConcepts: [concept('concept-1')],
    tierGates: [gate()],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('validateCurriculum', () => {
  it('passes a minimal valid curriculum', () => {
    expect(validateContent(validBundle())).toEqual([]);
  });

  it('detects a skill prerequisite cycle', () => {
    const raw = validBundle();
    raw.skills = [
      skill('skill-a', { prerequisites: ['skill-b'] }),
      skill('skill-b', { prerequisites: ['skill-a'], moduleId: undefined }),
    ];
    // Break the feasibility noise: only the cycle matters here.
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('Skill prerequisite cycle'))).toBe(true);
  });

  it('detects a module prerequisite cycle', () => {
    const raw = validBundle();
    raw.modules = [
      moduleFx('mod-1', {
        lessonIds: ['lesson-1', 'lesson-checkpoint'],
        prerequisiteModuleIds: ['mod-2'],
      }),
      moduleFx('mod-2', { lessonIds: [], coreSkillIds: [], prerequisiteModuleIds: ['mod-1'] }),
    ];
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('Module prerequisite cycle'))).toBe(true);
  });

  it('flags a module listing a missing lesson', () => {
    const raw = validBundle();
    raw.modules[0] = { ...raw.modules[0], lessonIds: ['lesson-1', 'lesson-checkpoint', 'ghost'] };
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('missing lesson ghost'))).toBe(true);
  });

  it('flags a lesson order that disagrees with its module position', () => {
    const raw = validBundle();
    raw.lessons = raw.lessons.map((l) => (l.id === 'lesson-1' ? { ...l, order: 5 } : l));
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('has order 5 but sits at position 0'))).toBe(true);
  });

  it('flags a tier with modules but no gate', () => {
    const raw = validBundle();
    raw.tierGates = [];
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('has modules but no tier gate'))).toBe(true);
  });

  it('flags a gate whose checkpoint lesson is not independent/performance', () => {
    const raw = validBundle();
    raw.lessons = raw.lessons.map((l) =>
      l.id === 'lesson-checkpoint' ? { ...l, mode: 'guided' as const } : l,
    );
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes("mode 'guided'"))).toBe(true);
  });

  it('flags an unplayable boss (requires a skill above the gate tier)', () => {
    const raw = validBundle();
    raw.skills = [...raw.skills, skill('skill-hi', { tier: 9, moduleId: undefined })];
    raw.songs = [song('boss-song', { requiredSkills: ['skill-hi'] })];
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('unplayable at this gate'))).toBe(true);
  });

  it('caps scouting fragments at module tier +1, exempting stretch bosses', () => {
    const raw = validBundle();
    raw.songs = [...raw.songs, song('stretch-song', { tier: 11 })];
    raw.fragments = [fragment('frag-stretch', 'stretch-song')];
    const scout = lesson('lesson-scout', {
      order: 2,
      mode: 'scouting',
      exerciseType: 'fragment',
      fragmentId: 'frag-stretch',
      generatorParams: undefined,
    });
    raw.lessons = [...raw.lessons, scout];
    raw.modules[0] = {
      ...raw.modules[0],
      lessonIds: [...raw.modules[0].lessonIds, 'lesson-scout'],
    };

    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('above the module tier'))).toBe(true);

    // Same lesson flagged as a stretch boss is exempt.
    raw.lessons = raw.lessons.map((l) =>
      l.id === 'lesson-scout' ? { ...l, stretchBoss: true } : l,
    );
    expect(validateContent(raw)).toEqual([]);
  });

  it('rejects visual assists on independent lessons and any assists on performance lessons', () => {
    const raw = validBundle();
    raw.lessons = [
      ...raw.lessons,
      lesson('lesson-ind', {
        order: 2,
        mode: 'independent',
        assistOptions: ['falling-notes'],
      }),
      lesson('lesson-perf', {
        order: 3,
        mode: 'performance',
        assistOptions: ['metronome-count-in'],
      }),
    ];
    raw.modules[0] = {
      ...raw.modules[0],
      lessonIds: [...raw.modules[0].lessonIds, 'lesson-ind', 'lesson-perf'],
    };
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes("may not offer visual assist 'falling-notes'"))).toBe(true);
    expect(problems.some((p) => p.includes('must have empty assistOptions'))).toBe(true);
  });

  it('flags a prerequisite skill taught later in the same module', () => {
    const raw = validBundle();
    raw.skills = [
      skill('skill-a', { prerequisites: ['skill-b'] }),
      skill('skill-b', { moduleId: undefined }),
    ];
    // lesson-1 uses skill-a; skill-b is only taught by a later lesson.
    raw.lessons = [
      ...raw.lessons,
      lesson('lesson-late', { order: 2, skillIds: ['skill-b'] }),
    ];
    raw.modules[0] = {
      ...raw.modules[0],
      lessonIds: [...raw.modules[0].lessonIds, 'lesson-late'],
    };
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('before its prerequisite skill-b is taught'))).toBe(true);
  });

  it('flags a core skill missing curriculum fields', () => {
    const raw = validBundle();
    raw.skills = [skill('skill-a', { outcome: undefined })];
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('lacks curriculum fields'))).toBe(true);
  });

  it('flags a theory question with an out-of-range answer', () => {
    const raw = validBundle();
    raw.theoryConcepts = [
      concept('concept-1', {
        questions: [
          { id: 'q1', promptText: '?', choices: ['a'], answerIndex: 3, explanation: '' },
        ],
      }),
    ];
    const problems = validateContent(raw);
    expect(problems.some((p) => p.includes('out-of-range answerIndex'))).toBe(true);
  });
});
