/**
 * Pure curriculum selectors — path position, module progress, and the single
 * recommended next action. The gameStore wraps these; the UI never computes
 * path logic itself.
 */
import type { Tier } from '@/core/types';
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
}

/**
 * The one dominant "Continue" action: the first incomplete lesson of the
 * first available, incomplete module at or below the learning tier. Null when
 * every authored module is done (path exhausted).
 */
export function nextRecommendedLesson(
  source: CurriculumSource,
  lessonProgressById: ReadonlyMap<string, LessonProgress>,
  learningTier: Tier,
): RecommendedLesson | null {
  for (const module of source.modules) {
    if (!isModuleAvailable(module, source, lessonProgressById, learningTier)) continue;
    const progress = moduleProgress(module, lessonProgressById);
    if (progress.completed || progress.nextLessonId === null) continue;
    const lesson = source.getLesson(progress.nextLessonId);
    if (lesson) return { module, lesson };
  }
  return null;
}
