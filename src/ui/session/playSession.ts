/**
 * PlaySession — orchestrates one take: count-in → play (metronome as clock) →
 * score. Bridges the AudioService Transport, the InputService note stream, the
 * LiveGrader (real-time colour), and the offline ScoringEngine (authoritative
 * Attempt). Kept as a plain class so it isn't tangled in React effect lifecycles.
 */
import type { Assist, Attempt, Chart, NotePlayed, Tier } from '@/core/types';
import { scoreAttempt } from '@/core/scoring/scoringEngine';
import { LiveGrader, type LiveGrade } from '@/core/scoring/liveGrader';
import { audioService } from '@/audio/audioService';
import { inputService } from '@/input';

export type PlayPhase = 'idle' | 'count-in' | 'playing' | 'done';

export interface PlaySessionOptions {
  chart: Chart;
  targetTempoBPM: number;
  tempoBPM: number; // may be slowed below target
  tier: Tier;
  beatsPerBar: number;
  countInBeats: number;
  assists: Assist[];
}

export interface PlaySessionCallbacks {
  onPhase?: (p: PlayPhase) => void;
  onLiveGrade?: (g: LiveGrade) => void;
  onComplete?: (a: Attempt) => void;
}

export class PlaySession {
  phase: PlayPhase = 'idle';
  chartStartPerfMs = 0;
  private opts: PlaySessionOptions | null = null;
  private grader: LiveGrader | null = null;
  private played: NotePlayed[] = [];
  private offTick: (() => void) | null = null;
  private offNote: (() => void) | null = null;

  constructor(private readonly cb: PlaySessionCallbacks = {}) {}

  async start(opts: PlaySessionOptions): Promise<void> {
    await audioService.init();
    this.cancel();
    this.opts = opts;
    this.played = [];
    this.grader = null;
    this.setPhase('count-in');

    const totalBeats = opts.chart.notes.reduce(
      (m, n) => Math.max(m, n.startBeat + n.durationBeats),
      0,
    );
    const endBeat = opts.countInBeats + Math.ceil(totalBeats) + 1;

    this.offNote = inputService.onNote((n) => this.handleNote(n));
    this.offTick = audioService.onTick((tick) => {
      if (tick.beat === opts.countInBeats) {
        this.chartStartPerfMs = tick.perfMs;
        this.grader = new LiveGrader(opts.chart, opts.tempoBPM, opts.tier, tick.perfMs);
        this.setPhase('playing');
      }
      if (tick.beat >= endBeat) this.finish();
    });

    audioService.startMetronome(opts.tempoBPM, opts.beatsPerBar);
  }

  cancel(): void {
    this.offTick?.();
    this.offNote?.();
    this.offTick = null;
    this.offNote = null;
    if (audioService.isInitialized) audioService.stopMetronome();
    if (this.phase !== 'done') this.setPhase('idle');
  }

  private handleNote(n: NotePlayed): void {
    if (this.phase !== 'playing' || !this.grader) return;
    this.played.push(n);
    const g = this.grader.feed(n);
    if (g) this.cb.onLiveGrade?.(g);
  }

  private finish(): void {
    this.offTick?.();
    this.offNote?.();
    this.offTick = null;
    this.offNote = null;
    audioService.stopMetronome();

    const opts = this.opts;
    if (!opts) return;
    const attempt = scoreAttempt({
      chart: opts.chart,
      played: this.played,
      tempoBPM: opts.tempoBPM,
      targetTempoBPM: opts.targetTempoBPM,
      tier: opts.tier,
      startTimeMs: this.chartStartPerfMs,
      assistsUsed: opts.assists,
    });
    this.setPhase('done');
    this.cb.onComplete?.(attempt);
  }

  private setPhase(p: PlayPhase): void {
    this.phase = p;
    this.cb.onPhase?.(p);
  }
}
