/**
 * Curriculum domain model (doc 06 §3, §9; doc 07 §9 Phase 4).
 * Content entities (Module, CurriculumLesson, Assessment, TheoryConcept,
 * TierGate) ship as validated JSON; the lesson user-state entities
 * (LessonResult, LessonProgress, SongMastery) persist to IndexedDB.
 */
import type { Arc, Assist, MiniGameType, Tier } from '@/core/types';

// ─── Vocabulary ─────────────────────────────────────────────────────────────

/**
 * Practice modes (doc 06 §3.3). The mode drives the assist policy: guided
 * lessons force visual support on; independent/performance lessons forbid it.
 * 'woodshed' is reserved for AFK (Phase 6).
 */
export type LessonMode =
  | 'guided'
  | 'supported'
  | 'independent'
  | 'performance'
  | 'scouting'
  | 'woodshed';

/** Everything a lesson can ask the learner to do. */
export type ExerciseType = MiniGameType | 'play-chart' | 'fragment' | 'listen' | 'theory-quiz';

/**
 * Which XP track a result feeds. Derived from the exercise type in core code
 * (never authored in content) so content cannot violate the Hands/Head split.
 */
export type XpTrack = 'hands' | 'head';

// ─── Content entities ───────────────────────────────────────────────────────

/** A short path of lessons around one musical outcome (doc 06 §3.2). */
export interface Module {
  id: string;
  arc: Arc;
  tier: Tier;
  title: string;
  /** The outcome sentence shown to the learner, e.g. "Learn a steady beat". */
  promise: string;
  prerequisiteModuleIds: string[];
  /** Ordered — this is the Duolingo-style path. */
  lessonIds: string[];
  /** Skills this module is responsible for teaching. */
  coreSkillIds: string[];
  /** Earlier skills this module deliberately brings back (doc 06 §3.5 spiral;
   * feeds SessionBuilder prerequisite-refresh and transfer re-entry). */
  revisits: string[];
  /** Later skills this module seeds — informational + transfer candidates. */
  prepares: string[];
  /** The checkpoint lesson (mode independent/performance), when the module has one. */
  bossLessonId?: string;
}

/** Machine-checkable companion to the human-readable successRule. */
export interface LessonPassCriteria {
  /** Exercises: minimum scorePct (0–1). Default 0.8 when omitted. */
  minScorePct?: number;
  /** Chart lessons: minimum star rating. */
  minStars?: 0 | 1 | 2 | 3;
  /** Performance checkpoints: the take must earn the mastery star. */
  requiresMasteryStar?: boolean;
}

export interface CurriculumLesson {
  id: string;
  moduleId: string;
  /** Position within the module path (0-based, matches Module.lessonIds). */
  order: number;
  title: string;
  mode: LessonMode;
  exerciseType: ExerciseType;
  skillIds: string[];
  /** Learner-facing "what and why", one sentence. */
  prompt: string;
  /** Human-readable pass rule shown with the lesson. */
  successRule: string;
  passCriteria: LessonPassCriteria;
  /** Assists the lesson allows (validated against mode). */
  assistOptions: Assist[];
  chartId?: string; // required iff exerciseType 'play-chart' (or 'listen' via chart)
  fragmentId?: string; // required iff exerciseType 'fragment'
  theoryConceptId?: string; // required iff exerciseType 'theory-quiz'
  /** Parsed/validated per exerciseType by the exercise engine. */
  generatorParams?: Record<string, unknown>;
  /**
   * Marks a stretch-song Boss Challenge (doc 06 §5.3): exempt from the +1
   * scouting tier cap, exploration-only rewards, never mastery/SongMastery.
   */
  stretchBoss?: boolean;
}

/** A pass/fail measurement administered by a lesson (doc 06 §9). */
export interface Assessment {
  id: string;
  scope: 'skill' | 'tier';
  skillId?: string;
  tier?: Tier;
  /** The lesson that administers this assessment. */
  lessonId: string;
  /** 0–1; tier theory/ear checkpoints use 0.8 (doc 06 §5.4). */
  passScorePct: number;
  /** Lessons to recommend after a failure (smaller prerequisite, not a retry). */
  remediationLessonIds: string[];
}

export interface TheoryQuestion {
  id: string;
  promptText: string;
  choices: string[];
  answerIndex: number;
  /** Shown after a miss — one calm, specific line. */
  explanation: string;
  /** One line per choice (aligned with `choices`): why the right answer is
   * right and why each wrong one is wrong — powers "Explain my answer".
   * RULE (2026-07-23): required on every question, present and future;
   * enforced by validateCurriculum. */
  choiceExplanations: string[];
  /** Optional visual: render a keyboard/staff snippet for these pitches. */
  illustratePitches?: number[];
}

