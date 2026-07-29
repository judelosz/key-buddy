import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Lock,
  Ear,
  Search,
  Drum,
  BookOpen,
  Music,
  Blocks,
  Eye,
  Flag,
  Crown,
} from 'lucide-react';
import type { CurriculumLesson, ExerciseType, Module } from '@/core/curriculum/types';
import { getContent } from '@/core/content/bundled';
import { useGameStore } from '@/ui/store/gameStore';
import { useAppStore } from '@/ui/store/appStore';
import { isModuleAvailable } from '@/core/curriculum/selectors';
import { ModeChip } from './modeChip';

const TYPE_ICONS: Partial<Record<ExerciseType, typeof Ear>> = {
  listen: Eye,
  'note-id': Search,
  'rhythm-tap': Drum,
  'theory-quiz': BookOpen,
  'interval-ear': Ear,
  'chord-ear': Ear,
  'build-chord': Blocks,
  'play-chart': Music,
  fragment: Music,
};

/**
 * The Duolingo-style path: modules grouped by tier; the current module expands
 * into lesson nodes with done/current/locked states and mode chips.
 */
export function ModulePath() {
  const content = getContent();
  const lessonProgressById = useGameStore((s) => s.lessonProgressById);
  const player = useGameStore((s) => s.player);
  const moduleProgressFor = useGameStore((s) => s.moduleProgressFor);

  let tierShown = 0;
  return (
    <div className="flex flex-col gap-4">
      {content.modules.map((module) => {
        const showTier = module.tier !== tierShown;
        tierShown = module.tier;
        const progress = moduleProgressFor(module.id);
        const available = isModuleAvailable(
          module,
          content,
          lessonProgressById,
          player.learningTier,
        );
        const isCurrent = available && progress !== null && !progress.completed;
        return (
          <div key={module.id} className="flex flex-col gap-3">
            {showTier && (
              <div className="mt-2 flex items-center gap-3">
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
                  Tier {module.tier}
                </span>
                <div className="h-px flex-1 bg-line" />
              </div>
            )}
            <ModuleCard
              module={module}
              available={available}
              expanded={isCurrent}
              completed={progress?.completed ?? false}
              completedLessons={progress?.completedLessons ?? 0}
              nextLessonId={progress?.nextLessonId ?? null}
            />
          </div>
        );
      })}
    </div>
  );
}

function ModuleCard({
  module,
  available,
  expanded,
  completed,
  completedLessons,
  nextLessonId,
}: {
  module: Module;
  available: boolean;
  expanded: boolean;
  completed: boolean;
  completedLessons: number;
  nextLessonId: string | null;
}) {
  const content = getContent();
  const lessons = content.lessonsForModule(module.id);
  // Completed modules fold into a dropdown — every mission stays replayable
  // (user decision 2026-07-28). Current modules stay auto-expanded.
  const [replayOpen, setReplayOpen] = useState(false);
  const showLessons = expanded || (completed && replayOpen);

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 text-left">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
          {module.title}
        </h3>
        <p className="text-sm text-ink-soft">{module.promise}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-right">
        {completed ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1 text-xs font-medium text-mint-deep">
              <Check size={13} /> Done
            </span>
            <span className="text-xs text-ink-soft">
              {replayOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </span>
          </>
        ) : available ? (
          <span className="font-display text-sm font-semibold tabular-nums text-ink-soft">
            {completedLessons}/{module.lessonIds.length}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink-soft">
            <Lock size={12} /> Finish the previous module
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`rounded-3xl border border-line bg-surface p-5 shadow-soft transition ${
        available ? '' : 'opacity-60'
      }`}
    >
      {completed ? (
        <button
          type="button"
          aria-expanded={replayOpen}
          onClick={() => setReplayOpen((v) => !v)}
          className="w-full rounded-2xl transition hover:opacity-90"
          title="Open to replay any mission from this module"
        >
          {header}
        </button>
      ) : (
        header
      )}

      {showLessons && (
        <ol className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4">
          {completed && (
            <li className="pb-1 text-xs text-ink-soft">
              Replay any mission — repeats pay less XP, but reviews keep skills gold.
            </li>
          )}
          {lessons.map((lesson) => (
            <LessonNode
              key={lesson.id}
              lesson={lesson}
              module={module}
              isNext={lesson.id === nextLessonId}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function LessonNode({
  lesson,
  module,
  isNext,
}: {
  lesson: CurriculumLesson;
  module: Module;
  isNext: boolean;
}) {
  const lessonProgressById = useGameStore((s) => s.lessonProgressById);
  const setActiveLesson = useAppStore((s) => s.setActiveLesson);
  const done = lessonProgressById.get(lesson.id)?.completedAt !== undefined;
  const isBoss = module.bossLessonId === lesson.id;
  const clickable = done || isNext;
  const Icon = lesson.stretchBoss ? Crown : isBoss ? Flag : (TYPE_ICONS[lesson.exerciseType] ?? Music);

  return (
    <li>
      <button
        type="button"
        disabled={!clickable}
        data-testid={`lesson-${lesson.id}`}
        onClick={() => setActiveLesson({ moduleId: module.id, lessonId: lesson.id })}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
          isNext
            ? 'bg-amber-soft shadow-soft hover:-translate-y-px'
            : done
              ? 'hover:bg-sand'
              : 'cursor-not-allowed opacity-50'
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            done
              ? 'bg-mint-soft text-mint-deep'
              : isNext
                ? 'bg-amber text-ink animate-pop'
                : 'bg-sand text-ink-soft'
          }`}
        >
          {done ? <Check size={15} /> : <Icon size={15} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${done || isNext ? 'text-ink' : 'text-ink-soft'}`}>
            {lesson.title}
          </span>
          <span className="block truncate text-xs text-ink-soft">{lesson.successRule}</span>
        </span>
        <ModeChip mode={lesson.mode} />
      </button>
    </li>
  );
}
