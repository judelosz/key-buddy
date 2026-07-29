import type { ReactNode } from 'react';
import {
  Armchair,
  Brain,
  Hand,
  Lock,
  Map,
  Music,
  Play,
  RefreshCcw,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import type { Screen } from '@/ui/store/appStore';
import { useAppStore } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';
import { getContent } from '@/core/content/bundled';
import { gateRequirementsRemaining } from '@/core/curriculum/tierGate';
import { GateRing, gateRingSegments } from '@/ui/components/GateRing';
import { MidiConnectButton } from '@/ui/components/MidiConnectButton';
import { KeyBuddyMark } from '@/ui/components/KeyBuddyMark';

interface AppShellProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  focusMode?: boolean;
  children: ReactNode;
}

const NAV: { id: Screen; label: string; icon: typeof Map }[] = [
  { id: 'missions', label: 'Missions', icon: Map },
  { id: 'free-play', label: 'Free Play', icon: Music },
  { id: 'afk', label: 'AFK Mode', icon: Armchair },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

export function AppShell({ screen, onNavigate, focusMode = false, children }: AppShellProps) {
  return (
    <div
      data-testid={focusMode ? 'focus-shell' : 'app-shell'}
      className={`mx-auto min-h-full w-full px-5 py-5 sm:px-6 ${
        focusMode ? 'max-w-[70rem] lg:px-8 lg:py-7' : 'max-w-[92.5rem] lg:px-5 xl:px-6'
      }`}
    >
      <div className={focusMode ? 'hidden' : ''}>
        <CompactHeader screen={screen} onNavigate={onNavigate} />
      </div>
      <div
        className={
          focusMode
            ? ''
            : 'lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[13.5rem_minmax(0,1fr)_16rem]'
        }
      >
        <div className={focusMode ? 'hidden' : ''}>
          <NavigationRail screen={screen} onNavigate={onNavigate} />
        </div>
        <main className={`min-w-0 ${focusMode ? '' : 'pt-6 lg:pt-2'}`}>
          <div className={`mx-auto w-full ${focusMode ? 'max-w-[70rem]' : 'max-w-[60rem]'}`}>
            {children}
          </div>
        </main>
        <div className={focusMode ? 'hidden' : ''}>
          <PlayerRail screen={screen} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'justify-center' : 'gap-3'}`}>
      <KeyBuddyMark size={44} />
      {!compact && (
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Key-Buddy</h1>
          <p className="text-xs leading-tight text-ink-soft">Your modern music room</p>
        </div>
      )}
    </div>
  );
}

function NavigationRail({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <aside
      data-testid="navigation-rail"
      className="sticky top-5 hidden h-[calc(100vh-2.5rem)] flex-col rounded-[1.75rem] border border-line bg-surface/80 p-2 shadow-soft backdrop-blur-sm lg:flex xl:p-3"
    >
      <div className="px-1 py-2 xl:px-2">
        <div className="xl:hidden">
          <Brand compact />
        </div>
        <div className="hidden xl:block">
          <Brand />
        </div>
      </div>
      <nav className="mt-5 flex flex-1 flex-col gap-1.5" aria-label="Primary navigation">
        {NAV.filter((item) => item.id !== 'settings').map((item) => (
          <RailButton key={item.id} item={item} active={screen === item.id} onNavigate={onNavigate} />
        ))}
      </nav>
      {NAV.filter((item) => item.id === 'settings').map((item) => (
        <RailButton key={item.id} item={item} active={screen === item.id} onNavigate={onNavigate} />
      ))}
    </aside>
  );
}

function RailButton({
  item,
  active,
  onNavigate,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={`group relative flex min-h-12 items-center justify-center gap-3 rounded-2xl px-3 text-sm font-semibold transition xl:justify-start ${
        active
          ? 'bg-amber-soft text-ink shadow-[inset_0_-2px_0_rgba(199,148,69,0.20)]'
          : 'text-ink-soft hover:bg-sand/70 hover:text-ink'
      }`}
    >
      {active && <span className="absolute -left-1 h-5 w-1 rounded-full bg-amber-deep xl:-left-1.5" />}
      <Icon size={19} className="shrink-0" />
      <span className="hidden xl:inline">{item.label}</span>
    </button>
  );
}

function CompactHeader({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const meter = useGameStore((s) => s.levelMeter)();
  const gateStatus = useGameStore((s) => s.tierGateStatus)();
  return (
    <header className="lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <Brand />
        <button
          type="button"
          onClick={() => onNavigate('progress')}
          aria-label="View your progress"
          className="rounded-full transition hover:-translate-y-px active:translate-y-px"
        >
          <GateRing level={meter.level} segments={gateRingSegments(gateStatus)} />
        </button>
      </div>
      <nav
        aria-label="Primary navigation"
        className="mt-4 flex gap-1 overflow-x-auto rounded-2xl bg-sand p-1"
      >
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={screen === id ? 'page' : undefined}
            className={`inline-flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              screen === id ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}

function PlayerRail({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const player = useGameStore((s) => s.player);
  const meter = useGameStore((s) => s.levelMeter)();
  const gateStatus = useGameStore((s) => s.tierGateStatus)();
  const dueReviewSkillIds = useGameStore((s) => s.dueReviewSkillIds);
  const unlockProgress = useGameStore((s) => s.unlockProgress);
  const startSession = useGameStore((s) => s.startSession);
  const setSessionActive = useAppStore((s) => s.setSessionActive);
  const inputStatus = useAppStore((s) => s.inputStatus);
  const content = getContent();
  const headBand = content.tierGates.find((gate) => gate.tier === meter.level)?.headXpBand;
  const dueCount = dueReviewSkillIds().length;
  const sessionsUnlocked = player.learningTier >= 2;
  const nextRequirement = gateStatus ? gateRequirementsRemaining(gateStatus)[0] : undefined;
  const nextLocked = content.songs
    .filter((song) => song.requiredSkills.length > 0)
    .map((song) => ({ song, progress: unlockProgress(song) }))
    .find(({ progress }) => !progress.unlocked);

  const beginPractice = () => {
    void startSession().then(() => setSessionActive(true));
  };

  return (
    <aside
      data-testid="player-rail"
      className="sticky top-5 hidden h-fit flex-col gap-4 self-start xl:flex"
    >
      <button
        type="button"
        onClick={() => onNavigate('progress')}
        aria-label="View your progress"
        className="flex flex-col items-center rounded-[1.75rem] border border-line bg-surface p-5 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
      >
        <GateRing level={meter.level} segments={gateRingSegments(gateStatus)} size={88} />
        <span className="mt-3 font-display text-sm font-semibold text-ink">Level {meter.level} gate</span>
        <span className="mt-1 text-xs leading-relaxed text-ink-soft">
          {nextRequirement ?? 'Every authored gate is complete.'}
        </span>
      </button>

      <section className="rounded-[1.75rem] border border-line bg-surface p-4 shadow-soft">
        <TrackMeter
          icon={<Hand size={15} />}
          label="Hands"
          current={meter.tierHandsXP}
          target={meter.band}
          fillClass="bg-amber-deep"
          iconClass="text-amber-ink"
        />
        <div className="my-3 h-px bg-line" />
        <TrackMeter
          icon={<Brain size={15} />}
          label="Head"
          current={player.tierHeadXP}
          target={headBand ?? Math.max(1, player.tierHeadXP)}
          fillClass="bg-peri-deep"
          iconClass="text-peri-ink"
        />
      </section>

      {screen === 'missions' && (
        <section className="rounded-[1.75rem] bg-peri-soft p-4">
          <p className="font-display text-sm font-semibold text-peri-ink">
            {dueCount > 0 ? `${dueCount} review${dueCount === 1 ? '' : 's'} ready` : 'Daily practice'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {sessionsUnlocked
              ? 'A balanced mix of review, songs, and one useful surprise.'
              : 'Unlocks when you pass Tier 1.'}
          </p>
          {sessionsUnlocked ? (
            <button
              type="button"
              onClick={beginPractice}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-surface px-4 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px active:translate-y-px"
            >
              {dueCount > 0 ? <RefreshCcw size={15} /> : <Play size={15} className="fill-ink" />}
              Start practice
            </button>
          ) : (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <Lock size={13} /> Keep following Missions
            </p>
          )}
        </section>
      )}

      {(screen === 'missions' || screen === 'free-play') && nextLocked && (
        <button
          type="button"
          onClick={() => onNavigate('free-play')}
          className="rounded-[1.75rem] border border-line bg-surface p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <Lock size={12} /> Next song
          </span>
          <span className="mt-1 block font-display text-base font-semibold text-ink">
            {nextLocked.song.title}
          </span>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-sand">
            <span
              className="block h-full rounded-full bg-mint-deep transition-[width] duration-700"
              style={{
                width: `${Math.round(
                  (nextLocked.progress.masteredCount /
                    Math.max(1, nextLocked.progress.requiredCount)) *
                    100,
                )}%`,
              }}
            />
          </span>
          <span className="mt-1 block text-xs text-ink-soft">
            {nextLocked.progress.masteredCount}/{nextLocked.progress.requiredCount} skills
          </span>
        </button>
      )}

      <section className="rounded-[1.75rem] border border-line bg-surface p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-ink">Piano input</p>
            <p className="truncate text-xs text-ink-soft">
              {inputStatus.kind === 'ready' && inputStatus.source === 'midi'
                ? inputStatus.deviceName
                : inputStatus.kind === 'ready'
                  ? 'Virtual keys ready'
                  : 'Virtual keys available'}
            </p>
          </div>
          <MidiConnectButton compact />
        </div>
      </section>
    </aside>
  );
}

function TrackMeter({
  icon,
  label,
  current,
  target,
  fillClass,
  iconClass,
}: {
  icon: ReactNode;
  label: string;
  current: number;
  target: number;
  fillClass: string;
  iconClass: string;
}) {
  const fraction = Math.min(1, current / Math.max(1, target));
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`flex items-center gap-1.5 font-semibold ${iconClass}`}>
          {icon} {label}
        </span>
        <span className="tabular-nums text-ink-soft">
          {Math.min(current, target)}/{target}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
        <span
          className={`block h-full rounded-full transition-[width] duration-700 ${fillClass}`}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
    </div>
  );
}
