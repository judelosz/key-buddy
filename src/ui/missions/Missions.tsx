import { ArrowRight, Lock, Play, RefreshCcw, Sparkles } from 'lucide-react';
import { getContent } from '@/core/content/bundled';
import { useAppStore } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';
import { ModulePath } from './ModulePath';
import { ModeChip } from './modeChip';

/**
 * Missions — the default guided-path home (doc 07 §1). One dominant
 * recommended action; the module path below it; unlock teaser at the end.
 */
export function Missions() {
  const content = getContent();
  const setScreen = useAppStore((s) => s.setScreen);
  const setActiveLesson = useAppStore((s) => s.setActiveLesson);
  const unlockProgress = useGameStore((s) => s.unlockProgress);
  const nextLesson = useGameStore((s) => s.nextLesson);
  const moduleProgressFor = useGameStore((s) => s.moduleProgressFor);
  const dueReviewSkillIds = useGameStore((s) => s.dueReviewSkillIds);

  const next = nextLesson();
  const dueCount = dueReviewSkillIds().length;
  const nextLocked = content.songs
    .filter((s) => s.requiredSkills.length > 0)
    .map((s) => ({ song: s, prog: unlockProgress(s) }))
    .find(({ prog }) => !prog.unlocked);

  return (
    <div className="flex flex-col gap-6">
      {/* The one dominant action. */}
      <section className="relative overflow-hidden rounded-[2rem] bg-surface p-8 shadow-soft">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-soft opacity-70 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-24 h-40 w-40 rounded-full bg-rose-soft opacity-60 blur-2xl" />
        {next ? (
          <div className="relative">
            <p className="font-display text-sm font-medium uppercase tracking-wide text-rose-deep">
              {next.review
                ? 'Spaced review — bring back a skill'
                : `${next.module.title} · ${
                    moduleProgressFor(next.module.id)?.completedLessons ?? 0
                  }/${next.module.lessonIds.length}`}
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
              {next.lesson.title}
            </h2>
            <p className="mt-2 flex max-w-md items-center gap-2 text-sm text-ink-soft">
              <ModeChip mode={next.lesson.mode} /> {next.lesson.prompt}
            </p>
            <button
              type="button"
              onClick={() =>
                setActiveLesson({ moduleId: next.module.id, lessonId: next.lesson.id })
              }
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
            >
              <Play size={18} className="fill-ink" /> Continue
            </button>
          </div>
        ) : (
          <div className="relative">
            <p className="font-display text-sm font-medium uppercase tracking-wide text-rose-deep">
              All caught up
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
              Nothing due right now.
            </h2>
            <p className="mt-2 max-w-md text-sm text-ink-soft">
              Reviews come due as skills age — check back tomorrow to keep them fresh. Meanwhile,
              Free Play keeps every take counting toward your skills.
            </p>
            <button
              type="button"
              onClick={() => setScreen('free-play')}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
            >
              <Play size={18} className="fill-ink" /> Free Play
            </button>
          </div>
        )}
      </section>

      {dueCount > 0 && (
        <div className="flex items-center gap-3 rounded-3xl bg-peri-soft px-5 py-3.5 text-sm text-peri-deep">
          <RefreshCcw size={16} className="shrink-0" />
          <span>
            <span className="font-medium">Review · {dueCount} skill{dueCount === 1 ? '' : 's'} due.</span>{' '}
            Bring back a foundation skill — your next lessons weave the review in.
          </span>
        </div>
      )}

      <ModulePath />

      {nextLocked && (
        <button
          type="button"
          onClick={() => setScreen('free-play')}
          className="group flex items-center justify-between rounded-3xl bg-surface p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <Lock size={12} /> Next song to unlock
            </div>
            <div className="mt-0.5 font-display text-lg font-semibold text-ink">
              {nextLocked.song.title}
            </div>
            <div className="mt-2 h-2 w-56 max-w-full overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-mint-deep/70 transition-[width] duration-700"
                style={{
                  width: `${Math.round(
                    (nextLocked.prog.masteredCount / Math.max(1, nextLocked.prog.requiredCount)) * 100,
                  )}%`,
                }}
              />
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              {nextLocked.prog.masteredCount}/{nextLocked.prog.requiredCount} skills mastered —
              earned by playing, never bought
            </div>
          </div>
          <ArrowRight
            size={20}
            className="shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-ink"
          />
        </button>
      )}

      <p className="flex items-center gap-2 text-center text-xs text-ink-soft">
        <Sparkles size={12} className="shrink-0" />
        XP fills your level meter, but advancing needs mastery: the tier&rsquo;s skills, its boss
        song, and the theory check. The Progress tab shows exactly what&rsquo;s left.
      </p>
    </div>
  );
}
