import { useState, type ReactNode } from 'react';
import { GraduationCap, Volume2 } from 'lucide-react';
import { audioService } from '@/audio/audioService';
import { repository } from '@/data/dexieRepository';
import { useAppStore } from '@/ui/store/appStore';
import { CalibrationPanel } from '@/ui/components/CalibrationPanel';
import { InputMonitorPanel, InputStatusBanner } from '@/ui/components/InputMonitorPanel';
import { KeyboardHint } from '@/ui/components/KeyboardHint';
import { MidiConnectButton } from '@/ui/components/MidiConnectButton';

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

  const playTestNote = async () => {
    await audioService.init();
    audioService.playNote(60, 0.6, 0.8);
    setTestPlayed(true);
  };

  const resetAll = async () => {
    setResetting(true);
    await repository.clearAll();
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Settings</h2>
        <p className="mt-1 text-sm text-ink-soft">Input, calibration, audio, and app preferences.</p>
      </div>

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
            Erase all local progress — skills, attempts, unlocks, and settings. This cannot be
            undone. Type <span className="font-medium text-ink">reset</span> to confirm.
          </p>
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
