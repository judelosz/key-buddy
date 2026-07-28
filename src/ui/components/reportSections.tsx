/**
 * Take-report building blocks, extracted from SessionReport so lesson results
 * can show the same honest timing detail (doc-08 §3.15–3.16: error-location
 * feedback is the best-evidenced part of a report).
 */
import { AlertTriangle, Lightbulb } from 'lucide-react';
import type { Attempt, Chart } from '@/core/types';
import { barAccuracies } from '@/core/scoring/feedback';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function TimingHistogramCard({ attempt }: { attempt: Attempt }) {
  const mean = Math.round(attempt.timingHistogram.meanMs);
  const feel = mean <= -8 ? 'rushing' : mean >= 8 ? 'dragging' : 'on the beat';
  const maxBucket = Math.max(1, ...attempt.timingHistogram.buckets.map((b) => b.count));
  return (
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
  );
}

export function BarHeatMapCard({ attempt, chart }: { attempt: Attempt; chart: Chart }) {
  const bars = barAccuracies(attempt, chart);
  return (
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
        <span className="font-semibold text-grade-miss">red badge</span> marks how many wrong notes
        landed in that bar.
      </p>
    </div>
  );
}

export function TipCard({ tip }: { tip: string }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl bg-amber-soft p-5">
      <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-deep" />
      <p className="text-sm text-ink">{tip}</p>
    </div>
  );
}

/** Red → green by accuracy, pastel-tuned for the light theme. */
function heat(pctCorrect: number): string {
  const hue = Math.round(pctCorrect * 120); // 0 red → 120 green
  return `hsl(${hue} 60% 78%)`;
}
