import { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Dot, Accidental } from 'vexflow';
import type { Chart, NoteEvent } from '@/core/types';

/**
 * Secondary notation (build-spec §10.2): a best-effort treble-staff reading of
 * the right-hand line, for users who want standard notation. Chord symbols +
 * falling notes remain primary. Rendering is wrapped defensively — any VexFlow
 * hiccup degrades to a friendly note rather than breaking the player.
 */
interface StaffNotationProps {
  chart: Chart;
  maxBars?: number;
}

const LETTERS = ['c', 'c', 'd', 'd', 'e', 'f', 'f', 'g', 'g', 'a', 'a', 'b'];
const SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];

function midiToVexKey(pitch: number): { key: string; accidental: string | null } {
  const pc = ((pitch % 12) + 12) % 12;
  const octave = Math.floor(pitch / 12) - 1;
  return { key: `${LETTERS[pc]}${SHARP[pc] ? '#' : ''}/${octave}`, accidental: SHARP[pc] ? '#' : null };
}

function durToVex(beats: number): { duration: string; dots: number } {
  if (beats >= 4) return { duration: 'w', dots: 0 };
  if (beats >= 3) return { duration: 'h', dots: 1 };
  if (beats >= 2) return { duration: 'h', dots: 0 };
  if (beats >= 1.5) return { duration: 'q', dots: 1 };
  if (beats >= 1) return { duration: 'q', dots: 0 };
  if (beats >= 0.5) return { duration: '8', dots: 0 };
  return { duration: '16', dots: 0 };
}

export function StaffNotation({ chart, maxBars = 4 }: StaffNotationProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    setFailed(false);

    const beatsPerBar = chart.timeSignature.beatsPerBar;
    const rh = chart.notes
      .filter((n) => n.hand !== 'left' && n.pitches.length === 1)
      .sort((a, b) => a.startBeat - b.startBeat)
      .filter((n) => Math.floor(n.startBeat / beatsPerBar) < maxBars);

    if (rh.length === 0) return; // chord-only chart → rely on chord symbols

    try {
      const width = Math.max(host.clientWidth, 480);
      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(width, 130);
      const ctx = renderer.getContext();

      const stave = new Stave(8, 12, width - 16);
      stave.addClef('treble').addTimeSignature(`${beatsPerBar}/${chart.timeSignature.beatUnit}`);
      stave.setContext(ctx).draw();

      const notes = rh.map((n: NoteEvent) => {
        const { key, accidental } = midiToVexKey(n.pitches[0]);
        const { duration, dots } = durToVex(n.durationBeats);
        const sn = new StaveNote({ keys: [key], duration });
        if (accidental) sn.addModifier(new Accidental(accidental), 0);
        for (let d = 0; d < dots; d++) Dot.buildAndAttach([sn], { all: true });
        return sn;
      });

      const voice = new Voice({ numBeats: rh.length, beatValue: 4 });
      voice.setStrict(false).addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], width - 60);
      voice.draw(ctx, stave);
    } catch {
      setFailed(true);
    }
  }, [chart, maxBars]);

  return (
    <div className="rounded-3xl border border-line bg-surface p-3 shadow-soft">
      <div ref={hostRef} className="overflow-x-auto" data-testid="staff-notation" />
      {failed && (
        <p className="px-2 py-3 text-sm text-ink-soft">
          Staff view unavailable for this chart — use the chord symbols and falling notes.
        </p>
      )}
    </div>
  );
}
