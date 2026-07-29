import { describe, it, expect } from 'vitest';
import type { SkillProgress } from '@/core/types';
import type { LessonProgress } from '@/core/curriculum/types';
import { ContentService } from '@/core/content/contentService';
import { rawContent } from '@/core/content/bundled';
import { newCard, reviewCard, starsToRating } from '@/core/srs/fsrs';
import { initialPlayerState } from '@/data/repository';
import { selectStretchFragment, stretchSongFor } from '@/core/curriculum/stretch';
import {
  activityRef,
  initialRunState,
  type SessionInputs,
  type SessionPlan,
  type SessionSegment,
} from '@/core/session/sessionTypes';
import {
  DUE_REVIEW_MAX,
  DUE_REVIEW_MIN,
  REFILL_THRESHOLD,
  advanceSession,
  buildSession,
  extendSession,
  interleaveRepair,
  reviewStateFor,
} from '@/core/session/sessionBuilder';

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-22T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const content = ContentService.createValidated(rawContent);

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function progress(skillId: string, reviewedAt: number, hands: number, head = 0.9): SkillProgress {
  return {
    skillId,
    handsLock: hands,
    headLock: head,
    masteredAt: hands >= 0.85 ? reviewedAt : undefined,
    freshness: reviewCard(newCard(reviewedAt - 1000), starsToRating(2), reviewedAt),
    lastReviewed: reviewedAt,
  };
}

function done(lessonId: string, at: number, best = 0.95): [string, LessonProgress] {
  return [
    lessonId,
    {
      lessonId,
      completedAt: at,
      bestScorePct: best,
      attempts: 1,
      lastAttemptDate: iso(at),
      attemptsOnLastDate: 1,
    },
  ];
}

function inputs(over: Partial<SessionInputs> = {}): SessionInputs {
  return {
    content,
    player: initialPlayerState(),
    skillProgressById: new Map(),
    lessonProgressById: new Map(),
    songMasteryById: new Map(),
    recentResults: [],
    recentAttempts: [],
    adaptationByRef: new Map(),
    nowMs: NOW,
    rand: seeded(42),
    ...over,
  };
}

/** Tier-2 player: all Tier-1 lessons done 20 days ago (skills mastered, now
 * FSRS-due), m2-left-hand started (next new lesson = l-lh-changes). */
function tier2Inputs(): SessionInputs {
  const then = NOW - 20 * DAY;
  const skills = new Map<string, SkillProgress>(
    ['geo-note-names', 'ear-pitch-direction', 'mech-five-finger-c', 'rhythm-steady-pulse'].map(
      (id) => [id, progress(id, then, 0.9)],
    ),
  );
  skills.set('lh-root-notes', progress('lh-root-notes', NOW - 3_600_000, 0.5, 0.4));

  const tier1LessonIds = content.modules
    .filter((m) => m.tier === 1)
    .flatMap((m) => m.lessonIds);
  const lessons = new Map<string, LessonProgress>([
    ...tier1LessonIds.map((id) => done(id, then)),
    done('l-lh-listen', NOW - 2 * DAY),
    done('l-lh-bed', NOW - 2 * DAY),
    done('l-lh-low-notes', NOW - DAY),
  ]);

  const player = { ...initialPlayerState(), learningTier: 2, playerLevel: 2 };
  return inputs({ player, skillProgressById: skills, lessonProgressById: lessons });
}

describe('reviewStateFor — the §3.5 lifecycle', () => {
  const p = progress('s', NOW - DAY, 0.5, 0.3);
  it('walks new → struggling → learning → functional → mastered → maintenance', () => {
    expect(reviewStateFor(undefined, NOW)).toBe('new');
    expect(reviewStateFor(p, NOW, 2)).toBe('struggling');
    expect(reviewStateFor({ ...p, handsLock: 0.3, headLock: 0.2 }, NOW)).toBe('learning');
    expect(reviewStateFor({ ...p, handsLock: 0.7 }, NOW)).toBe('functional');
    expect(reviewStateFor({ ...p, handsLock: 0.9 }, NOW)).toBe('mastered');
    const stable = {
      ...p,
      handsLock: 0.9,
      freshness: { ...p.freshness, stability: 45, due: NOW + 30 * DAY },
    };
    expect(reviewStateFor(stable, NOW)).toBe('maintenance');
  });
});

