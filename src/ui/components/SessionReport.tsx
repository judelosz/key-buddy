import type { ReactNode } from 'react';
import {
  Lightbulb,
  RotateCcw,
  Star,
  Zap,
  Coins,
  Sparkles,
  Unlock,
  Flame,
  AlertTriangle,
} from 'lucide-react';
import type { Attempt, Chart, Song } from '@/core/types';
import { barAccuracies, generateTip } from '@/core/scoring/feedback';
import type { AttemptReward } from '@/core/session/recordAttempt';
import { getContent } from '@/core/content/bundled';
import { useCountUp } from '@/ui/hooks/useCountUp';

interface SessionReportProps {
  attempt: Attempt;
  chart: Chart;
  song: Song;
  reward: AttemptReward | null;
  onRetry: () => void;
  onDone: () => void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function SessionReport({ attempt, chart, song, reward, onRetry, onDone }: SessionReportProps) {
  const bars = barAccuracies(attempt, chart);
  const tip = generateTip(attempt, chart);
  const mean = Math.round(attempt.timingHistogram.meanMs);
  const feel = mean <= -8 ? 'rushing' : mean >= 8 ? 'dragging' : 'on the beat';
  const maxBucket = Math.max(1, ...attempt.timingHistogram.buckets.map((b) => b.count));

  return (
    <div className="flex flex-col gap-5" data-testid="session-report">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display text-xs font-medium uppercase tracking-wide text-rose-deep">
            Session report
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{song.title}</h2>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              size={34}
              style={{ animationDelay: `${s * 120}ms` }}
              className={
                s <= attempt.stars
                  ? 'animate-pop fill-amber text-amber-deep'
                  : 'text-line'
              }
            />
          ))}
        </div>
      </div>

      {attempt.masteryStar && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-2.5 text-sm font-medium text-mint-deep">
          <Star size={16} className="fill-mint-deep" /> Mastery star — 3 stars at target tempo,
          un-assisted.
        </div>
      )}

      {reward && <RewardPanel reward={reward} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Accuracy"
          value={pct(attempt.notesCorrectPct)}
          sub={attempt.extraNotes > 0 ? `${attempt.extraNotes} extra note${attempt.extraNotes === 1 ? '' : 's'}` : undefined}
        />
        <Metric label="Good+ timing" value={pct(attempt.goodOrBetterPct)} />
        <Metric label="Great+ timing" value={pct(attempt.greatOrBetterPct)} />
        <Metric
          label="Tempo"
          value={`${Math.round(attempt.tempoBPM)} BPM`}
          sub={attempt.atTempo ? 'at target' : 'slowed'}
        />
      </div>

      <div className="rounded-3xl bg-surface p-5 shadow-soft">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-ink">Timing</h3>
          <span className="text-xs text-ink-soft">
            avg {mean > 0 ? '+' : ''}
            {mean} ms — {feel}
          </span>
        </div>
        <div className="flex h-24 items-end justify-center gap-[3px]">
          {attempt.timingHistogram.buckets.length === 0 ? (
            <p className="text-sm text-ink-soft">No timed hits.</p>
          ) : (
            attempt.timingHistogram.buckets.map((b) => (
              <div key={b.centerMs} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-lg ${
                    b.centerMs < 0 ? 'bg-grade-early' : b.centerMs > 0 ? 'bg-grade-late' : 'bg-grade-perfect'
                  }`}
                  style={{ height: `${(b.count / maxBucket) * 72}px` }}
                />
                <span className="text-[9px] text-ink-soft">{b.centerMs}</span>
              </div>
            ))
          )}
        </div>
        <p className="mt-1 text-center text-[10px] text-ink-soft">
          ms early (orange) ← 0 → ms late (purple)
        </p>
      </div>

      <div className="rounded-3xl bg-surface p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-ink">Trouble spots by bar</h3>
          {attempt.extraNotes > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-grade-miss/10 px-2.5 py-1 text-xs font-medium text-grade-miss">
              <AlertTriangle size={13} /> {attempt.extraNotes} wrong note
              {attempt.extraNotes === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {bars.map((b) => (
            <div key={b.bar} className="relative">
              <div
                title={`Bar ${b.bar + 1}: ${pct(b.correctPct)} correct${
                  b.wrong > 0 ? `, ${b.wrong} wrong note${b.wrong === 1 ? '' : 's'}` : ''
                }`}
                className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-xs font-semibold text-ink"
                style={{ backgroundColor: heat(b.score) }}
              >
                {b.bar + 1}
              </div>
              {b.wrong > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-grade-miss px-1 text-[10px] font-bold text-white shadow-soft">
                  {b.wrong}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Greener bars are cleaner; redder bars had misses or wrong notes. A{' '}
          <span className="font-semibold text-grade-miss">red badge</span> marks how many wrong
          notes landed in that bar.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-3xl bg-amber-soft p-5">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-deep" />
        <p className="text-sm text-ink">{tip}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-rose px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
        >
          <RotateCcw size={16} /> Play again
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full bg-sand px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function RewardPanel({ reward }: { reward: AttemptReward }) {
  const content = getContent();
  const xp = useCountUp(reward.xp);
  const riffs = useCountUp(reward.riffs);
  const unlockedTitles = reward.newlyUnlockedSongIds
    .map((id) => content.getSong(id)?.title)
    .filter((t): t is string => Boolean(t));

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-soft" data-testid="reward-panel">
      <div className="flex flex-wrap gap-2.5">
        <RewardChip icon={<Zap size={16} />} tone="amber" value={`+${xp}`} label="XP" />
        <RewardChip icon={<Coins size={16} />} tone="mint" value={`+${riffs}`} label="Riffs" />
        <RewardChip
          icon={<Flame size={16} />}
          tone="rose"
          value={reward.streak}
          label={`day streak${reward.usedFreeze ? ' · freeze' : ''}`}
        />
        {reward.leveledUp && (
          <RewardChip icon={<Sparkles size={16} />} tone="peri" value="" label="Level up!" />
        )}
      </div>

      {reward.encoreTriggered && (
        <div className="flex animate-fade-up items-center gap-2 rounded-2xl bg-amber-soft px-3 py-2 text-sm font-medium text-amber-deep">
          <Sparkles size={15} /> Encore! +{reward.encoreRiffs} bonus Riffs for a great take.
        </div>
      )}

      {unlockedTitles.length > 0 && (
        <div className="flex animate-fade-up items-center gap-2 rounded-2xl bg-mint-soft px-3 py-2 text-sm font-medium text-mint-deep">
          <Unlock size={15} /> Unlocked {unlockedTitles.join(', ')} — earned by getting better.
        </div>
      )}
    </div>
  );
}

const CHIP_TONES = {
  amber: 'bg-amber-soft text-amber-deep',
  mint: 'bg-mint-soft text-mint-deep',
  rose: 'bg-rose-soft text-rose-deep',
  peri: 'bg-peri-soft text-peri-deep',
} as const;

function RewardChip({
  icon,
  tone,
  value,
  label,
}: {
  icon: ReactNode;
  tone: keyof typeof CHIP_TONES;
  value: string | number;
  label: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${CHIP_TONES[tone]}`}>
      {icon}
      <span className="font-display text-base font-semibold tabular-nums">{value}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-sand px-4 py-3">
      <div className="font-display text-lg font-semibold tabular-nums text-ink">{value}</div>
      <div className="text-xs text-ink-soft">{label}</div>
      {sub && <div className="text-[10px] text-ink-soft">{sub}</div>}
    </div>
  );
}

/** Red → green by accuracy, pastel-tuned for the light theme. */
function heat(pctCorrect: number): string {
  const hue = Math.round(pctCorrect * 120); // 0 red → 120 green
  return `hsl(${hue} 60% 78%)`;
}
