import { useEffect } from 'react';
import {
  Piano,
  Map,
  Music,
  Armchair,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import { useAppStore, type Screen } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';
import { useInputWiring } from '@/ui/hooks/useInputWiring';
import { getContent } from '@/core/content/bundled';
import { LevelMeter } from '@/ui/components/LevelMeter';
import { Onboarding } from '@/ui/onboarding/Onboarding';
import { Missions } from '@/ui/missions/Missions';
import { LessonRunner } from '@/ui/missions/LessonRunner';
import { FreePlay } from '@/ui/screens/FreePlay';
import { Progress } from '@/ui/screens/Progress';
import { Settings } from '@/ui/screens/Settings';
import { AfkComingSoon } from '@/ui/screens/AfkComingSoon';

const NAV: { id: Screen; label: string; icon: typeof Map }[] = [
  { id: 'missions', label: 'Missions', icon: Map },
  { id: 'free-play', label: 'Free Play', icon: Music },
  { id: 'afk', label: 'AFK Mode', icon: Armchair },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

export default function App() {
  useInputWiring();
  const initGame = useGameStore((s) => s.init);
  useEffect(() => {
    void initGame();
  }, [initGame]);
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const activeLessonView = useActiveLessonView();
  const showOnboarding = useAppStore((s) => s.showOnboarding);
  const setShowOnboarding = useAppStore((s) => s.setShowOnboarding);
  const loaded = useGameStore((s) => s.loaded);
  const player = useGameStore((s) => s.player);
  const meter = useGameStore((s) => s.levelMeter)();

  // First-run: no persisted onboardedAt → land on onboarding, not the shell.
  const firstRun = loaded && player.onboardedAt === undefined;
  useEffect(() => {
    if (firstRun) setShowOnboarding(true);
  }, [firstRun, setShowOnboarding]);

  if (!loaded) return null;
  if (showOnboarding || firstRun) {
    return <Onboarding replay={player.onboardedAt !== undefined} />;
  }

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
        <div className="flex items-center gap-3">
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
                <Icon size={15} /> <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>
          <LevelMeter
            level={meter.level}
            fraction={Math.min(1, meter.tierHandsXP / Math.max(1, meter.band))}
            gatesRemaining={meter.requirementsRemaining.length > 0}
          />
        </div>
      </header>

      <main>
        {screen === 'missions' && (activeLessonView ?? <Missions />)}
        {screen === 'free-play' && <FreePlay />}
        {screen === 'afk' && <AfkComingSoon />}
        {screen === 'progress' && <Progress />}
        {screen === 'settings' && <Settings />}
      </main>
    </div>
  );
}

/** Resolve the open lesson (if any) into its full-screen runner. */
function useActiveLessonView() {
  const activeLesson = useAppStore((s) => s.activeLesson);
  if (!activeLesson) return null;
  const content = getContent();
  const lesson = content.getLesson(activeLesson.lessonId);
  const module = content.getModule(activeLesson.moduleId);
  if (!lesson || !module) return null;
  return <LessonRunner key={lesson.id} lesson={lesson} module={module} />;
}
