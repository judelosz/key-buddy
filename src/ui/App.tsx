import { useEffect } from 'react';
import { useAppStore } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';
import { useInputWiring } from '@/ui/hooks/useInputWiring';
import { getContent } from '@/core/content/bundled';
import { AppShell } from '@/ui/shell/AppShell';
import { Onboarding } from '@/ui/onboarding/Onboarding';
import { Missions } from '@/ui/missions/Missions';
import { LessonRunner } from '@/ui/missions/LessonRunner';
import { SessionRunner } from '@/ui/session/SessionRunner';
import { FreePlay } from '@/ui/screens/FreePlay';
import { Progress } from '@/ui/screens/Progress';
import { Settings } from '@/ui/screens/Settings';
import { AfkComingSoon } from '@/ui/screens/AfkComingSoon';

export default function App() {
  useInputWiring();
  const initGame = useGameStore((s) => s.init);
  useEffect(() => {
    void initGame();
  }, [initGame]);
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const sessionActive = useAppStore((s) => s.sessionActive);
  const activeLesson = useAppStore((s) => s.activeLesson);
  const freePlayActive = useAppStore((s) => s.freePlayActive);
  const activeLessonView = useActiveLessonView();
  const showOnboarding = useAppStore((s) => s.showOnboarding);
  const setShowOnboarding = useAppStore((s) => s.setShowOnboarding);
  const loaded = useGameStore((s) => s.loaded);
  const player = useGameStore((s) => s.player);

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
    <AppShell
      screen={screen}
      onNavigate={setScreen}
      focusMode={sessionActive || activeLesson !== null || freePlayActive}
    >
      <>
        {screen === 'missions' &&
          (sessionActive ? <SessionRunner /> : (activeLessonView ?? <Missions />))}
        {screen === 'free-play' && <FreePlay />}
        {screen === 'afk' && <AfkComingSoon />}
        {screen === 'progress' && <Progress />}
        {screen === 'settings' && <Settings />}
      </>
    </AppShell>
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
