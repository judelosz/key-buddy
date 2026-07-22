import { Lightbulb, RotateCcw, Star, Zap, Coins, Sparkles, Unlock, Flame } from 'lucide-react';
import type { Attempt, Chart, Song } from '@/core/types';
import { barAccuracies, generateTip } from '@/core/scoring/feedback';
import type { AttemptReward } from '@/core/session/recordAttempt';
import { getContent } from '@/core/content/bundled';

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
    <div className="flex flex-col gap-6" data-testid="session-report">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Session report</p>
          <h2 className="text-xl font-semibold tracking-tight">{song.title}</h2>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              size={30}
              className={s <= attempt.stars ? 'fill-grade-good text-grade-good' : 'text-ink-line'}
            />
          ))}
        </div>
      </div>

      {attempt.masteryStar && (
        <div className="flex items-center gap-2 rounded-lg border border-grade-perfect/40 bg-grade-perfect/10 px-4 py-2 text-sm text-grade-perfect">
          <Star size={16} className="fill-grade-perfect" /> Mastery star — 3 stars at target tempo,
          un-assisted.
        </div>
      )}

      {reward && <RewardPanel reward={reward} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Notes correct" value={pct(attempt.notesCorrectPct)} />
        <Metric label="Good+ timing" value={pct(attempt.goodOrBetterPct)} />
        <Metric label="Great+ timing" value={pct(attempt.greatOrBetterPct)} />
        <Metric label="Tempo" value={`${Math.round(attempt.tempoBPM)} BPM`} sub={attempt.atTempo ? 'at target' : 'slowed'} />
      </div>

      <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-300">Timing</h3>
          <span className="text-xs text-neutral-500">
            avg {mean > 0 ? '+' : ''}
            {mean} ms — {feel}
          </span>
        </div>
        <div className="flex h-24 items-end justify-center gap-[3px]">
          {attempt.timingHistogram.buckets.length === 0 ? (
            <p className="text-sm text-neutral-500">No timed hits.</p>
          ) : (
            attempt.timingHistogram.buckets.map((b) => (
              <div key={b.centerMs} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t ${
                    b.centerMs < 0 ? 'bg-grade-early' : b.centerMs > 0 ? 'bg-grade-late' : 'bg-grade-perfect'
                  }`}
                  style={{ height: `${(b.count / maxBucket) * 72}px` }}
                />
                <span className="text-[9px] text-neutral-600">{b.centerMs}</span>
              </div>
            ))
          )}
        </div>
        <p className="mt-1 text-center text-[10px] text-neutral-600">
          ms early (orange) ← 0 → ms late (purple)
        </p>
      </div>

      <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
        <h3 className="mb-2 text-sm font-medium text-neutral-300">Weak-bar heat-map</h3>
        <div className="flex flex-wrap gap-1.5">
          {bars.map((b) => (
            <div
              key={b.bar}
              title={`Bar ${b.bar + 1}: ${pct(b.correctPct)} correct`}
              className="flex h-9 w-9 items-center justify-center rounded text-xs font-medium"
              style={{ backgroundColor: heat(b.correctPct), color: b.correctPct > 0.5 ? '#0f1115' : '#e8eaed' }}
            >
              {b.bar + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-grade-good/30 bg-grade-good/5 p-4">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-grade-good" />
        <p className="text-sm text-neutral-200">{tip}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-grade-perfect px-4 py-2 text-sm font-medium text-ink"
        >
          <RotateCcw size={16} /> Play again
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-ink-line px-4 py-2 text-sm text-neutral-300"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function RewardPanel({ reward }: { reward: AttemptReward }) {
  const content = getContent();
  const unlockedTitles = reward.newlyUnlockedSongIds
    .map((id) => content.getSong(id)?.title)
    .filter((t): t is string => Boolean(t));
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink-line bg-ink-soft p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" data-testid="reward-panel">
        <span className="inline-flex items-center gap-1.5 text-grade-perfect">
          <Zap size={16} /> +{reward.xp} XP
        </span>
        <span className="inline-flex items-center gap-1.5 text-grade-good">
          <Coins size={16} /> +{reward.riffs} Riffs
        </span>
        <span className="inline-flex items-center gap-1.5 text-neutral-300">
          <Flame size={16} /> {reward.streak}-day streak
          {reward.usedFreeze && <span className="text-xs text-neutral-500">(freeze used)</span>}
        </span>
        {reward.leveledUp && (
          <span className="inline-flex items-center gap-1.5 font-medium text-grade-perfect">
            <Sparkles size={16} /> Level up!
          </span>
        )}
      </div>

      {reward.encoreTriggered && (
        <div className="flex items-center gap-2 rounded-lg bg-grade-good/10 px-3 py-1.5 text-sm text-grade-good">
          <Sparkles size={15} /> Encore bonus! +{reward.encoreRiffs} Riffs for a great take.
        </div>
      )}

      {unlockedTitles.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-grade-perfect/10 px-3 py-1.5 text-sm text-grade-perfect">
          <Unlock size={15} /> Unlocked: {unlockedTitles.join(', ')} — you earned it by getting better.
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-ink px-4 py-3">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-400">{label}</div>
      {sub && <div className="text-[10px] text-neutral-500">{sub}</div>}
    </div>
  );
}

/** Red → yellow → green by accuracy. */
function heat(pctCorrect: number): string {
  const hue = Math.round(pctCorrect * 120); // 0 red → 120 green
  return `hsl(${hue} 65% 45%)`;
}
