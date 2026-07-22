import { useEffect, useRef, type RefObject } from 'react';
import type { Chart, NoteGrade } from '@/core/types';
import { midiToName } from '@/core/music';
import { keyRectMap } from '@/core/pianoLayout';
import { audioService } from '@/audio/audioService';

const GRADE_COLORS: Record<NoteGrade, string> = {
  perfect: '#34B378',
  great: '#7FD0A6',
  good: '#E3A72E',
  early: '#EC7A3B',
  late: '#9A72D6',
  miss: '#E5646B',
};

interface FallingNotesProps {
  chart: Chart;
  tempoBPM: number;
  countInBeats: number;
  /** Pitch range — must match the keyboard below so notes drop onto their keys. */
  lowPitch: number;
  highPitch: number;
  /** Live per-note grades, mutated in place by the play session for zero-lag reads. */
  liveGradesRef: RefObject<Map<string, NoteGrade>>;
  /** Whether the take is running (drives the rAF clock read). */
  active: boolean;
  height?: number;
}

const LOOKAHEAD_BEATS = 4;

export function FallingNotes({
  chart,
  tempoBPM,
  countInBeats,
  lowPitch,
  highPitch,
  liveGradesRef,
  active,
  height = 300,
}: FallingNotesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const beatMs = 60000 / tempoBPM;

    let raf = 0;
    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Same key geometry (in px) as the on-screen keyboard below.
      const rects = keyRectMap(lowPitch, highPitch, width);

      const hitLineY = height * 0.86;
      const pxPerBeat = hitLineY / LOOKAHEAD_BEATS;

      const transportSec = active && audioService.isInitialized ? audioService.getTransportSeconds() : 0;
      const playheadBeat = (transportSec * 1000) / beatMs - countInBeats;

      // background (warm ivory lane)
      ctx.fillStyle = '#F6F1E8';
      ctx.fillRect(0, 0, width, height);

      // subtle black-key column shading
      for (const r of rects.values()) {
        if (r.black) {
          ctx.fillStyle = 'rgba(43,38,32,0.04)';
          ctx.fillRect(r.x, 0, r.width, hitLineY);
        }
      }

      // vertical separators between white keys
      ctx.strokeStyle = 'rgba(43,38,32,0.06)';
      ctx.lineWidth = 1;
      for (const r of rects.values()) {
        if (r.black) continue;
        ctx.beginPath();
        ctx.moveTo(r.x, 0);
        ctx.lineTo(r.x, hitLineY);
        ctx.stroke();
      }

      // beat gridlines
      ctx.strokeStyle = 'rgba(43,38,32,0.06)';
      for (let b = Math.ceil(playheadBeat); b < playheadBeat + LOOKAHEAD_BEATS + 1; b++) {
        const y = hitLineY - (b - playheadBeat) * pxPerBeat;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // notes — one rect per pitch, positioned exactly over its key
      const grades = liveGradesRef.current;
      for (const note of chart.notes) {
        const y = hitLineY - (note.startBeat - playheadBeat) * pxPerBeat;
        const noteH = Math.max(6, note.durationBeats * pxPerBeat - 3);
        if (y - noteH > height || y < -40) continue; // off-screen

        const grade = grades?.get(note.id);
        const passed = note.startBeat < playheadBeat - 0.5;
        let color: string;
        if (grade) color = GRADE_COLORS[grade];
        else if (passed) color = 'rgba(229,100,107,0.30)'; // un-hit & passed → faint miss
        else color = note.hand === 'left' ? '#7681CE' : '#E0A9B8';

        for (const pitch of note.pitches) {
          const r = rects.get(pitch);
          if (!r) continue;
          ctx.fillStyle = color;
          roundRect(ctx, r.x + 1.5, y - noteH, Math.max(2, r.width - 3), noteH, 4);
          ctx.fill();
        }
      }

      // hit line (rose)
      ctx.strokeStyle = 'rgba(199,116,137,0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, hitLineY);
      ctx.lineTo(width, hitLineY);
      ctx.stroke();

      // C-note labels for orientation
      ctx.fillStyle = 'rgba(43,38,32,0.4)';
      ctx.font = '600 10px Nunito, system-ui';
      for (const r of rects.values()) {
        if (r.pitch % 12 === 0) ctx.fillText(midiToName(r.pitch), r.x + 3, height - 4);
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [chart, tempoBPM, countInBeats, lowPitch, highPitch, liveGradesRef, active, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className="block w-full"
      data-testid="falling-notes"
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
