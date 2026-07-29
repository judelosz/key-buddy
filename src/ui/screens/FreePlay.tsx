import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star, Lock } from 'lucide-react';
import type { Chart, Song } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { useGameStore } from '@/ui/store/gameStore';
import { ChartPlayer, FREE_PLAY_POLICY } from '@/ui/components/ChartPlayer';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useAppStore } from '@/ui/store/appStore';
import { GenreMotif } from '@/ui/components/genreMotifs';

/**
 * Free Play — open practice of unlocked songs. Same player, scoring, and
 * attempt recording as curriculum lessons; the only difference is context.
 * Locked songs are gated by demonstrated skill, never purchasable.
 */
export function FreePlay() {
  const content = getContent();
  const [picked, setPicked] = useState<{ song: Song; chart: Chart } | null>(null);
  const setFreePlayActive = useAppStore((state) => state.setFreePlayActive);

  const pick = useCallback((s: Song) => {
    const c = getContent().getChart(s.chartIds[0]);
    if (c) {
      setPicked({ song: s, chart: c });
      setFreePlayActive(true);
    }
  }, [setFreePlayActive]);

  useEffect(
    () => () => {
      setFreePlayActive(false);
    },
    [setFreePlayActive],
  );

  if (!picked) {
    return <SongPicker songs={[...content.songs]} onPick={pick} />;
  }

  return (
    <ChartPlayer
      song={picked.song}
      chart={picked.chart}
      policy={FREE_PLAY_POLICY}
      onExit={() => {
        setPicked(null);
        setFreePlayActive(false);
      }}
    />
  );
}

function SongPicker({ songs, onPick }: { songs: Song[]; onPick: (s: Song) => void }) {
  const regular = useMemo(
    () => songs.filter((s) => s.challengeTier === undefined).sort((a, b) => a.tier - b.tier),
    [songs],
  );
  const challenges = useMemo(
    () =>
      songs
        .filter((s) => s.challengeTier !== undefined)
        .sort((a, b) => (a.challengeTier ?? 0) - (b.challengeTier ?? 0)),
    [songs],
  );

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
        {regular.map((s) => (
          <SongCard key={s.id} song={s} onPick={onPick} />
        ))}
      </div>
      {challenges.length > 0 && (
        <>
          <div className="mt-2">
            <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
              Challenge songs
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Bonus songs set aside for each big milestone — a new one unlocks with Tier 2, then
              every third tier after (5, 8, 11…). They&rsquo;re pitched a little above your level:
              no pressure, all bragging rights.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {challenges.map((s) => (
              <SongCard key={s.id} song={s} onPick={onPick} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SongCard({ song: s, onPick }: { song: Song; onPick: (s: Song) => void }) {
  const isUnlocked = useGameStore((st) => st.isUnlocked);
  const unlockProgress = useGameStore((st) => st.unlockProgress);
  const bestStars = useGameStore((st) => st.bestStars);
  const learningTier = useGameStore((st) => st.player.learningTier);
  const content = getContent();

  const unlocked = isUnlocked(s.id);
  const prog = unlockProgress(s);
  const stars = bestStars(s.chartIds[0]);
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={() => onPick(s)}
      data-testid={`song-${s.id}`}
      className={`relative overflow-hidden rounded-3xl p-5 text-left transition ${
        unlocked
          ? 'bg-surface shadow-soft hover:-translate-y-0.5 hover:shadow-lift'
          : 'cursor-not-allowed border border-dashed border-line bg-transparent'
      }`}
    >
      <GenreMotif
        genre={s.genre}
        size={86}
        className="pointer-events-none absolute -right-2 -top-2 opacity-[0.16]"
      />
      <div className="relative flex items-center justify-between gap-2">
        <h3 className={`font-display font-semibold ${unlocked ? 'text-ink' : 'text-ink-soft'}`}>
          {s.title}
        </h3>
        {s.challengeTier !== undefined ? (
          <span className="whitespace-nowrap rounded-full bg-peri-soft px-2.5 py-0.5 font-display text-xs font-semibold text-peri-ink">
            Bonus · Tier {s.challengeTier} Challenge
          </span>
        ) : (
          <span className="rounded-full bg-sand px-2.5 py-0.5 font-display text-xs font-semibold text-ink-soft">
            T{s.tier}
          </span>
        )}
      </div>
      <p className="relative mt-1 text-xs capitalize text-ink-soft">
        {s.genre} · {s.key} · {s.tempoTargetBPM} BPM · {s.feel}
      </p>
      {unlocked ? (
        <div className="relative mt-2 flex items-center gap-1">
          {[1, 2, 3].map((n) => (
            <Star
              key={n}
              size={16}
              className={n <= stars ? 'fill-amber text-amber-ink' : 'text-line'}
            />
          ))}
          {stars === 0 && <span className="ml-1 text-xs text-ink-soft">Not yet played</span>}
        </div>
      ) : prog.challengeTier !== undefined ? (
        <div className="relative mt-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-soft">
            <Lock size={12} /> Unlocks at Level {prog.challengeTier}
          </div>
          <ProgressBar fraction={Math.min(1, learningTier / prog.challengeTier)} />
        </div>
      ) : (
        <div className="relative mt-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-soft">
            <Lock size={12} /> {prog.requiredCount - prog.masteredCount} skill
            {prog.requiredCount - prog.masteredCount === 1 ? '' : 's'} to unlock:{' '}
            {prog.remainingSkillIds.map((id) => content.getSkill(id)?.name ?? id).join(', ')}
          </div>
          <ProgressBar
            fraction={prog.requiredCount === 0 ? 1 : prog.masteredCount / prog.requiredCount}
          />
        </div>
      )}
    </button>
  );
}
