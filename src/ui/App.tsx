import { useEffect, type ReactNode } from 'react';
import {
  Piano,
  SlidersHorizontal,
  Bug,
  Home,
  Play,
  TrendingUp,
  Zap,
  Flame,
  Coins,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { getContent } from '@/core/content/bundled';
import { useAppStore, type Screen } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';
import { useInputWiring } from '@/ui/hooks/useInputWiring';
import { InputDebug } from '@/ui/screens/InputDebug';
import { Calibration } from '@/ui/screens/Calibration';
import { SessionPlayer } from '@/ui/screens/SessionPlayer';
import { Progress } from '@/ui/screens/Progress';

const NAV: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'play', label: 'Play', icon: Play },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'calibration', label: 'Tune-up', icon: SlidersHorizontal },
  { id: 'input-debug', label: 'Input', icon: Bug },
];

export default function App() {
  useInputWiring();
  const initGame = useGameStore((s) => s.init);
  useEffect(() => {
    void initGame();
  }, [initGame]);
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-8 px-5 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-soft text-amber-deep shadow-soft">
            <Piano size={24} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Piano Pro</h1>
            <p className="text-xs text-ink-soft">Blues · Gospel · Country</p>
          </div>
        </div>
        <nav className="flex gap-1 rounded-full bg-sand p-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setScreen(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                screen === id
                  ? 'bg-surface text-ink shadow-soft'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main>
        {screen === 'home' && <HomeScreen />}
        {screen === 'play' && <SessionPlayer />}
        {screen === 'progress' && <Progress />}
        {screen === 'calibration' && <Calibration />}
        {screen === 'input-debug' && <InputDebug />}
      </main>
    </div>
  );
}

function HomeScreen() {
  const content = getContent();
  const setScreen = useAppStore((s) => s.setScreen);
  const player = useGameStore((s) => s.player);
  const unlockProgress = useGameStore((s) => s.unlockProgress);

  const nextLocked = content.songs
    .filter((s) => s.requiredSkills.length > 0)
    .map((s) => ({ song: s, prog: unlockProgress(s) }))
    .find(({ prog }) => !prog.unlocked);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero — the thesis: get playing. */}
      <section className="relative overflow-hidden rounded-[2rem] bg-surface p-8 shadow-soft">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-soft opacity-70 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-24 h-40 w-40 rounded-full bg-rose-soft opacity-60 blur-2xl" />
        <div className="relative">
          <p className="font-display text-sm font-medium uppercase tracking-wide text-rose-deep">
            Today&rsquo;s practice
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            Ready to play?
          </h2>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            A few good takes a day. Earn stars by playing in time, and unlock new songs by getting
            better — never by grinding.
          </p>
          <button
            type="button"
            onClick={() => setScreen('play')}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
          >
            <Play size={18} className="fill-ink" /> Play a song
          </button>
        </div>
      </section>

      {/* HUD */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HudChip icon={<TrendingUp size={16} />} label="Tier" value={player.currentPlayingTier} tone="mint" />
        <HudChip icon={<Zap size={16} />} label="Level" value={player.playerLevel} tone="peri" />
        <HudChip icon={<Coins size={16} />} label="Riffs" value={player.riffs} tone="amber" />
        <HudChip icon={<Flame size={16} />} label="Streak" value={`${player.streak}d`} tone="rose" />
      </div>

      {/* Next unlock teaser */}
      {nextLocked && (
        <button
          type="button"
          onClick={() => setScreen('play')}
          className="group flex items-center justify-between rounded-3xl bg-surface p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <Lock size={12} /> Next to unlock
            </div>
            <div className="mt-0.5 font-display text-lg font-semibold text-ink">
              {nextLocked.song.title}
            </div>
            <div className="mt-2 h-2 w-56 max-w-full overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-mint-deep/70 transition-[width] duration-700"
                style={{
                  width: `${Math.round(
                    (nextLocked.prog.masteredCount / nextLocked.prog.requiredCount) * 100,
                  )}%`,
                }}
              />
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              {nextLocked.prog.masteredCount}/{nextLocked.prog.requiredCount} skills mastered
            </div>
          </div>
          <ArrowRight
            size={20}
            className="shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-ink"
          />
        </button>
      )}
    </div>
  );
}

const TONES = {
  rose: 'bg-rose-soft text-rose-deep',
  amber: 'bg-amber-soft text-amber-deep',
  mint: 'bg-mint-soft text-mint-deep',
  peri: 'bg-peri-soft text-peri-deep',
} as const;

function HudChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: keyof typeof TONES;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${TONES[tone]}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/70">
        {icon}
      </span>
      <div>
        <div className="font-display text-xl font-semibold leading-none tabular-nums">{value}</div>
        <div className="mt-0.5 text-xs opacity-80">{label}</div>
      </div>
    </div>
  );
}
