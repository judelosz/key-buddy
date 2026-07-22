/**
 * Pure curriculum selectors — path position, module progress, and the single
 * recommended next action. The gameStore wraps these; the UI never computes
 * path logic itself.
 */
import type { SkillProgress, Tier } from '@/core/types';
import type { CurriculumLesson, LessonProgress, Module } from './types';

export interface CurriculumSource {
  modules: readonly Module[];
  getLesson(id: string): CurriculumLesson | undefined;
}

export interface ModuleProgressSummary {
  moduleId: string;
  completedLessons: number;
  totalLessons: number;
  nextLessonId: string | null;
  completed: boolean;
}

export function moduleProgress(
  module: Module,
  lessonProgressById: ReadonlyMap<string, LessonProgress>,
): ModuleProgressSummary {
  let completedLessons = 0;
  let nextLessonId: string | null = null;
  for (const id of module.lessonIds) {
    if (lessonProgressById.get(id)?.completedAt !== undefined) {
      completedLessons += 1;
    } else if (nextLessonId === null) {
      nextLessonId = id;
    }
  }
  return {
    moduleId: module.id,
    completedLessons,
    totalLessons: module.lessonIds.length,
    nextLessonId,
    completed: completedLessons === module.lessonIds.length && module.lessonIds.length > 0,
  };
}

export function isModuleCompleted(
  module: Module,
  lessonProgressById: ReadonlyMap<string, LessonProgress>,
): boolean {
  return moduleProgress(module, lessonProgressById).completed;
}

/** A module is startable when every prerequisite module is completed. */
export function isModuleAvailable(
  module: Module,
  source: CurriculumSource,
  lessonProgressById: ReadonlyMap<string, LessonProgress>,
  learningTier: Tier,
): boolean {
  if (module.tier > learningTier) return false;
  const byId = new Map(source.modules.map((m) => [m.id, m]));
  return module.prerequisiteModuleIds.every((id) => {
    const pre = byId.get(id);
    return pre !== undefined && isModuleCompleted(pre, lessonProgressById);
  });
}

export interface RecommendedLesson {
  module: Module;
  lesson: CurriculumLesson;
  /** True when this is a spaced-review repeat, not new material. */
  review?: boolean;
}

/**
 * The one dominant "Continue" action: the first incomplete lesson of the
 * first available, incomplete module at or below the learning tier.
 *
 * When every available lesson is done but the tier gate hasn't opened (XP
 * band or delayed review still pending), fall back to the most-overdue
 * completed lesson as spaced review — practicing toward the gate IS the path
 * (doc 06 §3.5). Null only when nothing is due either.
 */
export function nextRecommendedLesson(
  source: CurriculumSource,
  lessonProgressById: ReadonlyMap<string, LessonProgress>,
  learningTier: Tier,
  skillProgressById?: ReadonlyMap<string, SkillProgress>,
  nowMs?: number,
): RecommendedLesson | null {
  for (const module of source.modules) {
    if (!isModuleAvailable(module, source, lessonProgressById, learningTier)) continue;
    const progress = moduleProgress(module, lessonProgressById);
    if (progress.completed || progress.nextLessonId === null) continue;
    const lesson = source.getLesson(progress.nextLessonId);
    if (lesson) return { module, lesson };
  }

  if (!skillProgressById || nowMs === undefined) return null;
  let best: { rec: RecommendedLesson; overdueMs: number } | null = null;
  for (const module of source.modules) {
    if (module.tier > learningTier) continue;
    for (const id of module.lessonIds) {
      const lesson = source.getLesson(id);
      if (!lesson) continue;
      // Listening again teaches nothing; scouting is exploration, not review.
      if (lesson.exerciseType === 'listen' || lesson.mode === 'scouting') continue;
      if (lessonProgressById.get(id)?.completedAt === undefined) continue;
      let overdueMs = -1;
      for (const sid of lesson.skillIds) {
        const p = skillProgressById.get(sid);
        if (p && p.freshness.due <= nowMs) overdueMs = Math.max(overdueMs, nowMs - p.freshness.due);
      }
      if (overdueMs >= 0 && (best === null || overdueMs > best.overdueMs)) {
        best = { rec: { module, lesson, review: true }, overdueMs };
      }
    }
  }
  return best?.rec ?? null;
}
