/**
 * Positive resurfacing framing per segment purpose (doc 06 §3.5): review is
 * "bringing something back", never "you forgot". One eyebrow line + a tone.
 */
import type { SegmentPurpose } from '@/core/session/sessionTypes';

export interface SegmentFraming {
  eyebrow: string;
  /** Tailwind classes for the intro eyebrow chip. */
  tone: string;
  /** Optional honest-practice line (doc-08 §3.4: learners misread mixed
   * practice as worse — the app should say out loud that it isn't). */
  honesty?: string;
}

const FRAMING: Record<SegmentPurpose, SegmentFraming> = {
  'familiar-win': { eyebrow: 'A familiar win to warm up', tone: 'bg-mint-soft text-mint-deep' },
  'new-material': { eyebrow: 'Something new', tone: 'bg-amber-soft text-amber-deep' },
  'due-review': {
    eyebrow: 'Bring back a foundation skill',
    tone: 'bg-peri-soft text-peri-deep',
    honesty: 'Mixing old and new feels harder than drilling one thing — and it works better. That’s the science, not a scheduling glitch.',
  },
  'theory-ear': { eyebrow: 'Ear & theory — keep it sharp', tone: 'bg-peri-soft text-peri-deep' },
  remediation: { eyebrow: 'A smaller step first', tone: 'bg-sand text-ink-soft' },
  'song-application': { eyebrow: 'Song time', tone: 'bg-rose-soft text-rose-deep' },
  'section-drill': { eyebrow: 'Zoom in on the tricky bars', tone: 'bg-rose-soft text-rose-deep' },
  'independent-check': { eyebrow: 'Checkpoint — show it sticks', tone: 'bg-rose-soft text-rose-deep' },
  'transfer-reentry': { eyebrow: 'Old skill, new context', tone: 'bg-peri-soft text-peri-deep' },
  'stretch-boss': {
    eyebrow: 'Boss Challenge — where today’s skills live in a much bigger piece',
    tone: 'bg-peri-soft text-peri-deep',
  },
};

export function framingFor(purpose: SegmentPurpose): SegmentFraming {
  return FRAMING[purpose];
}
