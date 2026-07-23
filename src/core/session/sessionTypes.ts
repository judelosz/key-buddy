/**
 * Practice-session domain (doc 07 §10, doc 06 §3.5/§7.1). Sessions are
 * OPEN-ENDED (user decision, ADR): the builder emits a prioritized,
 * interleaved queue the player walks as far as they like — there is no
 * duration model anywhere in this API. Doc 06 §7.1's time-budget template is
 * reinterpreted as an ORDERING template; its 20–35% due-review share as a
 * queue-composition ratio.
 */
import type { Attempt, PlayerState, SkillFamily, SkillProgress } from '@/core/types';
import type {
  CurriculumLesson,
  LessonProgress,
  LessonResult,
  Module,
  SongMastery,
} from '@/core/curriculum/types';
import type { AdaptationDirective, AdaptationState } from '@/core/adaptive/adaptive';
import type { ContentService } from '@/core/content/contentService';

/** WHY a segment is queued — drives ordering, XP rows, and learner copy. */
export type SegmentPurpose =
  | 'familiar-win'
  | 'new-material'
  | 'due-review'
  | 'remediation'
  | 'theory-ear'
  | 'song-application'
  | 'section-drill'
  | 'independent-check'
  | 'transfer-reentry'
  | 'stretch-boss';

/** WHAT the segment runs — maps 1:1 onto the existing runners/reducers. */
export type SegmentActivity =
  | { kind: 'lesson'; lessonId: string; moduleId: string }
  | { kind: 'full-chart'; songId: string; chartId: string }
  | { kind: 'section-drill'; songId: string; chartId: string; sectionId: string }
  | { kind: 'fragment'; songId: string; fragmentId: string };

export interface SessionSegment {
  id: string; // `${sessionId}-${n}`
  purpose: SegmentPurpose;
  activity: SegmentActivity;
  skillIds: string[];
  /** Interleaving key — families[0] is the primary. */
  families: SkillFamily[];
  /** Learner-facing one-liner ("Bring back a foundation skill"). */
  reason: string;
  /** Explicit adaptation applied to this run (never silent). */
  adaptation?: AdaptationDirective;
}

export interface SessionPlan {
  sessionId: string;
  startedAt: number;
  /** The upcoming horizon (~8 to start); extendSession refills it. */
  queue: SessionSegment[];
  /** Monotone segment-id counter (segment ids stay unique across refills). */
  nextSeq: number;
}

export interface SegmentOutcome {
  segmentId: string;
  passed: boolean;
  scorePct: number;
  skippedByUser?: boolean;
}

export interface SessionRunState {
  completed: { segment: SessionSegment; outcome: SegmentOutcome }[];
  /** Consecutive-failure tracking on one activity ref (the 1–2 rule). */
  failRunRef?: string;
  failRunCount: number;
  /** Activity refs failed twice in a row — not re-queued this session
   * (doc 06 §5.6: split into a smaller prerequisite, never a third retry). */
  barredRefs: string[];
}

export function initialRunState(): SessionRunState {
  return { completed: [], failRunCount: 0, barredRefs: [] };
}

/** Persisted session row — reporting only, never progression state. */
export interface PracticeSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  segmentsCompleted: number;
  xpHands: number;
  xpHead: number;
}

export interface SessionInputs {
  content: ContentService;
  player: PlayerState;
  skillProgressById: ReadonlyMap<string, SkillProgress>;
  lessonProgressById: ReadonlyMap<string, LessonProgress>;
  songMasteryById: ReadonlyMap<string, SongMastery>;
  /** Recent history (newest first) — error-severity + changed-context signals. */
  recentResults: readonly LessonResult[];
  recentAttempts: readonly Attempt[];
  adaptationByRef: ReadonlyMap<string, AdaptationState>;
  nowMs: number;
  rand: () => number;
}

/** Stable key for "the same activity" across segments (fail-run tracking). */
export function activityRef(a: SegmentActivity): string {
  switch (a.kind) {
    case 'lesson':
      return `lesson:${a.lessonId}`;
    case 'full-chart':
      return `chart:${a.chartId}`;
    case 'section-drill':
      return `chart:${a.chartId}#${a.sectionId}`;
    case 'fragment':
      return `fragment:${a.fragmentId}`;
  }
}

/** Resolve the lesson behind a lesson-activity segment. */
export function lessonOf(
  content: ContentService,
  segment: SessionSegment,
): { lesson: CurriculumLesson; module: Module } | null {
  if (segment.activity.kind !== 'lesson') return null;
  const lesson = content.getLesson(segment.activity.lessonId);
  const module = content.getModule(segment.activity.moduleId);
  return lesson && module ? { lesson, module } : null;
}
