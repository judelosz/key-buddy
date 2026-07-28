import { useState } from 'react';
import { ArrowRight, ChevronLeft, Piano } from 'lucide-react';
import { useAppStore } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';
import {
  PromiseStep,
  InputSetupStep,
  StrandsStep,
  HowItWorksStep,
  LaunchStep,
} from './OnboardingSteps';

/**
 * Landing onboarding (doc 06 §7.0, calibration removed 2026-07-23 — it lives
 * in Settings for self-serve tuning): promise → input setup → strands → how
 * progress works → launch. First-run entry point (not a tab); replayable from
 * Settings. Short, skippable-forward, and it never ends on a blank dashboard —
 * the final CTA lands in Missions.
 */
export function Onboarding({ replay = false }: { replay?: boolean }) {
  const [step, setStep] = useState(0);
  const setShowOnboarding = useAppStore((s) => s.setShowOnboarding);
  const setScreen = useAppStore((s) => s.setScreen);
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);

  const steps = [
    { body: <PromiseStep />, cta: 'Get Started' },
    { body: <InputSetupStep />, cta: 'Continue' },
    { body: <StrandsStep />, cta: 'Continue' },
    { body: <HowItWorksStep />, cta: 'Continue' },
    { body: <LaunchStep replay={replay} />, cta: replay ? 'Back to Missions' : 'Start your first mission' },
  ];
  const last = step === steps.length - 1;

  const setActiveLesson = useAppStore((s) => s.setActiveLesson);

  const finish = () => {
    void completeOnboarding();
    setScreen('missions');
    // First run ends inside the first lesson — never on a blank dashboard.
    if (!replay) {
      const next = useGameStore.getState().nextLesson();
      if (next) setActiveLesson({ moduleId: next.module.id, lessonId: next.lesson.id });
    }
    setShowOnboarding(false);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-5 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-soft text-amber-deep shadow-soft">
            <Piano size={24} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Key-Buddy</h1>
            <p className="text-xs text-ink-soft">Blues · Gospel · Country</p>
          </div>
        </div>
        {replay && (
          <button
            type="button"
            onClick={finish}
            className="text-sm text-ink-soft hover:text-ink"
          >
            Close
          </button>
        )}
      </header>

      {/* Steps center vertically — content no longer hugs the top of an
          otherwise empty page (visual-polish B4). Step changes are discrete,
          so re-centering between steps can't jump mid-interaction. */}
      <main className="flex flex-1 flex-col justify-center animate-fade-up" key={step}>
        {steps[step].body}
      </main>

      <footer className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-amber-deep' : 'w-2 bg-line'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-sm text-ink-soft transition hover:text-ink"
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : setStep((s) => s + 1))}
            className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
          >
            {steps[step].cta} <ArrowRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
