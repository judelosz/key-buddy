import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Lock,
  Map as MapIcon,
  X,
} from 'lucide-react';
import type { CurriculumLesson, Module } from '@/core/curriculum/types';
import { getContent } from '@/core/content/bundled';
import { isModuleAvailable } from '@/core/curriculum/selectors';
import { useGameStore } from '@/ui/store/gameStore';
import { useAppStore } from '@/ui/store/appStore';
import { ModeChip } from './modeChip';
import { LessonGlyph } from '@/ui/components/LessonGlyph';
import {
  ChurchWindowMotif,
  PianoMotif,
  RoadMotif,
} from '@/ui/components/genreMotifs';

interface ModuleView {
  module: Module;
  available: boolean;
  completed: boolean;
  completedLessons: number;
  nextLessonId: string | null;
  current: boolean;
}

/**
 * The short-horizon Missions map: yesterday, today, and the next two rooms.
 * The complete authored syllabus stays available in CurriculumDialog without
 * turning the daily landing page into a 30-tier catalog.
 */
export function ModulePath() {
  const content = getContent();
  const lessonProgressById = useGameStore((state) => state.lessonProgressById);
  const player = useGameStore((state) => state.player);
  const moduleProgressFor = useGameStore((state) => state.moduleProgressFor);
  const [curriculumOpen, setCurriculumOpen] = useState(false);

  const views = content.modules.map((module): ModuleView => {
    const progress = moduleProgressFor(module.id);
    const available = isModuleAvailable(
      module,
      content,
      lessonProgressById,
      player.learningTier,
    );
    const completed = progress?.completed ?? false;
    return {
      module,
      available,
      completed,
      completedLessons: progress?.completedLessons ?? 0,
      nextLessonId: progress?.nextLessonId ?? null,
      current: available && progress !== null && !completed,
    };
  });

  const currentIndex = Math.max(
    0,
    views.findIndex((view) => view.current),
  );
  const current = views[currentIndex] ?? views[0];
  const previous = [...views.slice(0, currentIndex)].reverse().find((view) => view.completed);
  const upcoming = views.slice(currentIndex + 1, currentIndex + 3);

  if (!current) return null;

  return (
    <>
      <section data-testid="mission-horizon" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-rose-ink">
              Your path
            </p>
            <h2 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-ink">
              The room you&rsquo;re in now
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCurriculumOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sand px-4 py-2 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
          >
            <MapIcon size={15} /> View full curriculum
          </button>
        </div>

        {previous && <ModulePreview view={previous} position="previous" />}
        <CurrentModulePath view={current} />
        {upcoming.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((view, index) => (
              <ModulePreview
                key={view.module.id}
                view={view}
                position={index === 0 ? 'next' : 'later'}
              />
            ))}
          </div>
        )}
      </section>

      <CurriculumDialog
        open={curriculumOpen}
        views={views}
        currentModuleId={current.module.id}
        onClose={() => setCurriculumOpen(false)}
      />
    </>
  );
}

