import { useCallback, useMemo, useState } from 'react';
import { Star, Lock } from 'lucide-react';
import type { Chart, Song } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { useGameStore } from '@/ui/store/gameStore';
import { ChartPlayer, FREE_PLAY_POLICY } from '@/ui/components/ChartPlayer';

/**
 * Free Play — open practice of unlocked songs. Same player, scoring, and
 * attempt recording as curriculum lessons; the only difference is context.
 * Locked songs are gated by demonstrated skill, never purchasable.
 */
export function FreePlay() {
  const content = getContent();
  const [picked, setPicked] = useState<{ song: Song; chart: Chart } | null>(null);

  const pick = useCallback((s: Song) => {
    const c = getContent().getChart(s.chartIds[0]);
    if (c) setPicked({ song: s, chart: c });
  }, []);

  if (!picked) {
    return <SongPicker songs={[...content.songs]} onPick={pick} />;
  }

  return (
    <ChartPlayer
      song={picked.song}
      chart={picked.chart}
      policy={FREE_PLAY_POLICY}
      onExit={() => setPicked(null)}
    />
  );
}

function SongPicker({ songs, onPick }: { songs: Song[]; onPick: (s: Song) => void }) {
  const byTier = useMemo(() => [...songs].sort((a, b) => a.tier - b.tier), [songs]);
  const isUnlocked = useGameStore((s) => s.isUnlocked);
  const unlockProgress = useGameStore((s) => s.unlockProgress);
  const bestStars = useGameStore((s) => s.bestStars);
  const content = getContent();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Play a song</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Free Play — practice anything you&rsquo;ve unlocked, as much as you like. Takes here still
          count toward your skills. Songs unlock through demonstrated skill in Missions.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {byTier.map((s) => {
          const unlocked = isUnlocked(s.id);
          const prog = unlockProgress(s);
          const stars = bestStars(s.chartIds[0]);
          return (
            <button
              key={s.id}
              type="button"
              disabled={!unlocked}
              onClick={() => onPick(s)}
              data-testid={`song-${s.id}`}
              className={`rounded-3xl p-5 text-left transition ${
                unlocked
                  ? 'bg-surface shadow-soft hover:-translate-y-0.5 hover:shadow-lift'
                  : 'cursor-not-allowed border border-dashed border-line bg-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className={`font-display font-semibold ${unlocked ? 'text-ink' : 'text-ink-soft'}`}>
                  {s.title}
                </h3>
                <span className="rounded-full bg-sand px-2.5 py-0.5 font-display text-xs font-semibold text-ink-soft">
                  T{s.tier}
                </span>
              </div>
              <p className="mt-1 text-xs capitalize text-ink-soft">
                {s.genre} · {s.key} · {s.tempoTargetBPM} BPM · {s.feel}
              </p>
              {unlocked ? (
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3].map((n) => (
                    <Star
                      key={n}
                      size={16}
                      className={n <= stars ? 'fill-amber text-amber-deep' : 'text-line'}
                    />
                  ))}
                  {stars === 0 && <span className="ml-1 text-xs text-ink-soft">Not yet played</span>}
                </div>
              ) : (
                <div className="mt-2">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-soft">
                    <Lock size={12} /> {prog.requiredCount - prog.masteredCount} skill
                    {prog.requiredCount - prog.masteredCount === 1 ? '' : 's'} to unlock:{' '}
                    {prog.remainingSkillIds
                      .map((id) => content.getSkill(id)?.name ?? id)
                      .join(', ')}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sand">
                    <div
                      className="h-full rounded-full bg-mint-deep/70 transition-[width] duration-700"
                      style={{
                        width: `${
                          prog.requiredCount === 0
                            ? 100
                            : Math.round((prog.masteredCount / prog.requiredCount) * 100)
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
