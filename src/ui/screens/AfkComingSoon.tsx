import { Brain, Ear, Drum, Sparkles } from 'lucide-react';

/**
 * Placeholder for Woodshed/AFK mode (built in Phase 6). Explains what the tab
 * will become without promising interactivity that doesn't exist yet.
 */
export function AfkComingSoon() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">AFK Mode</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Keep learning away from the keyboard — coming soon.
        </p>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] bg-surface p-8 shadow-soft">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-peri-soft opacity-70 blur-2xl" />
        <div className="relative flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-peri-soft px-3 py-1 text-xs font-medium text-peri-ink">
            <Sparkles size={13} /> Coming soon
          </span>
          <h3 className="font-display text-xl font-semibold text-ink">
            The Woodshed: ear, rhythm, and theory games for no-piano days
          </h3>
          <p className="max-w-prose text-sm text-ink-soft">
            Short challenges built from exactly what your current Missions are teaching — hear a
            chord and name it, tap a rhythm in time, build a chord on a pictured keyboard. Every
            skill has two locks: AFK work opens the <span className="font-medium text-ink">Head lock</span>{' '}
            (you know it and hear it), and playing at the keyboard opens the{' '}
            <span className="font-medium text-ink">Hands lock</span> (you can play it, in time). AFK
            progress preloads your playing — it never fakes it. Your playing level and song unlocks
            always come from your hands.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-sm text-ink">
              <Ear size={18} className="shrink-0 text-peri-ink" /> Chord &amp; interval ear training
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-sm text-ink">
              <Drum size={18} className="shrink-0 text-peri-ink" /> Rhythm tap &amp; feel games
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-sm text-ink">
              <Brain size={18} className="shrink-0 text-peri-ink" /> Theory tied to your songs
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
