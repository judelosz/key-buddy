import { ArrowRight, CalendarClock, Music, PartyPopper, TrendingUp } from 'lucide-react';
import { getContent } from '@/core/content/bundled';
import { SONG_MASTERY_LABELS } from '@/core/songMastery/songMastery';
import type { SessionSummary } from '@/ui/store/gameStore';
import { XpChip } from '@/ui/components/XpChip';

/**
 * The session wrap — "Nice session." regardless of length (open-ended by
 * design: stopping after one segment earns the same warmth as ten; doc 03 §9
 * guardrails forbid guilt mechanics).
 */
export function SessionWrap({
  summary,
  onDone,
}: {
  summary: SessionSummary;
  onDone: () => void;
}) {
  const content = getContent();

  return (
    <div
      data-testid="session-wrap"
      className="mx-auto flex max-w-xl flex-col items-center gap-6 py-10 text-center animate-fade-up"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mint-soft text-mint-deep shadow-soft">
        <PartyPopper size={28} />
      </span>
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Nice session.
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          {summary.segmentsCompleted === 0
            ? 'Showing up counts. Everything will be right here tomorrow.'
            : `${summary.segmentsCompleted} item${summary.segmentsCompleted === 1 ? '' : 's'} practiced — every take counted.`}
        </p>
        {summary.practicedHands && summary.segmentsCompleted > 0 && (
          <p className="mt-1.5 text-xs italic text-ink-soft">
            You’ll be a little better at this tomorrow without touching the keys — sleep does
            real work on motor skills.
          </p>
        )}
      </div>

      {(summary.xpHands > 0 || summary.xpHead > 0) && (
        <div className="flex items-center gap-3">
          {summary.xpHands > 0 && <XpChip xp={summary.xpHands} track="hands" />}
          {summary.xpHead > 0 && <XpChip xp={summary.xpHead} track="head" />}
        </div>
      )}

      {summary.tierAdvanced && (
        <div className="flex animate-pop items-center gap-2 rounded-2xl bg-amber-soft px-4 py-2.5 text-sm font-medium text-amber-deep">
          <TrendingUp size={16} /> You leveled up this session!
        </div>
      )}
      {summary.songLevelUps.map(({ songId, level }, i) => (
        <div
          key={`${songId}-${level}`}
          className="flex animate-pop items-center gap-2 rounded-2xl bg-rose-soft px-4 py-2.5 text-sm font-medium text-rose-deep"
          style={{ animationDelay: `${(i + 1) * 120}ms` }}
        >
          <Music size={16} />
          {content.getSong(songId)?.title ?? songId} → {SONG_MASTERY_LABELS[level]}
        </div>
      ))}

      {summary.dueTomorrowCount > 0 && (
        <p className="flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs text-ink-soft">
          <CalendarClock size={13} />
          Due tomorrow: {summary.dueTomorrowCount} skill
          {summary.dueTomorrowCount === 1 ? '' : 's'} — tomorrow’s session weaves them in.
        </p>
      )}

      <button
        type="button"
        onClick={onDone}
        className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
      >
        Back to Missions <ArrowRight size={18} />
      </button>
    </div>
  );
}
