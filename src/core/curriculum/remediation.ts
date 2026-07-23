/**
 * Remediation lookup (doc 06 §3.4): after a meaningful failure the honest
 * next step is a SMALLER PREREQUISITE, never an identical retry. Candidates in
 * preference order: the failed lesson's authored assessment remediation, then
 * the nearest earlier lesson in the same module sharing a failing skill.
 */
import type { CurriculumLesson } from './types';
import type { ContentService } from '@/core/content/contentService';

export function remediationCandidates(
  content: ContentService,
  failed: CurriculumLesson,
): CurriculumLesson[] {
  const out: CurriculumLesson[] = [];
  for (const a of content.assessments) {
    if (a.lessonId !== failed.id) continue;
    for (const rid of a.remediationLessonIds) {
      const lesson = content.getLesson(rid);
      if (lesson && !out.some((l) => l.id === lesson.id)) out.push(lesson);
    }
  }
  const earlier = content
    .lessonsForModule(failed.moduleId)
    .filter(
      (l) =>
        l.order < failed.order &&
        l.exerciseType !== 'listen' &&
        l.skillIds.some((s) => failed.skillIds.includes(s)),
    )
    .sort((a, b) => b.order - a.order);
  for (const l of earlier) {
    if (!out.some((o) => o.id === l.id)) out.push(l);
  }
  return out;
}
