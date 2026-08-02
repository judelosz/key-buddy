import { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, BarNote, Voice, Formatter, Dot, Accidental } from 'vexflow';
import type { Chart, NoteEvent } from '@/core/types';

/**
 * Secondary notation (build-spec §10.2): a best-effort treble-staff reading of
 * the right-hand line, for users who want standard notation. Chord symbols +
 * falling notes remain primary. Rendering is wrapped defensively — any VexFlow
 * hiccup degrades to a friendly note rather than breaking the player.
 *
 * Best-effort limits (deliberate): no rests, so a pickup bar shows only its
 * notes; a note held across a barline renders as one long value in its
 * starting bar rather than tied halves.
 */
interface StaffNotationProps {
  chart: Chart;
  /** Cap the rendered bars; omitted = the whole chart (scrolls horizontally). */
  maxBars?: number;
}

/**
 * Pitch-class spellings for the app's C-centered blues/gospel/country content:
 * flat-side alterations (E♭, A♭, B♭ — the blues third and ♭7s) spell as flats,
 * leading-tone-style ones (C♯, F♯) as sharps.
 */
const SPELLING: Array<{ letter: string; accidental: '#' | 'b' | null }> = [
  { letter: 'c', accidental: null },
  { letter: 'c', accidental: '#' },
  { letter: 'd', accidental: null },
  { letter: 'e', accidental: 'b' },
  { letter: 'e', accidental: null },
  { letter: 'f', accidental: null },
  { letter: 'f', accidental: '#' },
  { letter: 'g', accidental: null },
  { letter: 'a', accidental: 'b' },
  { letter: 'a', accidental: null },
  { letter: 'b', accidental: 'b' },
  { letter: 'b', accidental: null },
];

/** Horizontal budget per rendered note/chord and per barline, in px. */
const NOTE_PX = 40;
const BAR_PX = 14;
/** Clef + time signature + margins. */
const LEAD_PX = 96;

function midiToVexKey(pitch: number): {
  key: string;
  accidental: '#' | 'b' | null;
  /** Staff position (letter/octave) — the accidental-tracking key. */
  position: string;
} {
  const pc = ((pitch % 12) + 12) % 12;
  const { letter, accidental } = SPELLING[pc];
  // Flat spellings keep the letter's own octave (B♭4 and B4 share octave 4).
  const octave = Math.floor(pitch / 12) - 1;
  return {
    key: `${letter}${accidental ?? ''}/${octave}`,
    accidental,
    position: `${letter}/${octave}`,
  };
}

function durToVex(beats: number): { duration: string; dots: number } {
  if (beats >= 6) return { duration: 'w', dots: 1 };
  if (beats >= 4) return { duration: 'w', dots: 0 };
  if (beats >= 3) return { duration: 'h', dots: 1 };
  if (beats >= 2) return { duration: 'h', dots: 0 };
  if (beats >= 1.5) return { duration: 'q', dots: 1 };
  if (beats >= 1) return { duration: 'q', dots: 0 };
  if (beats >= 0.5) return { duration: '8', dots: 0 };
  return { duration: '16', dots: 0 };
}

export function StaffNotation({ chart, maxBars }: StaffNotationProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    setNotice(null);

    const beatsPerBar = chart.timeSignature.beatsPerBar;
    const rh = chart.notes
      .filter((n) => n.hand !== 'left')
      .sort((a, b) => a.startBeat - b.startBeat)
      .filter((n) => maxBars === undefined || Math.floor(n.startBeat / beatsPerBar) < maxBars);

    if (rh.length === 0) {
      // Left-hand-only material: an empty stave would read as a bug, so say so.
      setNotice('The staff view reads the right hand — this piece is all left hand, so follow the falling notes and chord symbols.');
      return;
    }

    try {
      const barCount = Math.floor(rh[rh.length - 1].startBeat / beatsPerBar) + 1;
      const contentWidth = LEAD_PX + rh.length * NOTE_PX + barCount * BAR_PX;
      const width = Math.max(host.clientWidth, contentWidth, 480);
      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(width, 130);
      const ctx = renderer.getContext();

      const stave = new Stave(8, 12, width - 16);
      stave.addClef('treble').addTimeSignature(`${beatsPerBar}/${chart.timeSignature.beatUnit}`);
      stave.setContext(ctx).draw();

      const tickables: Array<StaveNote | BarNote> = [];
      let lastBar = Math.floor(rh[0].startBeat / beatsPerBar);
      // Accidentals carry through a bar: track what each staff position
      // (letter/octave) currently holds so repeats stay clean and a return to
      // the unaltered note gets its natural sign.
      let barAccidentals = new Map<string, '#' | 'b' | null>();
      for (const n of rh as NoteEvent[]) {
        const bar = Math.floor(n.startBeat / beatsPerBar);
        if (bar > lastBar) {
          tickables.push(new BarNote());
          lastBar = bar;
          barAccidentals = new Map();
        }
        const pitches = [...n.pitches].sort((a, b) => a - b);
        const mapped = pitches.map(midiToVexKey);
        const { duration, dots } = durToVex(n.durationBeats);
        const sn = new StaveNote({ keys: mapped.map((m) => m.key), duration, autoStem: true });
        mapped.forEach((m, i) => {
          const held = barAccidentals.get(m.position) ?? null;
          if (m.accidental !== held) {
            sn.addModifier(new Accidental(m.accidental ?? 'n'), i);
            barAccidentals.set(m.position, m.accidental);
          }
        });
        for (let d = 0; d < dots; d++) Dot.buildAndAttach([sn], { all: true });
        tickables.push(sn);
      }

      const voice = new Voice({ numBeats: beatsPerBar, beatValue: chart.timeSignature.beatUnit });
      voice.setStrict(false).addTickables(tickables);
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx, stave);
    } catch {
      setNotice('Staff view unavailable for this chart — use the chord symbols and falling notes.');
    }
  }, [chart, maxBars]);

  return (
    <div className="rounded-3xl border border-line bg-surface p-3 shadow-soft">
      <div ref={hostRef} className="overflow-x-auto" data-testid="staff-notation" />
      {notice && <p className="px-2 py-3 text-sm text-ink-soft">{notice}</p>}
    </div>
  );
}
