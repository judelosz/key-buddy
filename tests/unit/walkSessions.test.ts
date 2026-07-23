import { describe, it, expect } from 'vitest';
import type { Attempt, Chart, PlayerState, SkillProgress } from '@/core/types';
import type {
  CurriculumLesson,
  LessonProgress,
  LessonResult,
  SongMastery,
} from '@/core/curriculum/types';
import { ContentService } from '@/core/content/contentService';
import { rawContent } from '@/core/content/bundled';
import { fragmentAsChart } from '@/core/content/resolveChart';
import { recordLessonAttempt } from '@/core/session/recordLesson';
import { recordChartAttempt } from '@/core/session/recordAttempt';
import { trackForExerciseType } from '@/core/progression/progressionService';
import { sliceChartSection } from '@/core/songMastery/sections';
import { adaptAfterResult, initialAdaptation, type AdaptationState } from '@/core/adaptive/adaptive';
import {
  buildSession,
  advanceSession,
  extendSession,
  QUEUE_TARGET,
} from '@/core/session/sessionBuilder';
import {
  activityRef,
  initialRunState,
  xpPurposeFor,
  type SessionInputs,
  type SessionSegment,
} from '@/core/session/sessionTypes';
import { initialPlayerState } from '@/data/repository';

/**
 * Simulation harness: whole days of practice driven by the REAL SessionBuilder
 * and executed through the REAL reducers — the Phase-5 balance/guardrail
 * regression net (walkPath's session-shaped sibling).
 */

