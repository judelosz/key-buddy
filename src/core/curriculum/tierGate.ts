/**
 * Tier-gate evaluation (doc 06 §5.4, doc 07 §2.1). A gate opens only when ALL
 * conditions hold — XP fills the meter but can never pass a gate by itself,
 * and the theory/ear checkpoint is a necessary condition that can gate but
 * never substitute for Hands evidence (guardrail #1 refinement).
 */
import type { PlayerState, Skill, SkillProgress, Tier } from '@/core/types';
import { isHandsMastered } from '@/core/progression/progressionService';
import type { Assessment, LessonProgress, TierGate } from './types';

export interface TierGateStatus {
  tier: Tier;
  coreSkills: { skillId: string; mastered: boolean }[];
  /** The boss chart has earned a mastery star (at tempo, no assists). */
  bossPassed: boolean;
  checkpoints: { assessmentId: string; bestScorePct: number; passed: boolean }[];
  delayedReviewPassed: boolean;
  handsXp: { current: number; band: number; reached: boolean };
  passed: boolean;
}

export function evaluateTierGate(
  gate: TierGate,
  assessments: readonly Assessment[],
  skillProgressById: ReadonlyMap<string, SkillProgress>,
  lessonProgressById: ReadonlyMap<string, LessonProgress>,
  bossMasteryStar: boolean,
  tierHandsXP: number,
  skillById?: ReadonlyMap<string, Skill>,
): TierGateStatus {
  const coreSkills = gate.coreSkillIds.map((skillId) => {
    const p = skillProgressById.get(skillId);
    // A skill whose assessment demands N separate sessions needs N distinct
    // evidence dates on top of the lock threshold (doc 06 §5.1).
    const needsSessions = skillById?.get(skillId)?.assessment?.repeatedSessions;
    const sessionsOk =
      needsSessions === undefined || (p?.handsEvidenceDates?.length ?? 0) >= needsSessions;
    return { skillId, mastered: p !== undefined && isHandsMastered(p) && sessionsOk };
  });

  const assessmentById = new Map(assessments.map((a) => [a.id, a]));
  const checkpoints = gate.checkpointAssessmentIds.map((assessmentId) => {
    const assessment = assessmentById.get(assessmentId);
    const bestScorePct = assessment
      ? (lessonProgressById.get(assessment.lessonId)?.bestScorePct ?? 0)
      : 0;
    return {
      assessmentId,
      bestScorePct,
      passed: assessment !== undefined && bestScorePct >= assessment.passScorePct,
    };
  });

  const delayedReviewPassed =
    !gate.requiresDelayedReview ||
    [...skillProgressById.values()].some((p) => p.delayedReviewPassedAt !== undefined);

  const handsXp = {
    current: tierHandsXP,
    band: gate.handsXpBand,
    reached: tierHandsXP >= gate.handsXpBand,
  };

  const passed =
    coreSkills.every((s) => s.mastered) &&
    bossMasteryStar &&
    checkpoints.length > 0 &&
    checkpoints.every((c) => c.passed) &&
    delayedReviewPassed &&
    handsXp.reached;

  return {
    tier: gate.tier,
    coreSkills,
    bossPassed: bossMasteryStar,
    checkpoints,
    delayedReviewPassed,
    handsXp,
    passed,
  };
}

export interface GateEvaluationInputs {
  tierGates: readonly TierGate[];
  assessments: readonly Assessment[];
  skillProgressById: ReadonlyMap<string, SkillProgress>;
  lessonProgressById: ReadonlyMap<string, LessonProgress>;
  /** Honest boss evidence: chartId → has a mastery star ever been earned. */
  chartMasteryById: ReadonlyMap<string, boolean>;
  /** Enables assessment.repeatedSessions enforcement on core skills. */
  skillById?: ReadonlyMap<string, Skill>;
}

export interface GateAdvanceResult {
  player: PlayerState;
  /** Status of the (possibly new) current tier's gate; null when unauthored. */
  gateStatus: TierGateStatus | null;
  tierAdvanced: boolean;
}

/**
 * Re-derive playerLevel from learningTier and advance one tier if the current
 * gate is fully passed. The shared gate step for BOTH reducers — Free Play
 * chart takes and curriculum lessons must count identically.
 */
export function applyGateAdvance(
  player: PlayerState,
  inputs: GateEvaluationInputs,
  nowMs: number,
): GateAdvanceResult {
  const statusFor = (tier: Tier, tierHandsXP: number): TierGateStatus | null => {
    const gate = inputs.tierGates.find((g) => g.tier === tier);
    if (!gate) return null;
    return evaluateTierGate(
      gate,
      inputs.assessments,
      inputs.skillProgressById,
      inputs.lessonProgressById,
      inputs.chartMasteryById.get(gate.bossChartId) ?? false,
      tierHandsXP,
      inputs.skillById,
    );
  };

  const base: PlayerState = { ...player, playerLevel: player.learningTier };
  const status = statusFor(base.learningTier, base.tierHandsXP);
  if (!status?.passed) return { player: base, gateStatus: status, tierAdvanced: false };

  const newTier = base.learningTier + 1;
  const advanced: PlayerState = {
    ...base,
    learningTier: newTier,
    playerLevel: newTier,
    tierHandsXP: 0,
    tierXpBySong: {}, // per-song cap ledger starts fresh with the new band
    tierGatePassedAt: { ...base.tierGatePassedAt, [status.tier]: nowMs },
  };
  return {
    player: advanced,
    gateStatus: statusFor(newTier, 0) ?? status,
    tierAdvanced: true,
  };
}

/**
 * Plain-language list of what still blocks advancement — powers the Progress
 * checklist and keeps the level meter honest ("never imply grinding levels
 * you up").
 */
export function gateRequirementsRemaining(status: TierGateStatus): string[] {
  const out: string[] = [];
  const missing = status.coreSkills.filter((s) => !s.mastered);
  if (missing.length > 0) {
    out.push(`Master ${missing.length} core skill${missing.length === 1 ? '' : 's'} with your hands`);
  }
  if (!status.bossPassed) out.push('Earn the mastery star on the tier boss song');
  for (const c of status.checkpoints) {
    if (!c.passed) out.push('Pass the theory & ear checkpoint (80%+)');
  }
  if (!status.delayedReviewPassed) out.push('Pass one review of an older skill after a delay');
  if (!status.handsXp.reached) out.push('Keep practicing — fill the tier XP band');
  return out;
}