function ModulePreview({
  view,
  position,
}: {
  view: ModuleView;
  position: 'previous' | 'next' | 'later';
}) {
  const label =
    position === 'previous' ? 'Last room' : position === 'next' ? 'Up next' : 'On the horizon';
  return (
    <article
      className={`flex items-center justify-between gap-4 rounded-3xl border px-5 py-4 ${
        position === 'previous'
          ? 'border-mint-soft bg-mint-soft/45'
          : 'border-line bg-surface/65'
      }`}
    >
      <div className="min-w-0">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {label} · Tier {view.module.tier}
        </p>
        <h3 className="mt-1 truncate font-display text-base font-semibold text-ink">
          {view.module.title}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{view.module.promise}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {view.completed && (
          <span className="font-display text-xs font-semibold text-mint-ink">Done</span>
        )}
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            view.completed ? 'bg-mint text-ink' : 'bg-sand text-ink-soft'
          }`}
        >
          {view.completed ? <Check size={18} /> : <Lock size={16} />}
        </span>
      </div>
    </article>
  );
}

function CurrentModulePath({ view }: { view: ModuleView }) {
  const content = getContent();
  const lessons = content.lessonsForModule(view.module.id);
  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-line bg-surface shadow-soft">
      <header className="relative overflow-hidden border-b border-line bg-amber-soft/55 px-6 py-5 sm:px-7">
        <PianoMotif
          size={132}
          className="pointer-events-none absolute -right-2 -top-7 rotate-6 opacity-35"
        />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-amber-ink">
              Tier {view.module.tier} · Current room
            </p>
            <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
              {view.module.title}
            </h3>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">{view.module.promise}</p>
          </div>
          <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-ink-soft">
            {view.completedLessons}/{view.module.lessonIds.length}
          </span>
        </div>
      </header>

      <ol className="relative mx-auto flex max-w-3xl flex-col gap-3 px-5 py-7 sm:px-8">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-12 left-1/2 top-12 w-px -translate-x-1/2 bg-line"
        />
        {lessons.map((lesson, index) => (
          <PathLesson
            key={lesson.id}
            lesson={lesson}
            module={view.module}
            isNext={lesson.id === view.nextLessonId}
            index={index}
          />
        ))}
      </ol>
    </article>
  );
}

function PathLesson({
  lesson,
  module,
  isNext,
  index,
}: {
  lesson: CurriculumLesson;
  module: Module;
  isNext: boolean;
  index: number;
}) {
  const progress = useGameStore((state) => state.lessonProgressById.get(lesson.id));
  const setActiveLesson = useAppStore((state) => state.setActiveLesson);
  const done = progress?.completedAt !== undefined;
  const isBoss = module.bossLessonId === lesson.id;
  const clickable = done || isNext;
  const side = index % 2 === 0 ? 'left' : 'right';
  const offset = index % 3 === 0 ? '-translate-x-3' : index % 3 === 2 ? 'translate-x-3' : '';

  return (
    <li className="relative z-[1] grid min-h-[4.5rem] grid-cols-[1fr_4rem_1fr] items-center gap-2">
      <div className={side === 'left' ? 'col-start-1 row-start-1 text-right' : 'col-start-3 row-start-1'}>
        <p className={`text-sm font-semibold ${clickable ? 'text-ink' : 'text-ink-soft'}`}>
          {lesson.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-soft">
          {lesson.successRule}
        </p>
        <div className={`mt-1 ${side === 'left' ? 'flex justify-end' : ''}`}>
          <ModeChip mode={lesson.mode} />
        </div>
      </div>
      <button
        type="button"
        disabled={!clickable}
        data-testid={`lesson-${lesson.id}`}
        aria-label={`${lesson.title}${isNext ? ' — current mission' : done ? ' — completed' : ' — locked'}`}
        onClick={() => setActiveLesson({ moduleId: module.id, lessonId: lesson.id })}
        className={`col-start-2 row-start-1 flex h-14 w-14 items-center justify-center justify-self-center rounded-[1.15rem] border-b-[3px] transition ${offset} ${
          done
            ? 'border-mint-deep/25 bg-mint text-ink hover:-translate-y-px'
            : isNext
              ? 'border-amber-deep/35 bg-amber text-ink shadow-soft animate-pop hover:-translate-y-0.5 hover:shadow-lift'
              : 'cursor-not-allowed border-line bg-sand text-ink-soft'
        } ${isBoss ? 'h-16 w-16 rounded-[1.35rem]' : ''}`}
      >
        {done ? (
          <Check size={21} />
        ) : (
          <LessonGlyph
            type={lesson.exerciseType}
            boss={isBoss}
            stretch={lesson.stretchBoss}
            size={isBoss ? 24 : 21}
          />
        )}
      </button>
    </li>
  );
}

function CurriculumDialog({
  open,
  views,
  currentModuleId,
  onClose,
}: {
  open: boolean;
  views: ModuleView[];
  currentModuleId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerReturnRef = useRef<HTMLElement | null>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      triggerReturnRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const close = () => {
    dialogRef.current?.close();
    onClose();
    window.setTimeout(() => triggerReturnRef.current?.focus(), 0);
  };

  const tiers = useMemo(() => {
    const grouped = new Map<number, ModuleView[]>();
    for (const view of views) {
      grouped.set(view.module.tier, [...(grouped.get(view.module.tier) ?? []), view]);
    }
    return [...grouped.entries()];
  }, [views]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="curriculum-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      className="m-auto max-h-[88vh] w-[min(56rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] border border-line bg-paper p-0 text-ink shadow-lift backdrop:bg-ink/20"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-paper/95 px-6 py-5 backdrop-blur sm:px-7">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-rose-ink">
            The whole journey
          </p>
          <h2 id="curriculum-title" className="mt-1 font-display text-2xl font-semibold text-ink">
            Full curriculum
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Look ahead or replay anything you&rsquo;ve already earned.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close curriculum"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-ink-soft transition hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[calc(88vh-8.5rem)] overflow-y-auto px-5 py-5 sm:px-7">
        <button
          type="button"
          onClick={() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className="sticky top-0 z-[2] mb-4 inline-flex items-center gap-2 rounded-full bg-amber px-4 py-2 font-display text-sm font-semibold text-ink shadow-soft"
        >
          <MapIcon size={15} /> Return to current mission
        </button>
        <div className="flex flex-col gap-7">
          {tiers.map(([tier, tierViews]) => (
            <section key={tier}>
              <div className="mb-3 flex items-center gap-3">
                <TierMotif tier={tier} />
                <span className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  Tier {tier}
                </span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <div className="flex flex-col gap-2">
                {tierViews.map((view) => (
                  <CurriculumModule
                    key={view.module.id}
                    view={view}
                    currentRef={view.module.id === currentModuleId ? currentRef : undefined}
                    onOpenLesson={close}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}

function CurriculumModule({
  view,
  currentRef,
  onOpenLesson,
}: {
  view: ModuleView;
  currentRef?: RefObject<HTMLDivElement | null>;
  onOpenLesson: () => void;
}) {
  const [open, setOpen] = useState(view.current);
  const lessons = getContent().lessonsForModule(view.module.id);
  const setActiveLesson = useAppStore((state) => state.setActiveLesson);

  return (
    <div
      ref={currentRef}
      data-module-id={view.module.id}
      className={`rounded-3xl border ${
        view.current ? 'border-amber bg-amber-soft/45' : 'border-line bg-surface'
      }`}
    >
      <button
        type="button"
        disabled={!view.available && !view.completed}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left disabled:cursor-not-allowed"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-ink">
              {view.module.title}
            </h3>
            {view.current && (
              <span className="rounded-full bg-amber px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
                Current
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-soft">{view.module.promise}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
          {view.completed ? (
            <>
              <Check size={14} className="text-mint-ink" /> Done
            </>
          ) : view.available ? (
            `${view.completedLessons}/${view.module.lessonIds.length}`
          ) : (
            <>
              <Lock size={13} /> Locked
            </>
          )}
          {(view.available || view.completed) &&
            (open ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
        </span>
      </button>

      {open && (view.available || view.completed) && (
        <div className="border-t border-line px-3 py-3">
          {lessons.map((lesson) => {
            const done = useGameStore.getState().lessonProgressById.get(lesson.id)?.completedAt !== undefined;
            const clickable = done || lesson.id === view.nextLessonId;
            return (
              <button
                key={lesson.id}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  setActiveLesson({ moduleId: view.module.id, lessonId: lesson.id });
                  onOpenLesson();
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-sand disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    done
                      ? 'bg-mint-soft text-mint-ink'
                      : clickable
                        ? 'bg-amber text-ink'
                        : 'bg-sand text-ink-soft'
                  }`}
                >
                  {done ? (
                    <Check size={15} />
                  ) : clickable ? (
                    <LessonGlyph type={lesson.exerciseType} size={15} />
                  ) : (
                    <Lock size={13} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${clickable ? 'text-ink' : 'text-ink-soft'}`}>
                    {lesson.title}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">{lesson.successRule}</span>
                </span>
                <ModeChip mode={lesson.mode} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TierMotif({ tier }: { tier: number }) {
  const props = { size: 30, className: 'shrink-0 opacity-70' };
  if (tier % 3 === 2) return <ChurchWindowMotif {...props} />;
  if (tier % 3 === 0) return <RoadMotif {...props} />;
  return <PianoMotif {...props} />;
}
