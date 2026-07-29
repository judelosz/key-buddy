import { AlertTriangle, ChevronRight, Music, Star } from 'lucide-react';
import { getContent } from '@/core/content/bundled';
import { SONG_MASTERY_LABELS } from '@/core/songMastery/songMastery';
import { useGameStore } from '@/ui/store/gameStore';

/**
 * Song Mastery (doc 06 §5.2) — per unlocked song: best stars, the six-step
 * ladder, weak-section chips, and ONE honest "Next:" line computed from
 * exactly the evidence the reducer reads (never a promise it won't keep).
 */
export function SongMasteryCard() {
  const content = getContent();
  const isUnlocked = useGameStore((s) => s.isUnlocked);
  const bestStars = useGameStore((s) => s.bestStars);
  const songMasteryDetail = useGameStore((s) => s.songMasteryDetail);

  const songs = content.songs.filter((s) => isUnlocked(s.id) && s.chartIds.length > 0);
  if (songs.length === 0) return null;

  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
      <h3 className="mb-3 font-display text-sm font-semibold text-ink">Song Mastery</h3>
      <div className="flex flex-col gap-2.5">
        {songs.map((song) => {
          const { mastery, levelLabel, nextEvidence } = songMasteryDetail(song.id);
          const stars = bestStars(song.chartIds[0]);
          const chart = content.getChart(song.chartIds[0]);
          const weakLabels = mastery.weakSectionIds
            .map((id) => chart?.sections?.find((s) => s.id === id)?.label ?? id)
            .slice(0, 3);
          return (
            <div key={song.id} className="rounded-2xl bg-sand px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Music size={14} className="shrink-0 text-ink-soft" />
                  <span className="truncate text-sm font-medium text-ink">{song.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3].map((n) => (
                      <Star
                        key={n}
                        size={13}
                        className={n <= stars ? 'fill-amber text-amber-ink' : 'text-line'}
                      />
                    ))}
                  </span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-ink-soft">
                    {levelLabel}
                  </span>
                </div>
              </div>

              {/* The six-step ladder — filled to the current level. */}
              <div className="mt-2 flex items-center gap-1" aria-label={`Mastery level ${mastery.level} of 5`}>
                {SONG_MASTERY_LABELS.map((label, i) => (
                  <span
                    key={label}
                    title={label}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= mastery.level ? 'bg-rose-deep/70' : 'bg-surface'
                    }`}
                  />
                ))}
              </div>
              {/* Ladder legend at rest — hover-only titles hid the best copy
                  in the system (level names). */}
              <p className="mt-1 text-[11px] text-ink-soft">
                <span className="font-medium text-rose-ink">{levelLabel}</span>
                {mastery.level < SONG_MASTERY_LABELS.length - 1 && (
                  <span> → next: {SONG_MASTERY_LABELS[mastery.level + 1]}</span>
                )}
              </p>

              {weakLabels.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {weakLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber-ink"
                    >
                      <AlertTriangle size={10} /> {label}
                    </span>
                  ))}
                </div>
              )}

              {nextEvidence.length > 0 && (
                <p className="mt-2 flex items-start gap-1 text-xs text-ink-soft">
                  <ChevronRight size={12} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium text-ink">Next:</span> {nextEvidence.join(' · ')}
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        Durable mastery takes evidence across days — clean sections, connected takes, at-tempo
        performances, and coming back to a song after time away. Practice sessions build it in.
      </p>
    </div>
  );
}
