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
  'familiar-win': { eyebrow: 'A familiar win to warm up', tone: 'bg-mint-soft text-mint-ink' },
  'new-material': { eyebrow: 'Something new', tone: 'bg-amber-soft text-amber-ink' },
  'due-review': {
    eyebrow: 'Bring back a foundation skill',
    tone: 'bg-peri-soft text-peri-ink',
    honesty: 'Mixing old and new feels harder than drilling one thing — and it works better. That’s the science, not a scheduling glitch.',
  },
  'theory-ear': { eyebrow: 'Ear & theory — keep it sharp', tone: 'bg-peri-soft text-peri-ink' },
  remediation: { eyebrow: 'A smaller step first', tone: 'bg-sand text-ink-soft' },
  'song-application': { eyebrow: 'Song time', tone: 'bg-rose-soft text-rose-ink' },
  'section-drill': { eyebrow: 'Zoom in on the tricky bars', tone: 'bg-rose-soft text-rose-ink' },
  'independent-check': { eyebrow: 'Checkpoint — show it sticks', tone: 'bg-rose-soft text-rose-ink' },
  'transfer-reentry': { eyebrow: 'Old skill, new context', tone: 'bg-peri-soft text-peri-ink' },
  'stretch-boss': {
    eyebrow: 'Boss Challenge — where today’s skills live in a much bigger piece',
    tone: 'bg-peri-soft text-peri-ink',
  },
};

export function framingFor(purpose: SegmentPurpose): SegmentFraming {
  return FRAMING[purpose];
}

/**
 * What each segment purpose BUILDS TOWARD in the level-up math — the
 * transparency line under every intro card (user decision 2026-07-28: the
 * player should always know what today's practice accomplishes).
 */
const BUILDS: Record<SegmentPurpose, string> = {
  'familiar-win': 'Warms you up — and keeps an earned skill earning.',
  'new-material': 'Builds toward: the tier’s core skills and the practice XP band.',
  'due-review': 'Builds toward: keeping mastered skills gold — and the “review after a delay” gate item.',
  'theory-ear': 'Builds toward: the tier check quiz (the purple segment of your level ring).',
  remediation: 'Builds toward: un-sticking the skill that blocked you, one size smaller.',
  'song-application': 'Builds toward: the boss mastery star and the song’s mastery ladder.',
  'section-drill': 'Builds toward: cleaning this song’s weakest bars — section evidence.',
  'independent-check': 'Builds toward: proving a skill without guides — gate evidence.',
  'transfer-reentry': 'Builds toward: an old skill in a new context — deeper, transferable mastery.',
  'stretch-boss': 'Builds toward: nothing yet — a taste of where you’re going. No stakes.',
};

export function buildsFor(purpose: SegmentPurpose): string {
  return BUILDS[purpose];
}