describe('buildSession', () => {
  it('a fresh profile gets a non-empty queue led by new material', () => {
    const plan = buildSession(inputs());
    expect(plan.queue.length).toBeGreaterThan(0);
    expect(plan.queue[0].purpose).toBe('new-material');
    expect(plan.queue[0].activity).toEqual({
      kind: 'lesson',
      lessonId: 'l-mk-listen',
      moduleId: 'm1-meet-keyboard',
    });
    expect(plan.queue.every((s) => s.purpose !== 'due-review')).toBe(true);
  });

  it('mid-profile queue follows the ordering template: familiar win, then new material', () => {
    const plan = buildSession(tier2Inputs());
    expect(plan.queue[0].purpose).toBe('familiar-win');
    expect(plan.queue[1].purpose).toBe('new-material');
    expect(plan.queue[1].activity).toEqual({
      kind: 'lesson',
      lessonId: 'l-lh-changes',
      moduleId: 'm2-left-hand',
    });
    // Every segment carries a learner-facing reason.
    for (const s of plan.queue) expect(s.reason.length).toBeGreaterThan(0);
  });

  it('keeps the due-review share inside the 20–35% band when both pools have depth', () => {
    const plan = buildSession(tier2Inputs());
    const reviews = plan.queue.filter(
      (s) => s.purpose === 'due-review' || s.purpose === 'theory-ear',
    ).length;
    const share = reviews / plan.queue.length;
    expect(reviews).toBeGreaterThan(0);
    expect(share).toBeGreaterThanOrEqual(DUE_REVIEW_MIN);
    expect(share).toBeLessThanOrEqual(DUE_REVIEW_MAX + 1e-9);
  });

  it('re-enters previous-tier mastered skills as transfer once tier ≥ 2', () => {
    const plan = buildSession(tier2Inputs());
    const transfer = plan.queue.find((s) => s.purpose === 'transfer-reentry');
    expect(transfer).toBeDefined();
    expect(transfer?.reason).toContain('new context');
  });

  it('the queue is interleaved: repair is a fixed point (no fixable family repeats)', () => {
    const plan = buildSession(tier2Inputs());
    expect(interleaveRepair(plan.queue).map((s) => s.id)).toEqual(plan.queue.map((s) => s.id));
  });

  it('never queues the same activity twice', () => {
    const plan = buildSession(tier2Inputs());
    const refs = plan.queue.map((s) => activityRef(s.activity));
    expect(new Set(refs).size).toBe(refs.length);
  });
});

