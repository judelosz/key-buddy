/**
 * Tier-gate evaluation (doc 06 §5.4, doc 07 §2.1). A gate opens only when ALL
 * conditions hold — XP fills the meter but can never pass a gate by itself,
 * and the theory/ear checkpoint is a necessary condition that can gate but
 * never substitute for Hands evidence (guardrail #1 refinement).
 */
import type { SkillProgress, Tier } from '@/core/types';
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
): TierGateStatus {
  const coreSkills = gate.coreSkillIds.map((skillId) => {
    const p = skillProgressById.get(skillId);
    return { skillId, mastered: p !== undefined && isHandsMastered(p) };
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
