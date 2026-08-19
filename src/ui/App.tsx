import { useEffect, useState } from 'react';
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
import { useAuthStore } from '@/auth/authStore';
import { AuthScreen } from '@/ui/auth/AuthScreen';
import { configureAccountRepository, useLegacyRepository } from '@/data';
import { KeyBuddyMark } from '@/ui/components/KeyBuddyMark';

export default function App() {
  const bypassAuth = import.meta.env.DEV && import.meta.env.VITE_E2E_BYPASS_AUTH === 'true';
  return bypassAuth ? <AuthenticatedApp userId={null} /> : <AuthBoundary />;
}

function AuthBoundary() {
  const initAuth = useAuthStore((s) => s.init);
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const recoveryMode = useAuthStore((s) => s.recoveryMode);
  const error = useAuthStore((s) => s.error);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  if (status === 'loading') return <AppLoading label="Opening your music room…" />;
  if (recoveryMode || status === 'signed-out') return <AuthScreen />;
  if (status === 'error' || !user) {
    return <AppLoading label={error ?? 'Account services are unavailable right now.'} />;
  }
  return <AuthenticatedApp key={user.id} userId={user.id} />;
}

function AuthenticatedApp({ userId }: { userId: string | null }) {
  useInputWiring();
  const [prepared, setPrepared] = useState(false);
  const initGame = useGameStore((s) => s.init);
  const resetForAccount = useGameStore((s) => s.resetForAccount);

  useEffect(() => {
    if (userId) configureAccountRepository(userId);
    else useLegacyRepository();
    resetForAccount();
    setPrepared(true);
  }, [resetForAccount, userId]);

  useEffect(() => {
    if (prepared) void initGame();
  }, [initGame, prepared]);
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

  if (!prepared || !loaded) return <AppLoading label="Loading your progress…" />;
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

function AppLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <KeyBuddyMark size={58} />
      <p className="font-display text-lg font-semibold text-ink">{label}</p>
    </main>
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
