import { useEffect, useState, type ReactNode } from 'react';
import { Check, Ear, Hand, Music, Sparkles, Drum, BookOpen, Piano } from 'lucide-react';
import { inputService } from '@/input';
import { useAppStore } from '@/ui/store/appStore';
import { LevelMeter } from '@/ui/components/LevelMeter';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';
import { KeyboardHint } from '@/ui/components/KeyboardHint';
import { MidiConnectButton } from '@/ui/components/MidiConnectButton';
import { InputStatusBanner } from '@/ui/components/InputMonitorPanel';
import { CalibrationPanel } from '@/ui/components/CalibrationPanel';

function StepFrame({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-display text-sm font-medium uppercase tracking-wide text-rose-deep">{kicker}</p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function PromiseStep() {
  return (
    <StepFrame kicker="Welcome" title="Learn blues, gospel & country piano — for real.">
      <div className="flex flex-col gap-3 text-sm text-ink">
        <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-soft">
          <Music size={18} className="mt-0.5 shrink-0 text-amber-deep" />
          <span>
            <span className="font-medium">Play real songs from day one.</span> Every exercise exists
            to unlock music you actually want to play.
          </span>
        </div>
        <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-soft">
          <Drum size={18} className="mt-0.5 shrink-0 text-amber-deep" />
          <span>
            <span className="font-medium">Progress you can trust.</span> The app listens to your
            playing — accuracy <em>and</em> timing — and advances you only when your hands prove it.
          </span>
        </div>
        <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-soft">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-amber-deep" />
          <span>
            <span className="font-medium">No grinding.</span> Replaying easy material pays almost
            nothing. Getting better is the only way forward.
          </span>
        </div>
      </div>
    </StepFrame>
  );
}

export function InputSetupStep() {
  const status = useAppStore((s) => s.inputStatus);
  const [heard, setHeard] = useState(false);

  useEffect(() => {
    const off = inputService.onNote(() => setHeard(true));
    return off;
  }, []);

  return (
    <StepFrame kicker="Step 1 · Input" title="How will you play?">
      <p className="max-w-prose text-sm text-ink-soft">
        Piano Pro listens through a <span className="font-medium text-ink">MIDI keyboard</span> (best)
        or the <span className="font-medium text-ink">on-screen / computer keys</span> below — there&rsquo;s
        no microphone mode. Press any key now to check your input works.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <MidiConnectButton />
        <InputStatusBanner status={status} />
        {heard && (
          <span className="inline-flex items-center gap-1.5 rounded-2xl bg-mint-soft px-4 py-2 text-sm font-medium text-mint-deep">
            <Check size={16} /> We heard you — input works!
          </span>
        )}
      </div>
      <KeyboardHint />
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <PianoKeyboard />
      </div>
    </StepFrame>
  );
}

export function CalibrationStep() {
  return (
    <StepFrame kicker="Step 2 · Timing" title="Tune out the lag.">
      <p className="max-w-prose text-sm text-ink-soft">
        Audio adds a few milliseconds of delay, which can make honest playing read as
        &ldquo;late.&rdquo; A ten-second tap-along fixes that. You can skip this and tune up later in
        Settings.
      </p>
      <CalibrationPanel showIntro={false} />
    </StepFrame>
  );
}

const STRANDS = [
  { icon: Hand, name: 'Technique & movement', blurb: 'Comfortable hands that move without staring' },
  { icon: Drum, name: 'Rhythm & groove', blurb: 'Steady pulse, shuffle, and playing through mistakes' },
  { icon: BookOpen, name: 'Harmony & theory', blurb: 'Chords, keys, and the why behind every song' },
  { icon: Ear, name: 'Ear & musicianship', blurb: 'Hearing chords, grooves, and phrases' },
  { icon: Piano, name: 'Repertoire & creativity', blurb: 'A growing set of songs, riffs, and your own ideas' },
];

export function StrandsStep() {
  return (
    <StepFrame kicker="Step 3 · The plan" title="What you'll learn">
      <p className="max-w-prose text-sm text-ink-soft">
        Every mission mixes five threads — you won&rsquo;t study them as separate subjects, they&rsquo;re
        woven into learning each groove and song:
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {STRANDS.map(({ icon: Icon, name, blurb }) => (
          <div key={name} className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-soft">
            <Icon size={18} className="mt-0.5 shrink-0 text-peri-deep" />
            <div>
              <div className="text-sm font-medium text-ink">{name}</div>
              <div className="text-xs text-ink-soft">{blurb}</div>
            </div>
          </div>
        ))}
      </div>
    </StepFrame>
  );
}

export function HowItWorksStep() {
  return (
    <StepFrame kicker="Step 4 · Progress" title="How Missions, XP, and mastery work">
      <div className="flex flex-col gap-3 text-sm">
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <span className="font-medium text-ink">Missions</span>
          <span className="text-ink-soft">
            {' '}
            is your guided path: short modules that each teach one musical outcome, then apply it in
            a real song. There&rsquo;s always one recommended next step.
          </span>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <span className="font-medium text-ink">Free Play</span>
          <span className="text-ink-soft">
            {' '}
            is open practice — any song you&rsquo;ve unlocked, any time. Takes there still count.
          </span>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-soft">
          <LevelMeter level={1} fraction={0.4} size={56} gatesRemaining />
          <p className="text-ink-soft">
            <span className="font-medium text-ink">XP fills your Level meter, but XP alone never
            levels you up.</span>{' '}
            Advancing also takes mastery: playing the tier&rsquo;s skills and boss song accurately,
            in time, at tempo, with no visual help. The Progress tab always shows exactly what&rsquo;s
            left.
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <span className="font-medium text-ink">Hands and Head.</span>
          <span className="text-ink-soft">
            {' '}
            Knowing a chord (Head) and playing it in time (Hands) are tracked separately. Ear and
            theory work opens Head locks — but only your hands can raise your playing level or
            unlock songs.
          </span>
        </div>
      </div>
    </StepFrame>
  );
}

export function LaunchStep({ replay }: { replay: boolean }) {
  return (
    <StepFrame
      kicker="Ready"
      title={replay ? 'That’s the tour!' : 'Your first mission awaits.'}
    >
      <p className="max-w-prose text-sm text-ink-soft">
        {replay
          ? 'You can replay this intro any time from Settings → Learning.'
          : 'First up: Meet the Keyboard — find your way around the keys and play your first notes. A few good minutes a day is all it takes.'}
      </p>
    </StepFrame>
  );
}