const DAY = 86_400_000;
const START = Date.parse('2026-07-23T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const content = ContentService.createValidated(rawContent);

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Sim {
  player: PlayerState;
  skills: Map<string, SkillProgress>;
  lessons: Map<string, LessonProgress>;
  songMastery: Map<string, SongMastery>;
  chartMastery: Map<string, boolean>;
  chartBest: Map<string, number>;
  recentResults: LessonResult[];
  recentAttempts: Attempt[];
  adaptation: Map<string, AdaptationState>;
}

function freshSim(): Sim {
  return {
    player: initialPlayerState(),
    skills: new Map(),
    lessons: new Map(),
    songMastery: new Map(),
    chartMastery: new Map(),
    chartBest: new Map(),
    recentResults: [],
    recentAttempts: [],
    adaptation: new Map(),
  };
}

function inputsFor(sim: Sim, nowMs: number, rand: () => number): SessionInputs {
  return {
    content,
    player: sim.player,
    skillProgressById: sim.skills,
    lessonProgressById: sim.lessons,
    songMasteryById: sim.songMastery,
    recentResults: sim.recentResults,
    recentAttempts: sim.recentAttempts,
    adaptationByRef: sim.adaptation,
    nowMs,
    rand,
  };
}

const gateCtx = (sim: Sim) => ({
  tierGates: content.tierGates,
  assessments: content.assessments,
  lessonProgressById: sim.lessons,
  chartMasteryById: sim.chartMastery,
});

function cannedAttempt(
  chart: Chart,
  quality: 'perfect' | 'fail',
  performance: boolean,
  nowMs: number,
): Attempt {
  const perfect = quality === 'perfect';
  return {
    id: `sim-${chart.id}-${nowMs}-${Math.floor(nowMs % 977)}`,
    refId: chart.id,
    refKind: 'chart',
    timestamp: nowMs,
    perNoteGrades: perfect
      ? chart.notes.map((n) => ({
          noteEventId: n.id,
          grade: 'perfect' as const,
          deviationMs: 5,
          pitchCorrect: true,
        }))
      : chart.notes.map((n) => ({
          noteEventId: n.id,
          grade: 'miss' as const,
          deviationMs: null,
          pitchCorrect: false,
        })),
    timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
    wrongNotes: [],
    extraNotes: 0,
    notesCorrectPct: perfect ? 1 : 0.4,
    goodOrBetterPct: perfect ? 1 : 0.3,
    greatOrBetterPct: perfect ? 0.9 : 0.1,
    stars: perfect ? 3 : 1,
    masteryStar: perfect && performance,
    atTempo: perfect,
    tempoBPM: 96,
    assistsUsed: [],
    xpAwarded: 0,
    riffsAwarded: 0,
  };
}

function foldAdaptation(
  sim: Sim,
  refId: string,
  lesson: CurriculumLesson | null,
  outcome: { scorePct: number; passed: boolean },
  nowMs: number,
): void {
  const prev = sim.adaptation.get(refId) ?? initialAdaptation(refId, lesson, nowMs);
  sim.adaptation.set(refId, adaptAfterResult(prev, outcome, nowMs).next);
}

/** Execute one segment through the real reducers; mutates sim. */
function executeSegment(
  sim: Sim,
  segment: SessionSegment,
  quality: 'perfect' | 'fail',
  sessionId: string,
  nowMs: number,
): { passed: boolean; scorePct: number } {
  const a = segment.activity;

  if (a.kind === 'lesson') {
    const lesson = content.getLesson(a.lessonId)!;
    const module = content.getModule(a.moduleId)!;
    const isChart = lesson.exerciseType === 'play-chart' || lesson.exerciseType === 'fragment';
    const chart = lesson.chartId
      ? content.getChart(lesson.chartId)!
      : lesson.fragmentId
        ? fragmentAsChart(content.getFragment(lesson.fragmentId)!)
        : undefined;
    const song = chart ? content.getSong(chart.songId)! : undefined;
    const attempt =
      isChart && chart
        ? {
            ...cannedAttempt(chart, quality, lesson.mode === 'performance', nowMs),
            refKind: (lesson.exerciseType === 'fragment' ? 'fragment' : 'chart') as Attempt['refKind'],
          }
        : undefined;
    const scorePct = quality === 'perfect' ? 1 : 0.55;

    const outcome = recordLessonAttempt({
      lesson,
      module,
      result: isChart
        ? undefined
        : {
            lessonId: lesson.id,
            exerciseType: lesson.exerciseType,
            promptCount: 5,
            correctCount: Math.round(5 * scorePct),
            scorePct,
            details: [],
          },
      chartOutcome:
        isChart && song && chart && attempt
          ? { song, chart, attempt, prevBestStars: sim.chartBest.get(chart.id) ?? 0 }
          : undefined,
      playerState: sim.player,
      skillProgressById: sim.skills,
      lessonProgressById: sim.lessons,
      songMastery: song ? sim.songMastery.get(song.id) : undefined,
      gate: gateCtx(sim),
      allSkills: content.skills,
      allSongs: [...content.songs],
      nowMs,
      todayISO: iso(nowMs),
      rand: 1,
      sessionCtx: {
        sessionId,
        purpose: xpPurposeFor(segment.purpose),
        addressedRecordedWeakness: segment.purpose === 'remediation',
      },
    });

    sim.player = outcome.playerState;
    for (const s of outcome.changedSkills) sim.skills.set(s.skillId, s);
    sim.lessons.set(lesson.id, outcome.lessonProgress);
    if (outcome.songMastery) sim.songMastery.set(outcome.songMastery.songId, outcome.songMastery);
    if (outcome.chart) {
      sim.chartBest.set(outcome.chart.attempt.refId, outcome.chart.chartBestStars);
      sim.chartMastery.set(
        outcome.chart.attempt.refId,
        sim.chartMastery.get(outcome.chart.attempt.refId) || outcome.chart.chartMasteryStar,
      );
      sim.recentAttempts.unshift(outcome.chart.attempt);
    }
    sim.recentResults.unshift(outcome.lessonResult);
    foldAdaptation(sim, lesson.id, lesson, { scorePct: outcome.reward.scorePct, passed: outcome.reward.passed }, nowMs);
    return { passed: outcome.reward.passed, scorePct: outcome.reward.scorePct };
  }

  // Chart-shaped segments (full take / section drill / stretch fragment).
  const song = content.getSong(a.songId)!;
  let playChart: Chart;
  let parentChart: Chart;
  if (a.kind === 'fragment') {
    playChart = fragmentAsChart(content.getFragment(a.fragmentId)!);
    parentChart = playChart;
  } else {
    parentChart = content.getChart(a.chartId)!;
    playChart =
      a.kind === 'section-drill' ? sliceChartSection(parentChart, a.sectionId)! : parentChart;
  }
  const attempt = cannedAttempt(playChart, quality, true, nowMs);
  if (a.kind === 'section-drill') {
    attempt.refId = parentChart.id;
    attempt.sectionId = a.sectionId;
  }
  if (a.kind === 'fragment') attempt.refKind = 'fragment';

  const res = recordChartAttempt({
    song,
    chart: parentChart,
    attempt,
    playerState: sim.player,
    skillProgressById: sim.skills,
    prevBestStars: sim.chartBest.get(parentChart.id) ?? 0,
    allSkills: content.skills,
    allSongs: [...content.songs],
    nowMs,
    todayISO: iso(nowMs),
    rand: 1,
    gate: gateCtx(sim),
    songMastery: sim.songMastery.get(song.id),
    skipSongMastery: segment.purpose === 'stretch-boss',
    sessionId,
  });

  sim.player = res.playerState;
  for (const s of res.changedSkills) sim.skills.set(s.skillId, s);
  sim.chartBest.set(parentChart.id, res.chartBestStars);
  sim.chartMastery.set(parentChart.id, sim.chartMastery.get(parentChart.id) || res.chartMasteryStar);
  sim.songMastery.set(song.id, res.songMastery);
  sim.recentAttempts.unshift(res.attempt);
  foldAdaptation(sim, parentChart.id, null, { scorePct: attempt.notesCorrectPct, passed: attempt.stars >= 2 }, nowMs);
  return { passed: attempt.stars >= 2, scorePct: attempt.notesCorrectPct };
}

type Behavior = (segment: SessionSegment, priorRuns: number) => 'perfect' | 'fail' | 'skip';

/** Run one day's session; returns the refs executed (in order). */
function runDay(
  sim: Sim,
  nowMs: number,
  rand: () => number,
  behavior: Behavior,
  runCounts: Map<string, number>,
  maxSegments = 10,
): { executed: string[]; injected: number } {
  let plan = buildSession(inputsFor(sim, nowMs, rand));
  let state = initialRunState();
  const executed: string[] = [];
  let injected = 0;

  for (let i = 0; i < maxSegments; i++) {
    const seg = plan.queue[0];
    if (!seg) break;
    const ref = activityRef(seg.activity);
    const prior = runCounts.get(ref) ?? 0;
    const decision = behavior(seg, prior);

    let outcome: { passed: boolean; scorePct: number; skippedByUser?: boolean };
    if (decision === 'skip') {
      outcome = { passed: false, scorePct: 0, skippedByUser: true };
    } else {
      runCounts.set(ref, prior + 1);
      executed.push(ref);
      outcome = executeSegment(sim, seg, decision, plan.sessionId, nowMs);
    }

    const inputs = inputsFor(sim, nowMs, rand);
    const adv = advanceSession(plan, state, { segmentId: seg.id, ...outcome }, inputs);
    if (adv.injected) injected += 1;
    state = adv.state;
    plan = extendSession(adv.plan, state, inputs);
  }
  return { executed, injected };
}

describe('walkSessions — daily practice through the real builder + reducers', () => {
  it('a perfect player advances through all five gates, and song mastery obeys its day floors', () => {
    const sim = freshSim();
    const rand = seeded(11);
    const runCounts = new Map<string, number>();
    let nowMs = START;
    let days = 0;

    while (sim.player.learningTier < 6 && days < 60) {
      runDay(sim, nowMs, rand, () => 'perfect', runCounts);
      nowMs += DAY;
      days += 1;
    }

    expect(sim.player.learningTier).toBe(6);
    expect(sim.player.playerLevel).toBe(6);
    expect(Object.keys(sim.player.tierGatePassedAt).map(Number).sort()).toEqual([1, 2, 3, 4, 5]);

    // Song time happened and produced real multi-day evidence…
    const levels = [...sim.songMastery.values()].map((m) => m.level);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(4);
    // …but the durable level can NEVER be reached on thin evidence: any
    // level-5 song must show ≥5 qualifying days; and daily play alone (no
    // ≥72h absence) can't produce the delayed-retrieval evidence at all.
    for (const m of sim.songMastery.values()) {
      if (m.level === 5) {
        expect(new Set(m.qualifyingPerformances.map((q) => q.date)).size).toBeGreaterThanOrEqual(5);
        expect(m.delayedRetrievalAt).toBeDefined();
      }
    }
    const daily = [...sim.songMastery.values()].filter((m) => m.level >= 4);
    for (const m of daily) expect(m.delayedRetrievalAt).toBeUndefined();

    // The stretch song never accrues mastery from Boss Challenges — at most
    // the level-0 "Discovered" record, never "Started" (the Phase-4 bug).
    expect(sim.songMastery.get('pinetops-boogie')?.level ?? 0).toBe(0);
  });

  it('head-only practice can never raise the level, tier, or Hands XP', () => {
    const sim = freshSim();
    const rand = seeded(7);
    const runCounts = new Map<string, number>();
    let nowMs = START;

    const headOnly: Behavior = (segment) => {
      if (segment.activity.kind !== 'lesson') return 'skip';
      const lesson = content.getLesson(segment.activity.lessonId);
      if (!lesson || trackForExerciseType(lesson.exerciseType) !== 'head') return 'skip';
      return 'perfect';
    };

    for (let day = 0; day < 15; day++) {
      runDay(sim, nowMs, rand, headOnly, runCounts);
      nowMs += DAY;
    }

    expect(sim.player.headTrackXP).toBeGreaterThan(0); // real head work happened
    expect(sim.player.learningTier).toBe(1);
    expect(sim.player.playerLevel).toBe(1);
    expect(sim.player.totalXP).toBe(0);
    expect(sim.player.tierHandsXP).toBe(0);
  });

  it('a struggling player gets remediation, never a third identical run in a row', () => {
    const sim = freshSim();
    const rand = seeded(3);
    const runCounts = new Map<string, number>();
    let nowMs = START;
    const days: string[][] = [];
    let totalInjected = 0;

    // Hands exercises fail on the first TWO tries of any activity, then click.
    const struggling: Behavior = (segment, priorRuns) => {
      if (segment.activity.kind !== 'lesson') return 'perfect';
      const lesson = content.getLesson(segment.activity.lessonId);
      if (!lesson) return 'skip';
      const hands = trackForExerciseType(lesson.exerciseType) === 'hands';
      return hands && priorRuns < 2 ? 'fail' : 'perfect';
    };

    for (let day = 0; day < 12; day++) {
      const { executed, injected } = runDay(sim, nowMs, rand, struggling, runCounts);
      days.push(executed);
      totalInjected += injected;
      nowMs += DAY;
    }

    // Failure produced smaller-prerequisite injections, and no activity ever
    // ran three times back to back WITHIN a sitting (doc 06 §3.4 — never a
    // third identical rep; tomorrow's spaced re-attempt is a different thing).
    expect(totalInjected).toBeGreaterThan(0);
    for (const executed of days) {
      for (let i = 2; i < executed.length; i++) {
        const identical = executed[i] === executed[i - 1] && executed[i] === executed[i - 2];
        expect(identical, `three identical consecutive runs of ${executed[i]}`).toBe(false);
      }
    }

    // Struggling slows progress but never bricks it.
    expect([...sim.lessons.values()].filter((l) => l.completedAt !== undefined).length,
    ).toBeGreaterThan(5);
  });

  it('a due-review backlog keeps the session bounded: reviews are woven in, not a wall', () => {
    const sim = freshSim();
    const rand = seeded(19);
    const runCounts = new Map<string, number>();
    let nowMs = START;

    for (let day = 0; day < 8; day++) {
      runDay(sim, nowMs, rand, () => 'perfect', runCounts);
      nowMs += DAY;
    }
    // The player disappears long enough that EVERY tracked skill comes due.
    nowMs += 3 * DAY;
    for (const [id, p] of sim.skills) {
      sim.skills.set(id, { ...p, freshness: { ...p.freshness, due: nowMs - 3_600_000 } });
    }

    const plan = buildSession(inputsFor(sim, nowMs, rand));
    expect(plan.queue.length).toBeGreaterThan(0);
    expect(plan.queue.length).toBeLessThanOrEqual(QUEUE_TARGET + 2);

    const reviews = plan.queue.filter(
      (s) => s.purpose === 'due-review' || s.purpose === 'theory-ear',
    ).length;
    expect(reviews).toBeGreaterThan(0); // the backlog IS addressed…
    expect(reviews / plan.queue.length).toBeLessThanOrEqual(0.5); // …without drowning the session
    // New material (or at least non-review work) still leads the day.
    expect(plan.queue.some((s) => !['due-review', 'theory-ear'].includes(s.purpose))).toBe(true);
  });
});
