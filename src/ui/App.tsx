import { Piano } from 'lucide-react';
import { getContent } from '@/core/content/bundled';

export default function App() {
  const content = getContent();

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-grade-perfect/15 text-grade-perfect">
          <Piano size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Piano Pro</h1>
          <p className="text-sm text-neutral-400">
            Learn blues, gospel &amp; country — one honest rep at a time.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-ink-line bg-ink-soft p-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
          Content loaded
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Skills" value={content.skills.length} />
          <Stat label="Songs" value={content.songs.length} />
          <Stat
            label="Blues"
            value={content.songsByGenre('blues').length}
          />
          <Stat
            label="Foundation"
            value={content.songsByGenre('foundation').length}
          />
        </div>
      </section>

      <p className="text-sm text-neutral-500">
        Phase 0 scaffold. Input, audio, and the scoring engine come next.
      </p>
    </div>
  );
}

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-xl bg-ink px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}
