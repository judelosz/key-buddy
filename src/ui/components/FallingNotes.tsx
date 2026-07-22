import { useEffect, useRef, type RefObject } from 'react';
import type { Chart, NoteGrade } from '@/core/types';
import { isBlackKey, midiToName } from '@/core/music';
import { audioService } from '@/audio/audioService';

const GRADE_COLORS: Record<NoteGrade, string> = {
  perfect: '#22c55e',
  great: '#86efac',
  good: '#eab308',
  early: '#f97316',
  late: '#a855f7',
  miss: '#ef4444',
};

interface FallingNotesProps {
  chart: Chart;
  tempoBPM: number;
  countInBeats: number;
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
  liveGradesRef,
  active,
  height = 320,
}: FallingNotesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pitches = chart.notes.flatMap((n) => n.pitches);
    const minPitch = Math.min(...pitches) - 1;
    const maxPitch = Math.max(...pitches) + 1;
    const lanes = maxPitch - minPitch + 1;
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

      const hitLineY = height * 0.82;
      const pxPerBeat = hitLineY / LOOKAHEAD_BEATS;
      const laneW = width / lanes;

      const transportSec = active && audioService.isInitialized ? audioService.getTransportSeconds() : 0;
      const playheadBeat = (transportSec * 1000) / beatMs - countInBeats;

      // background
      ctx.fillStyle = '#141821';
      ctx.fillRect(0, 0, width, height);

      // lane shading for black keys
      for (let i = 0; i < lanes; i++) {
        const pitch = minPitch + i;
        if (isBlackKey(pitch)) {
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          ctx.fillRect(i * laneW, 0, laneW, height);
        }
      }

      // beat gridlines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let b = Math.floor(playheadBeat); b < playheadBeat + LOOKAHEAD_BEATS + 1; b++) {
        const y = hitLineY - (b - playheadBeat) * pxPerBeat;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // notes
      const grades = liveGradesRef.current;
      for (const note of chart.notes) {
        const y = hitLineY - (note.startBeat - playheadBeat) * pxPerBeat;
        const noteH = Math.max(6, note.durationBeats * pxPerBeat - 3);
        if (y - noteH > height || y < -40) continue; // off-screen

        const grade = grades?.get(note.id);
        const passed = note.startBeat < playheadBeat - 0.5;
        let color: string;
        if (grade) color = GRADE_COLORS[grade];
        else if (passed) color = 'rgba(239,68,68,0.35)'; // un-hit & passed → faint miss
        else color = note.hand === 'left' ? '#5b8def' : '#d8dee9';

        for (const pitch of note.pitches) {
          const lane = pitch - minPitch;
          const x = lane * laneW + 2;
          ctx.fillStyle = color;
          roundRect(ctx, x, y - noteH, laneW - 4, noteH, 3);
          ctx.fill();
        }
      }

      // hit line
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, hitLineY);
      ctx.lineTo(width, hitLineY);
      ctx.stroke();

      // pitch labels (C notes only, to avoid clutter)
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '10px system-ui';
      for (let i = 0; i < lanes; i++) {
        const pitch = minPitch + i;
        if (pitch % 12 === 0) {
          ctx.fillText(midiToName(pitch), i * laneW + 3, height - 4);
        }
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [chart, tempoBPM, countInBeats, liveGradesRef, active, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className="rounded-xl border border-ink-line"
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
