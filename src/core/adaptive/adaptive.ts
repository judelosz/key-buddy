/**
 * Adaptive difficulty (doc 06 §5.6, §3.4): keep practice in the ~70–85% flow
 * band by moving ONE dimension at a time — tempo first, then visual support —
 * and never silently. Every applied change carries a learner-facing message.
 *
 * Checkpoints are untouchable: for independent/performance lessons the engine
 * offers a stepped-down PRACTICE rep (clearly labeled), never a modified
 * checkpoint — checkpoint honesty in recordLesson fails assisted/slowed
 * checkpoint takes regardless.
 */
import type { CurriculumLesson, LessonMode } from '@/core/curriculum/types';

export const TEMPO_FLOOR = 0.5;
export const TEMPO_STEP_DOWN = 0.1;
export const TEMPO_STEP_UP = 0.05; // ≈ 4–6 BPM at typical targets
export const FLOW_LOW = 0.7;
export const FLOW_HIGH = 0.85;
export const STEP_UP_SUCCESSES = 2;
export const REMEDIATION_FAIL_STREAK = 2;

export interface AdaptationState {
  refId: string; // lessonId | chartId | fragmentId | `${chartId}#${sectionId}`
  /** Working tempo as a fraction of target (chart/rhythm items). */
  tempoPct: number;
  /** 2 = full visual guide · 1 = reduced · 0 = none. One dimension at a time. */
  assistLevel: 0 | 1 | 2;
  /** Cycles small variations while in the 70–85% band. */
  variationIdx: number;
  /** Consecutive ≥85% results at the current settings (step-up needs 2). */
  successesAtSetting: number;
  failStreak: number;
  /** Flow-band alternation (doc-08 §3.11): the next rep runs at FULL tempo as
   * a one-off taste — slow-only practice builds a different motor solution,
   * and alternating slow/target beats a gradual staircase on piano. The
   * working tempoPct is untouched; a failed at-target rep is never punished. */
  nextRepAtTarget?: boolean;
  lastScorePct?: number;
  lastUpdatedMs: number;
}

/** The tempo the NEXT run actually uses (resolves the alternation flag). */
export function workingTempoPct(adapt: AdaptationState): number {
  return adapt.nextRepAtTarget ? 1 : adapt.tempoPct;
}

/** An explicit, learner-visible change applied to the NEXT run of an item. */
export interface AdaptationDirective {
  tempoPct?: number;
  assists?: 'on' | 'off';
  variationIdx?: number;
  /** Always present — adaptive changes are never silent (doc 06 §5.6). */
  message: string;
}

function modeDefaults(mode: LessonMode | undefined): { tempoPct: number; assistLevel: 0 | 1 | 2 } {
  switch (mode) {
    case 'guided':
      return { tempoPct: 0.65, assistLevel: 2 };
    case 'supported':
      return { tempoPct: 0.75, assistLevel: 1 };
    case 'scouting':
    case 'woodshed':
      return { tempoPct: 0.5, assistLevel: 2 };
    default:
      return { tempoPct: 1, assistLevel: 0 };
  }
}

