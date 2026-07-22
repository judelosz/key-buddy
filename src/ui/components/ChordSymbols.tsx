import type { Chart } from '@/core/types';

interface ChordSymbolsProps {
  chart: Chart;
  currentBar: number;
}

/** Primary "notation" for these genres: the chord progression as a bar strip,
 * with the current bar highlighted (doc 01 §10 — chord-symbol literacy first). */
export function ChordSymbols({ chart, currentBar }: ChordSymbolsProps) {
  if (chart.chordSymbols.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="chord-symbols">
      {chart.chordSymbols.map((cs, i) => (
        <div
          key={`${cs.bar}-${cs.beat}-${i}`}
          className={`min-w-[52px] rounded-md border px-2.5 py-1.5 text-center text-sm font-semibold transition-colors ${
            cs.bar === currentBar
              ? 'border-grade-perfect bg-grade-perfect/15 text-grade-perfect'
              : 'border-ink-line bg-ink text-neutral-300'
          }`}
        >
          {cs.symbol}
        </div>
      ))}
    </div>
  );
}