describe('interleaveRepair', () => {
  const seg = (id: string, family: string): { id: string; families: ['left-hand'] } =>
    ({ id, families: [family] }) as never;
  it('swaps a later different-family item into an adjacent repeat', () => {
    const fixed = interleaveRepair([
      seg('a', 'rhythm-groove'),
      seg('b', 'rhythm-groove'),
      seg('c', 'left-hand'),
    ]);
    expect(fixed.map((s) => s.id)).toEqual(['a', 'c', 'b']);
  });
  it('leaves an unfixable run alone', () => {
    const same = [seg('a', 'rhythm-groove'), seg('b', 'rhythm-groove')];
    expect(interleaveRepair(same).map((s) => s.id)).toEqual(['a', 'b']);
  });
  it('keeps an adjacent first-exposure pair of the same skill blocked (doc-08 §3.3)', () => {
    // Discover→Copy of a brand-new skill is an intended block — the repair
    // must not split it even though a different-family swap target exists.
    const block = (id: string) =>
      ({
        id,
        families: ['rhythm-groove'],
        skillIds: ['skill-x'],
        firstExposure: true,
      }) as never;
    const fixed = interleaveRepair([block('discover'), block('copy'), seg('c', 'left-hand')]);
    expect(fixed.map((s: { id: string }) => s.id)).toEqual(['discover', 'copy', 'c']);
    // Without the first-exposure flag the same shape IS repaired.
    const plain = interleaveRepair([
      seg('a', 'rhythm-groove'),
      seg('b', 'rhythm-groove'),
      seg('c', 'left-hand'),
    ]);
    expect(plain.map((s) => s.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('advanceSession — remediation + the two-fail bar', () => {
  const seg = (id: string, lessonId: string): SessionSegment => ({
    id,
    purpose: 'new-material',
    activity: { kind: 'lesson', lessonId, moduleId: 'm2-left-hand' },
    skillIds: content.getLesson(lessonId)?.skillIds ?? [],
    families: ['left-hand'],
    reason: 'test',
  });

  it('injects exactly one smaller-prerequisite remediation after a meaningful failure', () => {
    const plan: SessionPlan = {
      sessionId: 's',
      startedAt: NOW,
      queue: [seg('s-0', 'l-lh-combine')],
      nextSeq: 1,
    };
    const { plan: next, state, injected } = advanceSession(
      plan,
      initialRunState(),
      { segmentId: 's-0', passed: false, scorePct: 0.4 },
      tier2Inputs(),
    );
    expect(injected?.purpose).toBe('remediation');
    // The nearest earlier lesson in the module sharing a failing skill.
    expect(injected?.activity).toEqual({
      kind: 'lesson',
      lessonId: 'l-lh-changes',
      moduleId: 'm2-left-hand',
    });
    expect(next.queue[0]).toBe(injected);
    expect(state.failRunRef).toBe('lesson:l-lh-combine');
    expect(state.failRunCount).toBe(1);
  });

  it('bars an activity after two consecutive fails and never re-queues it', () => {
    const plan: SessionPlan = {
      sessionId: 's',
      startedAt: NOW,
      queue: [seg('s-0', 'l-lh-combine'), seg('s-1', 'l-lh-combine')],
      nextSeq: 2,
    };
    const ins = tier2Inputs();
    const first = advanceSession(plan, initialRunState(), { segmentId: 's-0', passed: false, scorePct: 0.4 }, ins);
    const second = advanceSession(first.plan, first.state, { segmentId: 's-1', passed: false, scorePct: 0.4 }, ins);
    expect(second.state.failRunCount).toBe(2);
    expect(second.state.barredRefs).toContain('lesson:l-lh-combine');
    expect(second.plan.queue.every((s) => activityRef(s.activity) !== 'lesson:l-lh-combine')).toBe(true);
    // Refills honor the bar too.
    const extended = extendSession(second.plan, second.state, ins);
    expect(extended.queue.every((s) => activityRef(s.activity) !== 'lesson:l-lh-combine')).toBe(true);
  });

  it('a pass resets the fail run; a stretch flop never counts as failure', () => {
    const stretchSeg: SessionSegment = {
      id: 's-0',
      purpose: 'stretch-boss',
      activity: { kind: 'fragment', songId: 'pinetops-boogie', fragmentId: 'frag-pinetops-run-cell' },
      skillIds: ['scale-c-major'],
      families: [],
      reason: 'test',
    };
    const plan: SessionPlan = { sessionId: 's', startedAt: NOW, queue: [stretchSeg], nextSeq: 1 };
    const { state, injected } = advanceSession(
      plan,
      { ...initialRunState(), failRunRef: 'lesson:x', failRunCount: 1 },
      { segmentId: 's-0', passed: false, scorePct: 0.2 },
      tier2Inputs(),
    );
    expect(injected).toBeUndefined();
    expect(state.failRunCount).toBe(0);
    expect(state.failRunRef).toBeUndefined();
  });
});

describe('extendSession — the open-endedness mechanism', () => {
  it('refills a running-dry queue against current inputs, excluding what already ran', () => {
    const ins = tier2Inputs();
    const built = buildSession(ins);
    const ranRefs = built.queue.slice(0, built.queue.length - 1).map((s) => activityRef(s.activity));
    const plan: SessionPlan = { ...built, queue: built.queue.slice(-1) };
    const state = {
      ...initialRunState(),
      completed: built.queue.slice(0, built.queue.length - 1).map((segment) => ({
        segment,
        outcome: { segmentId: segment.id, passed: true, scorePct: 0.9 },
      })),
    };
    expect(plan.queue.length).toBeLessThan(REFILL_THRESHOLD);

    const extended = extendSession(plan, state, ins);
    expect(extended.queue.length).toBeGreaterThanOrEqual(REFILL_THRESHOLD);
    const refs = extended.queue.map((s) => activityRef(s.activity));
    expect(new Set(refs).size).toBe(refs.length);
    for (const ref of refs) expect(ranRefs).not.toContain(ref);
    // Segment ids stay unique across the refill.
    expect(extended.nextSeq).toBeGreaterThan(plan.nextSeq);
  });

  it('a healthy queue is left untouched', () => {
    const ins = tier2Inputs();
    const built = buildSession(ins);
    expect(extendSession(built, initialRunState(), ins)).toBe(built);
  });
});

describe('stretch selection', () => {
  const unlockedIds = new Set(['ode-to-joy', 'when-the-saints', 'oh-susanna', 'shell-be-comin', 'amazing-grace', '12-bar-blues-c']);

  it('picks the locked fragment-bearing song nearest learningTier + 10', () => {
    const song = stretchSongFor({ learningTier: 4 }, content.songs, (id) => unlockedIds.has(id));
    expect(song?.id).toBe('pinetops-boogie');
  });

  it('matches fragments to current skills and rotates out recent ones', () => {
    const pinetops = content.getSong('pinetops-boogie')!;
    const frags = pinetops.fragmentIds.map((id) => content.getFragment(id)!);
    const pick = selectStretchFragment(
      pinetops,
      frags,
      new Set(['scale-c-major']),
      new Set(['frag-pinetops-change-cell']),
      seeded(7),
    );
    expect(pick?.id).toBe('frag-pinetops-run-cell');
    expect(
      selectStretchFragment(pinetops, frags, new Set(['no-such-skill']), new Set(), seeded(7)),
    ).toBeNull();
  });

  it('a session queue carries at most one stretch boss', () => {
    const plan = buildSession(tier2Inputs());
    expect(plan.queue.filter((s) => s.purpose === 'stretch-boss').length).toBeLessThanOrEqual(1);
  });
});