export function initialAdaptation(
  refId: string,
  lesson: CurriculumLesson | null,
  nowMs: number,
): AdaptationState {
  const defaults = modeDefaults(lesson?.mode);
  return {
    refId,
    tempoPct: defaults.tempoPct,
    assistLevel: defaults.assistLevel,
    variationIdx: 0,
    successesAtSetting: 0,
    failStreak: 0,
    lastUpdatedMs: nowMs,
  };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export interface AdaptationOutcome {
  next: AdaptationState;
  /** Change to apply to the NEXT run (undefined = keep settings). */
  directive?: AdaptationDirective;
  /** 3★ at target tempo — offer the independent checkpoint. */
  offerCheckpoint?: boolean;
  /** ≥2 consecutive fails — split into a smaller prerequisite instead. */
  recommendRemediation?: boolean;
}

export function adaptAfterResult(
  prev: AdaptationState,
  outcome: { scorePct: number; passed: boolean; stars?: number; atTempo?: boolean },
  nowMs: number,
): AdaptationOutcome {
  const base: AdaptationState = { ...prev, lastScorePct: outcome.scorePct, lastUpdatedMs: nowMs };
  const offerCheckpoint = outcome.stars === 3 && outcome.atTempo === true;

  // A failed FULL-TEMPO taste rep is never punished — it was a stretch by
  // design (doc-08 §3.11: even a scrappy rep at target teaches the real
  // movement). Return to the working tempo without touching the fail streak.
  if (prev.nextRepAtTarget === true && (outcome.scorePct < FLOW_LOW || !outcome.passed)) {
    return {
      next: { ...base, nextRepAtTarget: false, successesAtSetting: 0 },
      directive: {
        tempoPct: prev.tempoPct,
        message: `That was the full-tempo taste — back to ${pct(prev.tempoPct)} to build it clean.`,
      },
    };
  }

  // < 70%: step DOWN one dimension — tempo first, then visual support.
  if (outcome.scorePct < FLOW_LOW || !outcome.passed) {
    const failStreak = prev.failStreak + 1;
    if (prev.tempoPct > TEMPO_FLOOR + 1e-9) {
      const tempoPct = Math.max(TEMPO_FLOOR, +(prev.tempoPct - TEMPO_STEP_DOWN).toFixed(2));
      return {
        next: { ...base, tempoPct, successesAtSetting: 0, failStreak },
        directive: {
          tempoPct,
          message: `Tempo eased to ${pct(tempoPct)} — the target hasn't changed, we're just building up to it.`,
        },
        recommendRemediation: failStreak >= REMEDIATION_FAIL_STREAK,
      };
    }
    if (prev.assistLevel < 2) {
      const assistLevel = (prev.assistLevel + 1) as 1 | 2;
      return {
        next: { ...base, assistLevel, successesAtSetting: 0, failStreak },
        directive: {
          assists: 'on',
          message: 'Guides are back on for this one — get the shape under your fingers first.',
        },
        recommendRemediation: failStreak >= REMEDIATION_FAIL_STREAK,
      };
    }
    // Already at maximum support — remediation is the only honest move.
    return {
      next: { ...base, successesAtSetting: 0, failStreak },
      recommendRemediation: failStreak >= REMEDIATION_FAIL_STREAK,
    };
  }

  // 70–85%: the flow band — repeat with ONE small variation, alternating a
  // one-off full-tempo rep with the working tempo when below target
  // (doc-08 §3.11: alternation beats a monotonic staircase).
  if (outcome.scorePct < FLOW_HIGH) {
    const variationIdx = prev.variationIdx + 1;
    if (prev.tempoPct < 1 - 1e-9 && prev.nextRepAtTarget !== true) {
      return {
        next: { ...base, variationIdx, nextRepAtTarget: true, successesAtSetting: 0, failStreak: 0 },
        directive: {
          variationIdx,
          tempoPct: 1,
          message:
            'Close — this next one runs at FULL tempo, just for a taste. Scrappy is fine; the target speed is the real movement.',
        },
        offerCheckpoint,
      };
    }
    return {
      next: { ...base, variationIdx, nextRepAtTarget: false, successesAtSetting: 0, failStreak: 0 },
      directive: {
        variationIdx,
        ...(prev.nextRepAtTarget === true ? { tempoPct: prev.tempoPct } : {}),
        message:
          prev.nextRepAtTarget === true
            ? `Nice taste of full tempo — back to ${pct(prev.tempoPct)} to lock it in clean.`
            : 'Close — same challenge, small variation. Lock it in.',
      },
      offerCheckpoint,
    };
  }

  // ≥ 85%: count successes; the second one steps UP one dimension.
  const successesAtSetting = prev.successesAtSetting + 1;
  const cleared: AdaptationState = { ...base, nextRepAtTarget: false };
  if (successesAtSetting >= STEP_UP_SUCCESSES) {
    if (prev.tempoPct < 1 - 1e-9) {
      const tempoPct = Math.min(1, +(prev.tempoPct + TEMPO_STEP_UP).toFixed(2));
      return {
        next: { ...cleared, tempoPct, successesAtSetting: 0, failStreak: 0 },
        directive: {
          tempoPct,
          message: `You've earned a nudge — tempo up to ${pct(tempoPct)}.`,
        },
        offerCheckpoint,
      };
    }
    // Removing the LAST support (assists at full tempo) needs an at-tempo
    // take among the qualifying results — a single easy pass shouldn't strip
    // the final guide (doc-08 §3.17); undefined (non-chart) is unaffected.
    if (prev.assistLevel > 0 && outcome.atTempo !== false) {
      const assistLevel = (prev.assistLevel - 1) as 0 | 1;
      return {
        next: { ...cleared, assistLevel, successesAtSetting: 0, failStreak: 0 },
        directive: {
          assists: 'off',
          message: 'Solid twice in a row — try it without the guides this time.',
        },
        offerCheckpoint,
      };
    }
  }
  return { next: { ...cleared, successesAtSetting, failStreak: 0 }, offerCheckpoint };
}

const CHECKPOINT_MODES: readonly LessonMode[] = ['independent', 'performance'];

/**
 * Map adaptation onto the chart-player knobs regardless of mode — the
 * PRACTICE-RUN variant, for an explicitly labeled stepped-down rep on a
 * checkpoint (checkpoint honesty in recordLesson fails assisted/slowed
 * checkpoint takes anyway, so this can never fake a pass).
 */
export function practicePolicyOverrideFor(
  lesson: CurriculumLesson,
  adapt: AdaptationState,
): { tempoPct: number; fallingNotes: 'on' | 'off' } | undefined {
  if (lesson.exerciseType !== 'play-chart' && lesson.exerciseType !== 'fragment') return undefined;
  return { tempoPct: workingTempoPct(adapt), fallingNotes: adapt.assistLevel >= 1 ? 'on' : 'off' };
}

/**
 * Map adaptation onto the chart-player knobs — undefined for checkpoint modes
 * (their policy is sacrosanct) and for non-chart exercises.
 */
export function policyOverrideFor(
  lesson: CurriculumLesson,
  adapt: AdaptationState,
): { tempoPct: number; fallingNotes: 'on' | 'off' } | undefined {
  if (CHECKPOINT_MODES.includes(lesson.mode)) return undefined;
  return practicePolicyOverrideFor(lesson, adapt);
}

/** Practice-run generator overrides (rhythm-tap tempo, for now) — see
 * practicePolicyOverrideFor for why mode is ignored here. */
export function practiceGeneratorOverridesFor(
  lesson: CurriculumLesson,
  adapt: AdaptationState,
): Record<string, unknown> | undefined {
  if (lesson.exerciseType === 'rhythm-tap') {
    const bpm = lesson.generatorParams?.bpm;
    const tempo = workingTempoPct(adapt);
    if (typeof bpm === 'number' && tempo < 1) {
      return { bpm: Math.round(bpm * tempo) };
    }
  }
  return undefined;
}

/** Generator overrides for adaptable exercises — checkpoint modes untouched. */
export function generatorOverridesFor(
  lesson: CurriculumLesson,
  adapt: AdaptationState,
): Record<string, unknown> | undefined {
  if (CHECKPOINT_MODES.includes(lesson.mode)) return undefined;
  return practiceGeneratorOverridesFor(lesson, adapt);
}

export interface StepDownOffer {
  label: string;
  directive: AdaptationDirective;
  /** True when the target lesson is a checkpoint — the offer is a practice
   * rep, not the checkpoint itself (copy must say so). */
  practiceOnly: boolean;
}

/** Button label for a directive ("Try at 65% tempo (practice run)"). */
export function directiveLabel(directive: AdaptationDirective, practiceOnly: boolean): string {
  const what =
    directive.tempoPct !== undefined
      ? `Try at ${pct(directive.tempoPct)} tempo`
      : directive.assists === 'on'
        ? 'Try with guides on'
        : 'Try a small variation';
  return practiceOnly ? `${what} (practice run)` : what;
}

/** Exercise types with a real dimension to step down (tempo/guides). */
const STEPPABLE_TYPES: readonly string[] = ['play-chart', 'fragment', 'rhythm-tap'];

/** The post-fail step-down offer for a lesson's "Try Again" flow. */
export function stepDownFor(
  lesson: CurriculumLesson,
  adapt: AdaptationState,
  outcome: { scorePct: number; passed: boolean },
  nowMs: number,
): StepDownOffer | null {
  if (outcome.passed) return null;
  // Discrete-answer lessons (quizzes, note-id, ear IDs) have no tempo or
  // guides to ease — a "Try at 55% tempo" offer there is nonsense. Plain
  // Try Again (with fresh prompts) is the honest retry.
  if (!STEPPABLE_TYPES.includes(lesson.exerciseType)) return null;
  const { directive } = adaptAfterResult(adapt, outcome, nowMs);
  if (!directive) return null;
  const practiceOnly = CHECKPOINT_MODES.includes(lesson.mode);
  return {
    label: directiveLabel(directive, practiceOnly),
    directive,
    practiceOnly,
  };
}
