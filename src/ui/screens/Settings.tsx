import { useEffect, useState, type ReactNode } from 'react';
import { Cloud, CloudOff, GraduationCap, LogOut, RefreshCw, Save, UserRound, Volume2 } from 'lucide-react';
import { audioService } from '@/audio/audioService';
import { repository, syncAccountProgress } from '@/data';
import { useAppStore } from '@/ui/store/appStore';
import { CalibrationPanel } from '@/ui/components/CalibrationPanel';
import { InputMonitorPanel, InputStatusBanner } from '@/ui/components/InputMonitorPanel';
import { KeyboardHint } from '@/ui/components/KeyboardHint';
import { MidiConnectButton } from '@/ui/components/MidiConnectButton';
import { useAuthStore } from '@/auth/authStore';
import { useSyncStore } from '@/data/syncStore';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h3>
      {children}
    </section>
  );
}

export function Settings() {
  const inputStatus = useAppStore((s) => s.inputStatus);
  const [testPlayed, setTestPlayed] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const playTestNote = async () => {
    await audioService.init();
    audioService.playNote(60, 0.6, 0.8);
    setTestPlayed(true);
  };

  const resetAll = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await repository.clearAll();
      window.location.reload();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Progress could not be reset.');
      setResetting(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Settings</h2>
        <p className="mt-1 text-sm text-ink-soft">Input, calibration, audio, and app preferences.</p>
      </div>

      <AccountSettings />

      <Section title="Input">
        <div className="flex flex-wrap items-center gap-3">
          <MidiConnectButton />
          <InputStatusBanner status={inputStatus} />
        </div>
        <KeyboardHint />
        <InputMonitorPanel />
      </Section>

      <Section title="Calibration">
        <CalibrationPanel />
      </Section>

      <Section title="Audio">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void playTestNote()}
            className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
          >
            <Volume2 size={16} /> Play a test note
          </button>
          {testPlayed && (
            <span className="text-sm text-ink-soft">
              {audioService.pianoReady
                ? 'Sampled grand piano is loaded.'
                : 'Playing on the built-in synth — the sampled piano loads in the background (needs internet the first time).'}
            </span>
          )}
        </div>
      </Section>

      <Section title="Learning">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => useAppStore.getState().setShowOnboarding(true)}
            className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
          >
            <GraduationCap size={16} /> Replay the intro tour
          </button>
          <span className="text-sm text-ink-soft">
            A one-minute refresher on Missions, XP, and mastery.
          </span>
        </div>
      </Section>

      <Section title="Accessibility">
        <p className="max-w-prose text-sm text-ink-soft">
          Animations respect your system&rsquo;s reduced-motion setting automatically. All controls
          are reachable by keyboard, with a visible focus ring.
        </p>
      </Section>

      <Section title="Danger zone">
        <div className="flex flex-col gap-3 rounded-3xl border border-rose-soft bg-surface p-5 shadow-soft">
          <p className="text-sm text-ink-soft">
            Erase your cloud and local progress — skills, attempts, unlocks, and settings. This cannot be
            undone. Type <span className="font-medium text-ink">reset</span> to confirm.
          </p>
          {resetError && <p className="text-sm font-semibold text-rose-ink" role="alert">{resetError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              placeholder="reset"
              className="w-32 rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus-visible:ring"
            />
            <button
              type="button"
              disabled={resetText !== 'reset' || resetting}
              onClick={() => void resetAll()}
              className="inline-flex items-center gap-2 rounded-full bg-rose px-5 py-2 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px disabled:opacity-40"
            >
              {resetting ? 'Resetting…' : 'Reset all progress'}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function AccountSettings() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const signOut = useAuthStore((s) => s.signOut);
  const sync = useSyncStore();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => setName(profile?.displayName ?? ''), [profile?.displayName]);

  const saveName = async () => {
    setSavingName(true);
    setAccountError(null);
    try {
      await updateDisplayName(name);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Profile could not be updated.');
    } finally {
      setSavingName(false);
    }
  };

  const runSync = async () => {
    setAccountError(null);
    try {
      await syncAccountProgress();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Sync could not be started.');
    }
  };

  const logout = async () => {
    setAccountError(null);
    try {
      await signOut();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Sign out failed.');
    }
  };

  const SyncIcon = sync.status === 'offline' || sync.status === 'error' ? CloudOff : sync.status === 'saving' ? RefreshCw : Cloud;
  const syncCopy = sync.status === 'saved'
    ? 'All progress saved'
    : sync.status === 'saving'
      ? `Saving${sync.pending ? ` ${sync.pending} change${sync.pending === 1 ? '' : 's'}` : ''}…`
      : sync.status === 'offline'
        ? `Offline${sync.pending ? ` · ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting` : ''}`
        : `Sync needs attention${sync.pending ? ` · ${sync.pending} waiting` : ''}`;

  return (
    <Section title="Account">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber-ink">
              <UserRound size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-ink">{profile?.displayName ?? 'Pianist'}</p>
              <p className="truncate text-sm text-ink-soft">{user?.email}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${sync.status === 'saved' ? 'bg-mint-soft text-mint-ink' : sync.status === 'saving' ? 'bg-amber-soft text-amber-ink' : 'bg-rose-soft text-rose-ink'}`}>
            <SyncIcon size={14} className={sync.status === 'saving' ? 'animate-spin' : ''} />
            {syncCopy}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Display name</span>
            <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="auth-input" />
          </label>
          <button type="button" disabled={savingName || !name.trim() || name.trim() === profile?.displayName} onClick={() => void saveName()} className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2.5 font-display text-sm font-semibold text-ink shadow-soft disabled:opacity-40">
            <Save size={16} /> {savingName ? 'Saving…' : 'Save name'}
          </button>
        </div>

        {accountError && <p className="mt-3 text-sm font-semibold text-rose-ink" role="alert">{accountError}</p>}
        {sync.message && sync.status !== 'saved' && <p className="mt-3 text-xs text-ink-soft">{sync.message}</p>}

        <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
          <button type="button" onClick={() => void runSync()} className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 font-display text-sm font-semibold text-ink">
            <RefreshCw size={15} /> Sync now
          </button>
          <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-semibold text-rose-ink hover:bg-rose-soft">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>
    </Section>
  );
}
