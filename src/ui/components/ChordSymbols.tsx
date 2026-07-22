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
          className={`min-w-[52px] rounded-xl px-2.5 py-1.5 text-center font-display text-sm font-semibold transition ${
            cs.bar === currentBar
              ? 'scale-105 bg-rose text-ink shadow-soft'
              : 'bg-sand text-ink-soft'
          }`}
        >
          {cs.symbol}
        </div>
      ))}
    </div>
  );
}
