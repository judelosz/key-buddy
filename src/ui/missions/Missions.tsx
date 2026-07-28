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
  const setSessionActive = useAppStore((s) => s.setSessionActive);
  const unlockProgress = useGameStore((s) => s.unlockProgress);
  const nextLesson = useGameStore((s) => s.nextLesson);
  const moduleProgressFor = useGameStore((s) => s.moduleProgressFor);
  const dueReviewSkillIds = useGameStore((s) => s.dueReviewSkillIds);
  const missionsHero = useGameStore((s) => s.missionsHero);
  const startSession = useGameStore((s) => s.startSession);

  const next = nextLesson();
  const hero = missionsHero();
  const dueCount = dueReviewSkillIds().length;
  // Daily practice unlocks with Tier 1 (momentum schedule) — visible, honest.
  const sessionsUnlocked = useGameStore((s) => s.player.learningTier >= 2);
  const nextLocked = content.songs
    .filter((s) => s.requiredSkills.length > 0)
    .map((s) => ({ song: s, prog: unlockProgress(s) }))
    .find(({ prog }) => !prog.unlocked);

  const beginPractice = () => {
    void startSession().then(() => setSessionActive(true));
  };
  const openNext = () =>
    next && setActiveLesson({ moduleId: next.module.id, lessonId: next.lesson.id });

  return (
    <div className="flex flex-col gap-6">
      {/* The one dominant action — context-dependent (user decision): new
          material leads with Continue; caught-up / review days lead with the
          practice session. */}
      <section className="relative overflow-hidden rounded-[2rem] bg-surface p-8 shadow-soft">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-soft opacity-70 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-24 h-40 w-40 rounded-full bg-rose-soft opacity-60 blur-2xl" />
        {hero === 'new-material' && next ? (
          <div className="relative">
            <p className="font-display text-sm font-medium uppercase tracking-wide text-rose-deep">
              {`${next.module.title} · ${
                moduleProgressFor(next.module.id)?.completedLessons ?? 0
              }/${next.module.lessonIds.length}`}
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
              {next.lesson.title}
            </h2>
            <p className="mt-2 flex max-w-md items-center gap-2 text-sm text-ink-soft">
              <ModeChip mode={next.lesson.mode} /> {next.lesson.prompt}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openNext}
                className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
              >
                <Play size={18} className="fill-ink" /> Continue
              </button>
              {sessionsUnlocked ? (
                <button
                  type="button"
                  onClick={beginPractice}
                  className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
                >
                  <RefreshCcw size={15} /> Today&rsquo;s practice
                </button>
              ) : (
                <span
                  title="Daily practice mixes review into your day — it opens once you've passed Tier 1."
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-line px-5 py-2.5 font-display text-sm font-medium text-ink-soft"
                >
                  <Lock size={14} /> Daily practice · unlocks when you pass Tier 1
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <p className="font-display text-sm font-medium uppercase tracking-wide text-rose-deep">
              {dueCount > 0 ? 'Reviews are ready' : 'All caught up'}
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
              Today&rsquo;s practice, built for you.
            </h2>
            <p className="mt-2 max-w-md text-sm text-ink-soft">
              {dueCount > 0
                ? `A warm-up, ${dueCount} skill${dueCount === 1 ? '' : 's'} to bring back, song time, and one surprise — as much or as little as you like.`
                : 'A warm-up, song time, and one surprise — practice as much or as little as you like.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={beginPractice}
                className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
              >
                <Play size={18} className="fill-ink" /> Start today&rsquo;s practice
              </button>
              {next && (
                <button
                  type="button"
                  onClick={openNext}
                  className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
                >
                  <RefreshCcw size={15} /> Review: {next.lesson.title}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {dueCount > 0 && sessionsUnlocked && (
        <button
          type="button"
          onClick={beginPractice}
          className="flex items-center gap-3 rounded-3xl bg-peri-soft px-5 py-3.5 text-left text-sm text-peri-deep transition hover:-translate-y-px active:translate-y-px"
        >
          <RefreshCcw size={16} className="shrink-0" />
          <span>
            <span className="font-medium">
              Review · {dueCount} skill{dueCount === 1 ? '' : 's'} due.
            </span>{' '}
            Start today&rsquo;s practice — it weaves them in between the new stuff.
          </span>
        </button>
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
