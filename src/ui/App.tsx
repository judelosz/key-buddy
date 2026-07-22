import { Piano, SlidersHorizontal, Bug, Home, Play } from 'lucide-react';
import { getContent } from '@/core/content/bundled';
import { useAppStore, type Screen } from '@/ui/store/appStore';
import { useInputWiring } from '@/ui/hooks/useInputWiring';
import { InputDebug } from '@/ui/screens/InputDebug';
import { Calibration } from '@/ui/screens/Calibration';
import { SessionPlayer } from '@/ui/screens/SessionPlayer';

const NAV: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'play', label: 'Play', icon: Play },
  { id: 'calibration', label: 'Calibration', icon: SlidersHorizontal },
  { id: 'input-debug', label: 'Input debug', icon: Bug },
];

export default function App() {
  useInputWiring();
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-ink-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grade-perfect/15 text-grade-perfect">
            <Piano size={22} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Piano Pro</h1>
            <p className="text-xs text-neutral-500">Blues · Gospel · Country</p>
          </div>
        </div>
        <nav className="flex gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setScreen(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                screen === id
                  ? 'bg-ink-line text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {screen === 'home' && <HomeScreen />}
        {screen === 'play' && <SessionPlayer />}
        {screen === 'calibration' && <Calibration />}
        {screen === 'input-debug' && <InputDebug />}
      </main>
    </div>
  );
}

function HomeScreen() {
  const content = getContent();
  const setScreen = useAppStore((s) => s.setScreen);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-ink-line bg-ink-soft p-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
          Content loaded
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Skills" value={content.skills.length} />
          <Stat label="Songs" value={content.songs.length} />
          <Stat label="Blues" value={content.songsByGenre('blues').length} />
          <Stat label="Foundation" value={content.songsByGenre('foundation').length} />
        </div>
      </section>

      <section className="rounded-2xl border border-ink-line bg-ink-soft p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
          Foundation — build status
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-neutral-300">
          <li>✅ Phase 0 — scaffold, domain model, content service</li>
          <li>✅ Phase 1 — input (MIDI + virtual), audio, scoring engine</li>
          <li className="text-neutral-500">◻︎ Phase 2 — playable song loop (next)</li>
          <li className="text-neutral-500">◻︎ Phase 3 — progression, rewards, persistence</li>
        </ul>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setScreen('calibration')}
            className="rounded-lg bg-grade-perfect px-3 py-1.5 text-sm font-medium text-ink"
          >
            Calibrate input
          </button>
          <button
            type="button"
            onClick={() => setScreen('input-debug')}
            className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-neutral-300"
          >
            Open input debug
          </button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-ink px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}
