import { ArrowRight, Lock, Play } from 'lucide-react';
import { getContent } from '@/core/content/bundled';
import { useAppStore } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';

/**
 * Missions — the default guided-path home. Placeholder shell for now: the
 * module path, lesson runner, and recommended next action land with the
 * Tier 1 curriculum slice.
 */
export function Missions() {
  const content = getContent();
  const setScreen = useAppStore((s) => s.setScreen);
  const unlockProgress = useGameStore((s) => s.unlockProgress);

  const nextLocked = content.songs
    .filter((s) => s.requiredSkills.length > 0)
    .map((s) => ({ song: s, prog: unlockProgress(s) }))
    .find(({ prog }) => !prog.unlocked);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-surface p-8 shadow-soft">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-soft opacity-70 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-24 h-40 w-40 rounded-full bg-rose-soft opacity-60 blur-2xl" />
        <div className="relative">
          <p className="font-display text-sm font-medium uppercase tracking-wide text-rose-deep">
            Today&rsquo;s practice
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            Ready to play?
          </h2>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            Guided missions are on their way. Until then, practice any unlocked song in Free Play —
            every take in time still earns honest progress.
          </p>
          <button
            type="button"
            onClick={() => setScreen('free-play')}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
          >
            <Play size={18} className="fill-ink" /> Play a song
          </button>
        </div>
      </section>

      {nextLocked && (
        <button
          type="button"
          onClick={() => setScreen('free-play')}
          className="group flex items-center justify-between rounded-3xl bg-surface p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <Lock size={12} /> Next to unlock
            </div>
            <div className="mt-0.5 font-display text-lg font-semibold text-ink">
              {nextLocked.song.title}
            </div>
            <div className="mt-2 h-2 w-56 max-w-full overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-mint-deep/70 transition-[width] duration-700"
                style={{
                  width: `${Math.round(
                    (nextLocked.prog.masteredCount / nextLocked.prog.requiredCount) * 100,
                  )}%`,
                }}
              />
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              {nextLocked.prog.masteredCount}/{nextLocked.prog.requiredCount} skills mastered
            </div>
          </div>
          <ArrowRight
            size={20}
            className="shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-ink"
          />
        </button>
      )}
    </div>
  );
}