export interface TheoryConcept {
  id: string;
  name: string;
  explanation: string;
  examples: string[];
  linkedSkillIds: string[];
  linkedSongIds: string[];
  /** Question pool for 'theory-quiz' lessons (sampled at runtime). */
  questions: TheoryQuestion[];
}

/**
 * What it takes to advance from `tier` to `tier + 1` (doc 06 §5.4, doc 07
 * §2.1). All conditions are required; XP alone can never pass a gate.
 */
export interface TierGate {
  tier: Tier;
  /** Must all be Hands-mastered. */
  coreSkillIds: string[];
  bossSongId: string;
  /** The boss take must earn the mastery star (at tempo, no assists). */
  bossChartId: string;
  /** Theory/ear checkpoint assessments, each ≥ its passScorePct. */
  checkpointAssessmentIds: string[];
  /**
   * Governs ALL of the gate's spaced-evidence requirements (2026-07-28
   * momentum schedule): when true, at least one older skill must pass a
   * delayed (due) review AND core-skill `assessment.repeatedSessions`
   * distinct-day evidence is enforced. Authored FALSE for Tiers 1–3 so the
   * early game is completable in one sitting; true from Tier 4 on, where
   * advancement deliberately takes practice across separate days.
   */
  requiresDelayedReview: boolean;
  /** Hands XP band for this tier — fills the level meter and is required. */
  handsXpBand: number;
  /** Head XP band for this tier — a DISPLAY meter only (fills, overflows,
   * resets on tier-up); never a gate requirement (guardrail #1). Calibrated
   * ≈75% of natural first-pass head-lesson accrual, like handsXpBand. */
  headXpBand?: number;
}

// ─── User state (persisted) ─────────────────────────────────────────────────

/** Append-only record of one lesson attempt (exercise or chart-backed). */
export interface LessonResult {
  id: string;
  lessonId: string;
  moduleId: string;
  timestamp: number;
  mode: LessonMode;
  exerciseType: ExerciseType;
  track: XpTrack;
  /** 0–1 (chart lessons derive it from accuracy/stars). */
  scorePct: number;
  passed: boolean;
  xpAwarded: number;
  /** Links to the Attempt when the lesson produced one (chart/fragment). */
  attemptId?: string;
  /** Set when the lesson ran inside a practice session. */
  sessionId?: string;
}

/** Compact per-lesson summary, keyed by lessonId. */
export interface LessonProgress {
  lessonId: string;
  /** Set on first pass. */
  completedAt?: number;
  bestScorePct: number;
  attempts: number;
  /** YYYY-MM-DD of the most recent attempt — diminishing-returns bookkeeping. */
  lastAttemptDate?: string;
  attemptsOnLastDate: number;
}

// ─── Song Mastery (doc 06 §5.2 — full shape persisted; low levels live) ─────

export interface SectionMastery {
  sectionId: string;
  passes: number;
  lastPassedAt?: number;
  weak: boolean;
}

export interface TransitionMastery {
  transitionId: string;
  passes: number;
  lastPassedAt?: number;
}

export interface TransferEvidence {
  kind: 'new-key' | 'arrangement' | 'backing-track' | 'reduced-guidance' | 'memory';
  at: number;
  attemptId?: string;
}

/**
 * Durable, multi-session song progress — a reducer over many Attempts,
 * never inferred from the best score alone. Levels:
 * 0 Discovered · 1 Started · 2 Sections learned · 3 Connected ·
 * 4 Performance-ready · 5 Durable mastery.
 * Phase 4 computes levels 0–1 only (charts have no sections yet); the
 * qualifying-evidence counters accumulate for the Phase-5 evidence engine.
 */
/** One qualifying full-song performance (max one per calendar day). */
export interface QualifyingPerformance {
  date: string; // YYYY-MM-DD
  atTempo: boolean;
  attemptId: string;
  /** Which arrangement it was played on (absent on pre-v3 rows). */
  chartId?: string;
}

export interface SongMastery {
  songId: string;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  sectionProgress: Record<string, SectionMastery>;
  transitionProgress: Record<string, TransitionMastery>;
  /** ISO dates of qualifying performances (kept for back-compat; superset of
   * qualifyingPerformances dates). */
  qualifyingSessionDates: string[];
  /** Per-performance evidence (doc 06 §5.2: 5 performances / 5 days, ≥3 at tempo). */
  qualifyingPerformances: QualifyingPerformance[];
  /** Set when a qualifying performance landed after the song was absent from
   * practice for a delay — the durable-mastery retrieval evidence. */
  delayedRetrievalAt?: number;
  /** Epoch ms of the most recent chart attempt on this song (any quality) —
   * powers delayed-context detection. */
  lastAttemptAt?: number;
  bestAttemptId?: string;
  lastAttemptId?: string;
  delayedReviewDue?: number;
  transferEvidence: TransferEvidence[];
  weakSectionIds: string[];
  lastAdvancedAt?: number;
}
