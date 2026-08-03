import type { ReactNode } from 'react';
import { RotateCcw, Star, Zap, Coins, Sparkles, Unlock, Flame } from 'lucide-react';
import type { Attempt, Chart, Song } from '@/core/types';
import { generateTip } from '@/core/scoring/feedback';
import type { AttemptReward } from '@/core/session/recordAttempt';
import { getContent } from '@/core/content/bundled';
import { useCountUp } from '@/ui/hooks/useCountUp';
import { BarHeatMapCard, GradeBadge, SwingRatioCard, TimingHistogramCard, TipCard } from '@/ui/components/reportSections';

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
  const tip = generateTip(attempt, chart);

  return (
    <div className="flex flex-col gap-5" data-testid="session-report">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display text-xs font-medium uppercase tracking-wide text-rose-ink">
            Session report
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{song.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <GradeBadge attempt={attempt} />
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                size={34}
                style={{ animationDelay: `${s * 120}ms` }}
                className={
                  s <= attempt.stars
                    ? 'animate-pop fill-amber text-amber-ink'
                    : 'text-line'
                }
              />
            ))}
          </div>
        </div>
      </div>

      {attempt.masteryStar && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-2.5 text-sm font-medium text-mint-ink">
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

      <TimingHistogramCard attempt={attempt} />

      <SwingRatioCard attempt={attempt} />

      <BarHeatMapCard attempt={attempt} chart={chart} />

      <TipCard tip={tip} />

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
        <div className="flex animate-fade-up items-center gap-2 rounded-2xl bg-amber-soft px-3 py-2 text-sm font-medium text-amber-ink">
          <Sparkles size={15} /> Encore! +{reward.encoreRiffs} bonus Riffs for a great take.
        </div>
      )}

      {unlockedTitles.length > 0 && (
        <div className="flex animate-fade-up items-center gap-2 rounded-2xl bg-mint-soft px-3 py-2 text-sm font-medium text-mint-ink">
          <Unlock size={15} /> Unlocked {unlockedTitles.join(', ')} — earned by getting better.
        </div>
      )}
    </div>
  );
}

const CHIP_TONES = {
  amber: 'bg-amber-soft text-amber-ink',
  mint: 'bg-mint-soft text-mint-ink',
  rose: 'bg-rose-soft text-rose-ink',
  peri: 'bg-peri-soft text-peri-ink',
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
