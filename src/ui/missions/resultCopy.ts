/**
 * Shared result copy (doc 06 §10): one calm, specific line per outcome —
 * capability, not score. Used by the module-path LessonResult and the session
 * runner's segment results.
 */
import type { CurriculumLesson } from '@/core/curriculum/types';
import type { LessonReward } from '@/core/session/recordLesson';

export function headline(lesson: CurriculumLesson, reward: LessonReward): string {
  if (!reward.passed) {
    switch (lesson.exerciseType) {
      case 'rhythm-tap':
        return 'The pulse slipped away — that’s normal at first.';
      case 'note-id':
        return 'Some keys are still hiding. The black-key groups are your map.';
      case 'theory-quiz':
      case 'interval-ear':
        return 'A few answers got away — worth one more look.';
      default:
        return 'Not this take — and that’s fine.';
    }
  }
  if (lesson.mode === 'performance') return 'You played it — accurate, in time, no help.';
  if (lesson.mode === 'independent') return 'You did that without any support.';
  if (lesson.mode === 'scouting') return 'You just explored a piece far above your tier.';
  switch (lesson.exerciseType) {
    case 'rhythm-tap':
      return 'You held the pulse.';
    case 'note-id':
      return 'You found your way around the keys.';
    case 'interval-ear':
      return 'Your ears called it.';
    case 'listen':
      return 'Heard and noted.';
    default:
      return 'Done — and it counted.';
  }
}

export function nextStep(lesson: CurriculumLesson, reward: LessonReward): string | null {
  if (reward.passed) return null;
  if (lesson.mode === 'performance') {
    return 'Warm up with the earlier lessons at an easier tempo, then come back for the checkpoint.';
  }
  if (lesson.exerciseType === 'rhythm-tap') {
    return 'Try once more — count the four-beat count-in out loud, then keep counting as you tap.';
  }
  return 'Give it another try — the feedback under each answer tells you what to listen or look for.';
}
