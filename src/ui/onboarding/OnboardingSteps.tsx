import { useEffect, useState, type ReactNode } from 'react';
import { Brain, Check, Ear, Hand, Music, Sparkles, Drum, BookOpen, Piano } from 'lucide-react';
import { inputService } from '@/input';
import { getContent } from '@/core/content/bundled';
import { useAppStore } from '@/ui/store/appStore';
import { ChurchWindowMotif, PianoMotif, RoadMotif } from '@/ui/components/genreMotifs';
import { GateRing } from '@/ui/components/GateRing';
import { LockPip } from '@/ui/components/LockPip';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';
import { KeyboardHint } from '@/ui/components/KeyboardHint';
import { MidiConnectButton } from '@/ui/components/MidiConnectButton';
import { InputStatusBanner } from '@/ui/components/InputMonitorPanel';

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
        Key-Buddy listens through a <span className="font-medium text-ink">MIDI keyboard</span> (best)
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
      <KeyboardHint defaultOpen />
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <PianoKeyboard />
      </div>
      <p className="text-xs text-ink-soft">
        Tip: if your notes ever feel like they score &ldquo;late,&rdquo; a ten-second tap-along in
        Settings → Calibration tunes out your device&rsquo;s audio lag.
      </p>
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
    <StepFrame kicker="Step 2 · The plan" title="What you'll learn">
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
    <StepFrame kicker="Step 3 · Progress" title="How Missions, XP, and mastery work">
      <div className="flex flex-col gap-3 text-sm">
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <span className="font-medium text-ink">Missions</span>
          <span className="text-ink-soft">
            {' '}
            is your guided path: short modules that each teach one musical outcome, then apply it in
            a real song. There&rsquo;s always one recommended next step. (
            <span className="font-medium text-ink">Free Play</span> is open practice — any unlocked
            song, any time; takes there still count.)
          </span>
        </div>

        {/* The two-lock model — the game's core rule, stated plainly. */}
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <p className="font-medium text-ink">Every skill has two locks.</p>
          <div className="mt-2.5 flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <LockPip on icon={<Hand size={13} />} title="Hands lock" />
              <p className="text-ink-soft">
                <span className="font-medium text-ink">The Hands lock</span> — can you{' '}
                <em>play</em> it: right notes, in time, at tempo, with no visual help. Opened only
                at the keyboard. Playing earns{' '}
                <span className="font-medium text-amber-deep">Hands XP</span>.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <LockPip on icon={<Brain size={13} />} title="Head lock" />
              <p className="text-ink-soft">
                <span className="font-medium text-ink">The Head lock</span> — do you{' '}
                <em>know and hear</em> it: ear training and theory. That work earns{' '}
                <span className="font-medium text-peri-deep">Head XP</span>. A skill goes gold only
                when both locks are open.
              </p>
            </div>
          </div>
        </div>

        {/* What the locks actually gate — songs and levels. */}
        <div className="flex items-start gap-4 rounded-2xl bg-surface p-4 shadow-soft">
          <GateRing
            level={1}
            size={64}
            segments={{
              xpFraction: 0.4,
              coreSkillsFraction: 0.5,
              bossPassed: false,
              checkpointPassed: true,
              delayedReviewPassed: false,
            }}
          />
          <div className="min-w-0 text-ink-soft">
            <p>
              <span className="font-medium text-ink">The locks are how you unlock everything.</span>{' '}
              Songs unlock when their required skills are Hands-mastered — never with points. Your
              level advances through a five-part gate, and this ring IS that gate:
            </p>
            <p className="mt-1.5 text-xs">
              <span className="font-medium text-amber-deep">amber segments</span> = hands work
              (practice XP band · core skills · boss song star · a review after a day away) ·{' '}
              <span className="font-medium text-peri-deep">the peri segment</span> = your head work
              (the tier&rsquo;s theory &amp; ear checkpoint). Full ring = level up — the ring never
              looks fuller than the truth.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <span className="font-medium text-ink">So: Head XP never levels you up on its own.</span>
          <span className="text-ink-soft">
            {' '}
            Ear &amp; theory open Head locks and pass the checkpoint segment — real, visible
            progress — but only your hands can raise your level or unlock songs. Both meters live
            in the top-right corner, all the time.
          </span>
        </div>
      </div>
    </StepFrame>
  );
}

export function LaunchStep({ replay }: { replay: boolean }) {
  const content = getContent();
  const firstModule = content.modules[0];
  const firstLessons = (firstModule?.lessonIds ?? [])
    .slice(0, 3)
    .map((id) => content.getLesson(id))
    .filter((l): l is NonNullable<typeof l> => l !== undefined);

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

      {/* The send-off: where you're headed (three genres) and what's first. */}
      <div className="flex items-center justify-center gap-8 py-2" aria-hidden="true">
        <PianoMotif size={64} className="animate-pop" />
        <ChurchWindowMotif size={64} className="animate-pop" />
        <RoadMotif size={64} className="animate-pop" />
      </div>

      {!replay && firstModule && firstLessons.length > 0 && (
        <div className="rounded-3xl bg-surface p-5 shadow-soft">
          <p className="font-display text-xs font-medium uppercase tracking-wide text-rose-deep">
            Mission 1
          </p>
          <h3 className="mt-0.5 font-display text-lg font-semibold text-ink">
            {firstModule.title}
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {firstLessons.map((l, i) => (
              <li key={l.id} className="flex items-center gap-2.5 text-sm text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand font-display text-xs font-semibold text-ink-soft">
                  {i + 1}
                </span>
                {l.title}
              </li>
            ))}
            <li className="flex items-center gap-2.5 text-xs text-ink-soft">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand">
                …
              </span>
              and {Math.max(0, (firstModule.lessonIds.length ?? 0) - 3)} more small steps
            </li>
          </ul>
        </div>
      )}
    </StepFrame>
  );
}
